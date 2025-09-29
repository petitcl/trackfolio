import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import { clientAuthService } from '@/lib/auth/client.auth.service'
import type { Transaction, Symbol, Database, UserSymbolPrice, TransactionType } from '@/lib/supabase/types'
import { getClientMockDataStore } from '@/lib/mockDataStoreClient'
import { cacheService } from './cache.service'

/**
 * Service responsible for CRUD operations on transactions, symbols, and user prices
 * Handles both real users (Supabase) and demo users (mock data store)
 */
export class TransactionService {
  private supabase = createClient()

  /**
   * Standardized error handling for service methods
   */
  private handleError<T>(operation: string, error: unknown, fallback: T): T {
    console.error(`Error ${operation}:`, error)
    return fallback
  }

  /**
   * Get all symbols (both public and user custom symbols)
   */
  async getSymbols(user: AuthUser): Promise<Symbol[]> {
    const cacheKey = cacheService.Keys.symbols(user.id)

    return cacheService.getOrFetch(
      cacheKey,
      async () => {
        if (clientAuthService.isCurrentUserMock()) {
          return getClientMockDataStore().getSymbols()
        }

        try {
          const { data, error } = await this.supabase
            .from('symbols')
            .select('*')
            .or(`created_by_user_id.is.null,created_by_user_id.eq.${user.id}`)

          if (error) {
            console.error('Error fetching symbols:', error)
            return []
          }

          return data || []
        } catch (error) {
          return this.handleError('fetching symbols', error, [])
        }
      },
      cacheService.getTTL('symbols')
    )
  }

