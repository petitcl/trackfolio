import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import { clientAuthService } from '@/lib/auth/client.auth.service'
import type { Symbol, Database } from '@/lib/supabase/types'
import { getClientMockDataStore } from '@/lib/mockDataStoreClient'
import { cacheService } from './cache.service'

/**
 * Metadata stored in the symbols.metadata JSONB field for account holdings
 */
export interface AccountHoldingMetadata {
  account_type: 'crypto_exchange' | 'stock_broker' | 'retirement' | 'bank'
  provider?: string
}

/**
 * Parameters for creating a new account holding
 */
export interface CreateAccountHoldingParams {
  symbol: string          // User-entered name (e.g., BINANCE_TRADING)
  displayName: string     // Display name for UI
  accountType: 'crypto_exchange' | 'stock_broker' | 'retirement' | 'bank'
  provider?: string       // Optional provider name (e.g., Binance, Coinbase)
  currency: string        // Currency (e.g., USD)
  initialValue: number    // Initial account balance
  startDate: string       // Starting date (YYYY-MM-DD)
}

/**
 * Service responsible for managing account-level holdings
 * Account holdings track external account balances as aggregate positions
 */
export class AccountHoldingService {
  private supabase = createClient()

  /**
   * Standardized error handling for service methods
   */
  private handleError<T>(operation: string, error: unknown, fallback: T): T {
    console.error(`Error ${operation}:`, error)
    return fallback
  }

  /**
   * Check if a symbol is an account holding
   */
  isAccountHolding(symbolData: Symbol): boolean {
    return symbolData.holding_type === 'account'
  }

  /**
   * Get the latest price per unit for an account holding from user_symbol_prices
   */
  async getCurrentPricePerUnit(user: AuthUser, symbol: string): Promise<number> {
    if (clientAuthService.isCurrentUserMock()) {
      const mockStore = getClientMockDataStore()
      const prices = mockStore.getUserSymbolPrices(symbol)
      const latestPrice = prices[0]

      return latestPrice?.manual_price || 1
    }

    try {
      const { data, error } = await this.supabase
        .from('user_symbol_prices')
        .select('manual_price')
        .eq('user_id', user.id)
        .eq('symbol', symbol)
        .order('price_date', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) {
        console.warn(`No price found for ${symbol}, defaulting to 1`)
        return 1
      }

      return data.manual_price
    } catch (error) {
      return this.handleError('fetching current price per unit', error, 1)
    }
  }

  /**
   * Calculate quantity of units to add for a deposit
   * quantity = depositAmount / currentPricePerUnit
   */
  calculateDepositUnits(depositAmount: number, currentPricePerUnit: number): number {
    if (currentPricePerUnit === 0) {
      throw new Error('Cannot calculate deposit units: price per unit is zero')
    }
    return depositAmount / currentPricePerUnit
  }

  /**
   * Calculate new price per unit after balance update
   * newPricePerUnit = newBalance / currentQuantity
   */
  calculateNewPricePerUnit(newBalance: number, currentQuantity: number): number {
    if (currentQuantity === 0) {
      throw new Error('Cannot calculate new price per unit: current quantity is zero')
    }
    return newBalance / currentQuantity
  }

  /**
   * Create a new account holding
   * This creates:
   * 1. Custom symbol with holding_type='account' and metadata
   * 2. Initial transaction (buy) with quantity = initialValue units @ $1
   * 3. Initial price entry in user_symbol_prices
   * 4. Position record
   */
  async createAccountHolding(user: AuthUser, params: CreateAccountHoldingParams): Promise<void> {
    if (clientAuthService.isCurrentUserMock()) {
      const mockStore = getClientMockDataStore()

      // Create symbol
      mockStore.addSymbol({
        symbol: params.symbol,
        name: params.displayName,
        asset_type: 'other',
        currency: params.currency,
        is_custom: true,
        created_by_user_id: user.id,
        holding_type: 'account',
        metadata: {
          account_type: params.accountType,
          provider: params.provider
        },
        created_at: new Date().toISOString(),
        last_price: null,
        last_updated: null
      })

      // Create initial transaction: buy initialValue units @ $1
      mockStore.addTransaction({
        date: params.startDate,
        symbol: params.symbol,
        type: 'buy',
        quantity: params.initialValue,
        pricePerUnit: 1,
        currency: params.currency,
        fees: 0,
        amount: params.initialValue,
        notes: 'Initial account balance',
        broker: null
      })

      // Create initial price entry
      mockStore.addUserSymbolPrice({
        id: crypto.randomUUID(),
        user_id: user.id,
        symbol: params.symbol,
        manual_price: 1,
        price_date: params.startDate,
        notes: 'Initial price per unit',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

      // Create position
      mockStore.addPosition(params.symbol, user.id)

      // Invalidate caches
      cacheService.invalidate(cacheService.Keys.symbols(user.id))
      cacheService.invalidate(cacheService.Keys.transactions(user.id))
      cacheService.invalidate(cacheService.Keys.userSymbolPrices(user.id))
      cacheService.invalidate(cacheService.Keys.positions(user.id))

      return
    }

    try {
      // 1. Create custom symbol
      const { error: symbolError } = await this.supabase
        .from('symbols')
        .insert({
          symbol: params.symbol,
          name: params.displayName,
          asset_type: 'other',
          currency: params.currency,
          is_custom: true,
          created_by_user_id: user.id,
          holding_type: 'account',
          metadata: {
            account_type: params.accountType,
            provider: params.provider
          } as any
        })

      if (symbolError) {
        throw new Error(`Failed to create symbol: ${symbolError.message}`)
      }

      // 2. Create initial transaction (buy initialValue units @ $1)
      const { error: transactionError } = await this.supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          date: params.startDate,
          symbol: params.symbol,
          type: 'buy',
          quantity: params.initialValue,
          price_per_unit: 1,
          currency: params.currency,
          fees: 0,
          amount: params.initialValue,
          notes: 'Initial account balance'
        })

      if (transactionError) {
        throw new Error(`Failed to create initial transaction: ${transactionError.message}`)
      }

      // 3. Create initial price entry
      const { error: priceError } = await this.supabase
        .from('user_symbol_prices')
        .insert({
          user_id: user.id,
          symbol: params.symbol,
          manual_price: 1,
          price_date: params.startDate,
          notes: 'Initial price per unit'
        })

      if (priceError) {
        throw new Error(`Failed to create initial price: ${priceError.message}`)
      }

      // 4. Create position
      const { error: positionError } = await this.supabase
        .from('positions')
        .insert({
          user_id: user.id,
          symbol: params.symbol
        })

      if (positionError) {
        throw new Error(`Failed to create position: ${positionError.message}`)
      }

      // Invalidate caches
      cacheService.invalidate(cacheService.Keys.symbols(user.id))
      cacheService.invalidate(cacheService.Keys.transactions(user.id))
      cacheService.invalidate(cacheService.Keys.userSymbolPrices(user.id))
      cacheService.invalidate(cacheService.Keys.positions(user.id))

    } catch (error) {
      this.handleError('creating account holding', error, undefined)
      throw error
    }
  }