  /**
   * Get all transactions for a user
   */
  async getTransactions(user: AuthUser): Promise<Transaction[]> {
    const cacheKey = cacheService.Keys.transactions(user.id)

    return cacheService.getOrFetch(
      cacheKey,
      async () => {
        if (clientAuthService.isCurrentUserMock()) {
          return getClientMockDataStore().getTransactions()
        }

        try {
          const { data, error } = await this.supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false })

          if (error) {
            console.error('Error fetching transactions:', error)
            return []
          }

          return data || []
        } catch (error) {
          return this.handleError('fetching transactions', error, [])
        }
      },
      cacheService.getTTL('transactions')
    )
  }

  /**
   * Get transactions for a specific holding
   */
  async getHoldingTransactions(user: AuthUser, symbol: string): Promise<Transaction[]> {
    const allTransactions = await this.getTransactions(user)
    return allTransactions.filter(t => t.symbol === symbol)
  }

  /**
   * Create or get a symbol in the database
   * 
   * IMPORTANT: Symbol creation logic:
   * - For custom assets (is_custom = true): Creates the symbol in the database
   * - For non-custom assets (stocks, ETFs, crypto): Assumes the symbol already exists
   *   in the backend. Does NOT attempt to create non-custom symbols as they should
   *   be pre-populated or managed by backend services with proper market data.
   */
  async createOrGetSymbol(symbolData: {
    symbol: string
    name: string
    asset_type: Database["public"]["Enums"]["asset_type"]
    currency?: string
    is_custom: boolean
    created_by_user_id?: string | null
    last_price?: number | null
  }): Promise<Symbol | null> {
    try {
      // For non-custom symbols, we assume they exist in the backend
      // We don't attempt to create them as they should be pre-populated
      if (!symbolData.is_custom) {
        console.log('📊 Non-custom symbol - assuming it exists in backend:', symbolData.symbol)
        // Return a minimal symbol object for non-custom assets
        // The actual data will be fetched from the backend when needed
        return {
          id: '', // Will be populated by backend
          symbol: symbolData.symbol.toUpperCase(),
          name: symbolData.name,
          asset_type: symbolData.asset_type,
          is_custom: false,
          created_by_user_id: null,
          last_price: symbolData.last_price || null,
          last_updated: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          currency: 'USD'
        } as Symbol
      }

      // For custom symbols, check if it exists first
      const query = this.supabase
        .from('symbols')
        .select('*')
        .eq('symbol', symbolData.symbol.toUpperCase())
      
      if (symbolData.created_by_user_id) {
        query.eq('created_by_user_id', symbolData.created_by_user_id)
      } else {
        query.is('created_by_user_id', null)
      }
      
      const { data: existingSymbol, error: fetchError } = await query.single()
      
      if (existingSymbol && !fetchError) {
        console.log('📊 Custom symbol already exists:', existingSymbol.symbol)
        return existingSymbol
      }
      
      // Create new custom symbol
      const { data: newSymbol, error: createError } = await this.supabase
        .from('symbols')
        .insert({
          symbol: symbolData.symbol.toUpperCase(),
          name: symbolData.name,
          asset_type: symbolData.asset_type,
          currency: symbolData.currency || 'USD',
          is_custom: true,
          created_by_user_id: symbolData.created_by_user_id,
          last_price: symbolData.last_price || null,
          last_updated: new Date().toISOString()
        })
        .select()
        .single()
      
      if (createError) {
        console.error('Error creating custom symbol:', createError)
        return null
      }
      
      console.log('✅ Created new custom symbol:', newSymbol?.symbol)
      return newSymbol
    } catch (error) {
      console.error('Error in createOrGetSymbol:', error)
      return null
    }
  }

  /**
   * Add a new transaction - supports both real and demo users
   */
  async addTransactionForUser(user: AuthUser, transactionData: {
    symbol: string
    type: Database["public"]["Enums"]["transaction_type"]
    quantity: number
    pricePerUnit: number
    date: string
    notes?: string | null
    fees?: number
    amount?: number | null
    currency?: string
    broker?: string | null
  }): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
    try {
      if (user.isDemo) {
        // For demo users, add to mock data store
        const transaction = getClientMockDataStore().addTransaction({
          symbol: transactionData.symbol,
          type: transactionData.type,
          quantity: transactionData.quantity,
          pricePerUnit: transactionData.pricePerUnit,
          date: transactionData.date,
          fees: transactionData.fees,
          amount: transactionData.amount,
          currency: transactionData.currency,
          broker: transactionData.broker,
          notes: transactionData.notes
        })
        
        console.log('✅ Added transaction to mock data store:', transaction.id)

        // Invalidate cache for demo user
        cacheService.invalidateUserData(user.id)

        return { success: true, transaction }
      } else {
        // For real users, use Supabase
        const transaction = await this.addTransaction({
          user_id: user.id,
          symbol: transactionData.symbol,
          type: transactionData.type,
          quantity: transactionData.quantity,
          price_per_unit: transactionData.pricePerUnit,
          date: transactionData.date,
          notes: transactionData.notes,
          fees: transactionData.fees,
          amount: transactionData.amount,
          currency: transactionData.currency,
          broker: transactionData.broker
        })

        if (!transaction) {
          return { success: false, error: 'Failed to add transaction to database' }
        }

        console.log('✅ Added transaction to database:', transaction.id)

        // Invalidate cache for real user
        cacheService.invalidateUserData(user.id)

        return { success: true, transaction }
      }
    } catch (error) {
      console.error('Error adding transaction:', error)
      return { success: false, error: 'An unexpected error occurred' }
    }
  }

  /**
   * Add a new transaction (buy/sell/etc) - internal method for real users only
   */
  private async addTransaction(transactionData: {
    user_id: string
    symbol: string
    type: Database["public"]["Enums"]["transaction_type"]
    quantity: number
    price_per_unit: number
    date: string
    notes?: string | null
    fees?: number
    amount?: number | null
    currency?: string
    broker?: string | null
  }): Promise<Transaction | null> {
    try {
      const { data: transaction, error } = await this.supabase
        .from('transactions')
        .insert({
          user_id: transactionData.user_id,
          symbol: transactionData.symbol.toUpperCase(),
          type: transactionData.type,
          quantity: transactionData.quantity,
          price_per_unit: transactionData.price_per_unit,
          date: transactionData.date,
          notes: transactionData.notes || null,
          fees: transactionData.fees || 0,
          amount: transactionData.amount || null,
          currency: transactionData.currency || 'USD',
          broker: transactionData.broker || null
        })
        .select()
        .single()
      
      if (error) {
        console.error('Error adding transaction:', error)
        return null
      }
      
      console.log('✅ Added transaction:', transaction?.id)
      return transaction
    } catch (error) {
      console.error('Error in addTransaction:', error)
      return null
    }
  }

  /**
   * Update an existing transaction - supports both real and demo users
   */
  async updateTransactionForUser(user: AuthUser, transactionId: string, transactionData: {
    type: Database["public"]["Enums"]["transaction_type"]
    quantity: number
    pricePerUnit: number
    date: string
    notes?: string | null
    fees?: number
    amount?: number | null
    currency?: string
    broker?: string | null
  }): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
    try {
      if (user.isDemo) {
        // For demo users, update in mock data store
        const success = getClientMockDataStore().updateTransaction(transactionId, {
          type: transactionData.type,
          quantity: transactionData.quantity,
          pricePerUnit: transactionData.pricePerUnit,
          date: transactionData.date,
          fees: transactionData.fees,
          amount: transactionData.amount,
          currency: transactionData.currency,
          broker: transactionData.broker,
          notes: transactionData.notes
        })
        
        if (!success) {
          return { success: false, error: 'Transaction not found' }
        }
        
        console.log('✅ Updated transaction in mock data store:', transactionId)

        // Invalidate cache for demo user
        cacheService.invalidateUserData(user.id)

        return { success: true }
      } else {
        // For real users, update in Supabase
        const { data: transaction, error } = await this.supabase
          .from('transactions')
          .update({
            type: transactionData.type,
            quantity: transactionData.quantity,
            price_per_unit: transactionData.pricePerUnit,
            date: transactionData.date,
            notes: transactionData.notes,
            fees: transactionData.fees || 0,
            amount: transactionData.amount || null,
            currency: transactionData.currency || 'USD',
            broker: transactionData.broker,
            updated_at: new Date().toISOString()
          })
          .eq('id', transactionId)
          .eq('user_id', user.id)
          .select()
          .single()

        if (error) {
          console.error('Error updating transaction:', error)
          return { success: false, error: 'Failed to update transaction in database' }
        }

        console.log('✅ Updated transaction in database:', transaction.id)

        // Invalidate cache for real user
        cacheService.invalidateUserData(user.id)

        return { success: true, transaction }
      }
    } catch (error) {
      console.error('Error updating transaction:', error)
      return { success: false, error: 'An unexpected error occurred' }
    }
  }

  /**
   * Delete a transaction - supports both real and demo users
   */
  async deleteTransactionForUser(user: AuthUser, transactionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (user.isDemo) {
        // For demo users, delete from mock data store
        const success = getClientMockDataStore().deleteTransaction(transactionId)
        
        if (!success) {
          return { success: false, error: 'Transaction not found' }
        }
        
        console.log('✅ Deleted transaction from mock data store:', transactionId)

        // Invalidate cache for demo user
        cacheService.invalidateUserData(user.id)

        return { success: true }
      } else {
        // For real users, delete from Supabase
        const { error } = await this.supabase
          .from('transactions')
          .delete()
          .eq('id', transactionId)
          .eq('user_id', user.id)

        if (error) {
          console.error('Error deleting transaction:', error)
          return { success: false, error: 'Failed to delete transaction from database' }
        }

        console.log('✅ Deleted transaction from database:', transactionId)

        // Invalidate cache for real user
        cacheService.invalidateUserData(user.id)

        return { success: true }
      }
    } catch (error) {
      console.error('Error deleting transaction:', error)
      return { success: false, error: 'An unexpected error occurred' }
    }
  }

  /**
   * Add a new holding (creates symbol if needed and adds buy transaction)
   */
  async addHolding(user: AuthUser, holdingData: {
    symbol: string
    name: string
    assetType: Database["public"]["Enums"]["asset_type"]
    currency: string
    quantity: number
    purchasePrice: number
    purchaseDate: string
    notes?: string
    isCustom: boolean
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // Create or get the symbol
      const symbol = await this.createOrGetSymbol({
        symbol: holdingData.symbol,
        name: holdingData.name,
        asset_type: holdingData.assetType,
        currency: holdingData.currency,
        is_custom: holdingData.isCustom,
        created_by_user_id: holdingData.isCustom ? user.id : null,
        last_price: holdingData.purchasePrice
      })
      
      if (!symbol) {
        return { success: false, error: 'Failed to create or get symbol' }
      }
      
      // Add the buy transaction using the unified method
      const transactionResult = await this.addTransactionForUser(user, {
        symbol: holdingData.symbol,
        type: 'buy',
        quantity: holdingData.quantity,
        pricePerUnit: holdingData.purchasePrice,
        date: holdingData.purchaseDate,
        notes: holdingData.notes
      })
      
      if (!transactionResult.success) {
        return { success: false, error: transactionResult.error || 'Failed to add transaction' }
      }
      
      return { success: true }
    } catch (error) {
      console.error('Error adding holding:', error)
      return { success: false, error: 'An unexpected error occurred' }
    }
  }

  /**
   * Delete a holding and all associated data
   * 
   * For custom holdings:
   * - Deletes all transactions for that symbol/user
   * - Deletes all custom prices for that symbol/user
   * - Deletes the custom symbol itself
   * 
   * For regular holdings (stocks/ETFs/crypto):
   * - Deletes all transactions for that symbol/user
   * - Deletes any custom prices for that symbol/user
   * - Does NOT delete the symbol (it's a public market symbol)
   */
  async deleteHolding(user: AuthUser, symbol: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🗑️ Starting deletion of holding: ${symbol} for user: ${user.email}`)
      
      // First, check if this is a custom symbol
      const { data: symbolData, error: symbolError } = await this.supabase
        .from('symbols')
        .select('*')
        .eq('symbol', symbol.toUpperCase())
        .single()
      
      if (symbolError && symbolError.code !== 'PGRST116') {
        console.error('Error fetching symbol:', symbolError)
        return { success: false, error: 'Failed to fetch symbol information' }
      }
      
      const isCustomSymbol = symbolData?.is_custom && symbolData?.created_by_user_id === user.id
      
      // Delete all transactions for this symbol/user
      const { error: transactionsError } = await this.supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id)
        .eq('symbol', symbol.toUpperCase())
      
      if (transactionsError) {
        console.error('Error deleting transactions:', transactionsError)
        return { success: false, error: 'Failed to delete transactions' }
      }
      console.log(`✅ Deleted transactions for ${symbol}`)
      
      // Delete all custom prices for this symbol/user
      const { error: pricesError } = await this.supabase
        .from('user_symbol_prices')
        .delete()
        .eq('user_id', user.id)
        .eq('symbol', symbol.toUpperCase())
      
      if (pricesError) {
        console.error('Error deleting custom prices:', pricesError)
        return { success: false, error: 'Failed to delete custom prices' }
      }
      console.log(`✅ Deleted custom prices for ${symbol}`)
      
      // If it's a custom symbol created by this user, delete the symbol itself
      if (isCustomSymbol) {
        const { error: symbolDeleteError } = await this.supabase
          .from('symbols')
          .delete()
          .eq('symbol', symbol.toUpperCase())
          .eq('created_by_user_id', user.id)
          .eq('is_custom', true)
        
        if (symbolDeleteError) {
          console.error('Error deleting custom symbol:', symbolDeleteError)
          return { success: false, error: 'Failed to delete custom symbol' }
        }
        console.log(`✅ Deleted custom symbol: ${symbol}`)
      }
      
      console.log(`🎉 Successfully deleted holding: ${symbol}`)
      return { success: true }
      
    } catch (error) {
      console.error('Error deleting holding:', error)
      return { success: false, error: 'An unexpected error occurred while deleting the holding' }
    }
  }

  /**
   * Get user symbol price history for a specific symbol
   */
  async getUserSymbolPrices(user: AuthUser, symbol: string): Promise<UserSymbolPrice[]> {
    // For demo users, use mock data store
    if (user.isDemo) {
      return getClientMockDataStore().getUserSymbolPrices(symbol)
    }

    try {
      const { data, error } = await this.supabase
        .from('user_symbol_prices')
        .select('*')
        .eq('user_id', user.id)
        .eq('symbol', symbol.toUpperCase())
        .order('price_date', { ascending: false })

      if (error) {
        console.error('Error fetching user symbol prices:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getUserSymbolPrices:', error)
      return []
    }
  }

  /**
   * Add a new user symbol price entry
   */
  async addUserSymbolPrice(user: AuthUser, priceData: {
    symbol: string
    manual_price: number
    price_date: string
    notes?: string | null
  }): Promise<void> {
    // For demo users, add to mock data store
    if (user.isDemo) {
      await getClientMockDataStore().addUserSymbolPrice({
        id: crypto.randomUUID(),
        user_id: user.id,
        symbol: priceData.symbol.toUpperCase(),
        manual_price: priceData.manual_price,
        price_date: priceData.price_date,
        notes: priceData.notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      return
    }

    try {
      // Add the price entry
      const { error: priceError } = await this.supabase
        .from('user_symbol_prices')
        .insert({
          user_id: user.id,
          symbol: priceData.symbol.toUpperCase(),
          manual_price: priceData.manual_price,
          price_date: priceData.price_date,
          notes: priceData.notes,
        })

      if (priceError) {
        console.error('Error adding user symbol price:', priceError)
        throw new Error('Failed to add price entry')
      }

      // Update the symbol's last_price with the new price
      const { error: symbolError } = await this.supabase
        .from('symbols')
        .update({
          last_price: priceData.manual_price,
          last_updated: new Date().toISOString()
        })
        .eq('symbol', priceData.symbol.toUpperCase())

      if (symbolError) {
        console.error('Error updating symbol last_price:', symbolError)
        // Don't throw here as the price entry was successfully added
        console.warn('Price entry added but failed to update symbol last_price')
      }

      console.log(`✅ Added price entry for ${priceData.symbol}: ${priceData.manual_price} on ${priceData.price_date}`)

      // Invalidate price caches
      cacheService.invalidateSymbolPrices(priceData.symbol.toUpperCase())
    } catch (error) {
      console.error('Error in addUserSymbolPrice:', error)
      throw error
    }
  }

  /**
   * Update a user symbol price entry
   */
  async updateUserSymbolPrice(user: AuthUser, priceId: string, priceData: {
    symbol: string
    manual_price: number
    price_date: string
    notes?: string | null
  }): Promise<void> {
    // For demo users, update in mock data store
    if (user.isDemo) {
      await getClientMockDataStore().updateUserSymbolPrice(priceId, {
        manual_price: priceData.manual_price,
        price_date: priceData.price_date,
        notes: priceData.notes,
        updated_at: new Date().toISOString()
      })
      return
    }

    try {
      // Update the price entry
      const { error: updateError } = await this.supabase
        .from('user_symbol_prices')
        .update({
          manual_price: priceData.manual_price,
          price_date: priceData.price_date,
          notes: priceData.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', priceId)
        .eq('user_id', user.id)

      if (updateError) {
        console.error('Error updating price entry:', updateError)
        throw new Error('Failed to update price entry')
      }

      // Update the symbol's last_price if this is the most recent price
      const { data: mostRecentPrice } = await this.supabase
        .from('user_symbol_prices')
        .select('manual_price, price_date')
        .eq('user_id', user.id)
        .eq('symbol', priceData.symbol.toUpperCase())
        .order('price_date', { ascending: false })
        .limit(1)
        .single()

      if (mostRecentPrice) {
        const { error: symbolError } = await this.supabase
          .from('symbols')
          .update({
            last_price: mostRecentPrice.manual_price,
            last_updated: new Date().toISOString()
          })
          .eq('symbol', priceData.symbol.toUpperCase())

        if (symbolError) {
          console.warn('Price entry updated but failed to update symbol last_price')
        }
      }

      console.log(`✅ Updated price entry for ${priceData.symbol}: ${priceData.manual_price} on ${priceData.price_date}`)

      // Invalidate price caches
      cacheService.invalidateSymbolPrices(priceData.symbol.toUpperCase())
    } catch (error) {
      console.error('Error in updateUserSymbolPrice:', error)
      throw error
    }
  }

  /**
   * Delete a user symbol price entry
   */
  async deleteUserSymbolPrice(user: AuthUser, priceId: string): Promise<void> {
    // For demo users, remove from mock data store
    if (user.isDemo) {
      await getClientMockDataStore().deleteUserSymbolPrice(priceId)
      return
    }

    try {
      // First, get the price entry to know which symbol it belongs to
      const { data: deletedPrice, error: fetchError } = await this.supabase
        .from('user_symbol_prices')
        .select('symbol')
        .eq('id', priceId)
        .eq('user_id', user.id)
        .single()

      if (fetchError || !deletedPrice) {
        console.error('Error fetching price entry for deletion:', fetchError)
        throw new Error('Price entry not found')
      }

      // Delete the price entry
      const { error: deleteError } = await this.supabase
        .from('user_symbol_prices')
        .delete()
        .eq('id', priceId)
        .eq('user_id', user.id)

      if (deleteError) {
        console.error('Error deleting user symbol price:', deleteError)
        throw new Error('Failed to delete price entry')
      }

      // Get the most recent remaining price for this symbol
      const { data: remainingPrices, error: remainingError } = await this.supabase
        .from('user_symbol_prices')
        .select('manual_price, price_date')
        .eq('user_id', user.id)
        .eq('symbol', deletedPrice.symbol)
        .order('price_date', { ascending: false })
        .limit(1)

      if (remainingError) {
        console.error('Error fetching remaining prices:', remainingError)
        // Don't throw here as the deletion was successful
      }

      // Update the symbol's last_price if there are remaining prices
      if (remainingPrices && remainingPrices.length > 0) {
        const { error: symbolError } = await this.supabase
          .from('symbols')
          .update({
            last_price: remainingPrices[0].manual_price,
            last_updated: new Date().toISOString()
          })
          .eq('symbol', deletedPrice.symbol)

        if (symbolError) {
          console.error('Error updating symbol last_price after deletion:', symbolError)
          // Don't throw here as the deletion was successful
        }
      }

      console.log(`✅ Deleted price entry ${priceId}`)

      // Invalidate price caches for the deleted symbol
      cacheService.invalidateSymbolPrices(deletedPrice.symbol)
    } catch (error) {
      console.error('Error in deleteUserSymbolPrice:', error)
      throw error
    }
  }
}

// Singleton instance
export const transactionService = new TransactionService()