  /**
   * Update account balance by inserting a new price per unit
   * Calculates: newPricePerUnit = newBalance / currentQuantity
   */
  async updateAccountBalance(
    user: AuthUser,
    params: {
      symbol: string
      currentQuantity: number
      newBalance: number
      date: string
      notes?: string
    }
  ): Promise<void> {
    const newPricePerUnit = this.calculateNewPricePerUnit(params.newBalance, params.currentQuantity)

    if (clientAuthService.isCurrentUserMock()) {
      const mockStore = getClientMockDataStore()

      mockStore.addUserSymbolPrice({
        id: crypto.randomUUID(),
        user_id: user.id,
        symbol: params.symbol,
        manual_price: newPricePerUnit,
        price_date: params.date,
        notes: params.notes || `Balance update to ${params.newBalance}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

      cacheService.invalidate(cacheService.Keys.userSymbolPrices(user.id))
      return
    }

    try {
      const { error } = await this.supabase
        .from('user_symbol_prices')
        .insert({
          user_id: user.id,
          symbol: params.symbol,
          manual_price: newPricePerUnit,
          price_date: params.date,
          notes: params.notes || `Balance update to ${params.newBalance}`
        })

      if (error) {
        throw new Error(`Failed to update balance: ${error.message}`)
      }

      cacheService.invalidate(cacheService.Keys.userSymbolPrices(user.id))
    } catch (error) {
      this.handleError('updating account balance', error, undefined)
      throw error
    }
  }

  /**
   * Record a deposit transaction
   * Calculates quantity based on current price per unit
   */
  async recordDeposit(
    user: AuthUser,
    symbol: string,
    amount: number,
    date: string,
    notes?: string
  ): Promise<void> {
    const currentPrice = await this.getCurrentPricePerUnit(user, symbol)
    const quantity = this.calculateDepositUnits(amount, currentPrice)

    if (clientAuthService.isCurrentUserMock()) {
      const mockStore = getClientMockDataStore()

      mockStore.addTransaction({
        date: date,
        symbol: symbol,
        type: 'deposit',
        quantity: quantity,
        pricePerUnit: currentPrice,
        currency: 'USD', // TODO: get from symbol
        fees: 0,
        amount: amount,
        notes: notes || 'Account deposit',
        broker: null
      })

      cacheService.invalidate(cacheService.Keys.transactions(user.id))
      return
    }

    try {
      const { error } = await this.supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          date: date,
          symbol: symbol,
          type: 'deposit',
          quantity: quantity,
          price_per_unit: currentPrice,
          currency: 'USD', // TODO: get from symbol
          fees: 0,
          amount: amount,
          notes: notes || 'Account deposit'
        })

      if (error) {
        throw new Error(`Failed to record deposit: ${error.message}`)
      }

      cacheService.invalidate(cacheService.Keys.transactions(user.id))
    } catch (error) {
      this.handleError('recording deposit', error, undefined)
      throw error
    }
  }

  /**
   * Record a withdrawal transaction
   * Calculates quantity based on current price per unit
   */
  async recordWithdrawal(
    user: AuthUser,
    symbol: string,
    amount: number,
    date: string,
    notes?: string
  ): Promise<void> {
    const currentPrice = await this.getCurrentPricePerUnit(user, symbol)
    const quantity = this.calculateDepositUnits(amount, currentPrice) // Same calculation as deposit

    if (clientAuthService.isCurrentUserMock()) {
      const mockStore = getClientMockDataStore()

      mockStore.addTransaction({
        date: date,
        symbol: symbol,
        type: 'withdrawal',
        quantity: quantity,
        pricePerUnit: currentPrice,
        currency: 'USD', // TODO: get from symbol
        fees: 0,
        amount: amount,
        notes: notes || 'Account withdrawal',
        broker: null
      })

      cacheService.invalidate(cacheService.Keys.transactions(user.id))
      return
    }

    try {
      const { error } = await this.supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          date: date,
          symbol: symbol,
          type: 'withdrawal',
          quantity: quantity,
          price_per_unit: currentPrice,
          currency: 'USD', // TODO: get from symbol
          fees: 0,
          amount: amount,
          notes: notes || 'Account withdrawal'
        })

      if (error) {
        throw new Error(`Failed to record withdrawal: ${error.message}`)
      }

      cacheService.invalidate(cacheService.Keys.transactions(user.id))
    } catch (error) {
      this.handleError('recording withdrawal', error, undefined)
      throw error
    }
  }
}

// Export singleton instance
export const accountHoldingService = new AccountHoldingService()
