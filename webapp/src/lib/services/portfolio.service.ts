import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import { clientAuthService } from '@/lib/auth/client.auth.service'
import type { Transaction, Symbol, Database } from '@/lib/supabase/database.types'
import { 
  mockSymbolPriceHistory,
  type HistoricalDataPoint 
} from '@/lib/mockData'
import { getClientMockDataStore } from '@/lib/mockDataStoreClient'

// Currency conversion rate (mocked for now - in production would come from API)
const USD_TO_EUR_RATE = 0.85

export interface PortfolioPosition {
  symbol: string
  quantity: number
  avgCost: number
  currentPrice: number
  value: number
  unrealizedPnL: number
  isCustom: boolean
}

export interface PortfolioData {
  totalValue: number
  cashBalance: number
  positions: PortfolioPosition[]
  dailyChange: {
    value: number
    percentage: number
  }
  totalPnL: {
    realized: number
    unrealized: number
    total: number
  }
}

export class PortfolioService {
  private supabase = createClient()

  /**
   * Standardized error handling for service methods
   */
  private handleError<T>(operation: string, error: unknown, fallback: T): T {
    console.error(`Error ${operation}:`, error)
    return fallback
  }

  async getPortfolioData(user: AuthUser): Promise<PortfolioData> {
    console.log('🔄 Fetching portfolio data for user:', user.email)
    
    try {
      // Fetch transactions to calculate positions
      const transactions = await this.getTransactions(user)
      const symbols = await this.getSymbols(user)
      
      if (transactions.length === 0) {
        console.log('📈 No transactions found for user, returning empty portfolio')
        return this.getEmptyPortfolio()
      }

      // Calculate positions from transactions
      const positions = this.calculatePositionsFromTransactions(transactions, symbols)
      
      // Calculate totals
      const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0)
      const totalUnrealizedPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0)
      
      // Get cash balance (sum of all cash transactions)
      const cashTransactions = transactions.filter(t => t.symbol === 'CASH')
      const cashBalance = cashTransactions.reduce((sum, t) => {
        const sign = ['deposit', 'dividend', 'bonus'].includes(t.type) ? 1 : -1
        return sum + (t.quantity * t.price_per_unit * sign)
      }, 0)

      return {
        totalValue: totalValue + cashBalance,
        cashBalance,
        positions,
        dailyChange: {
          value: 0, // TODO: Calculate from historical data
          percentage: 0
        },
        totalPnL: {
          realized: 0, // TODO: Calculate from sell transactions
          unrealized: totalUnrealizedPnL,
          total: totalUnrealizedPnL
        }
      }
    } catch (error) {
      return this.handleError('fetching portfolio data', error, this.getEmptyPortfolio())
    }
  }

  async getSymbols(user: AuthUser): Promise<Symbol[]> {
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
  }

  async getTransactions(user: AuthUser): Promise<Transaction[]> {
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
  }

  async getHistoricalData(user: AuthUser): Promise<HistoricalDataPoint[]> {
    console.log('📊 Building historical data for user')
    return await this.buildHistoricalData(user)
  }

  async getHoldingHistoricalData(user: AuthUser, symbol: string): Promise<HistoricalDataPoint[]> {
    console.log('📊 Building holding historical data for:', symbol)
    return await this.buildHoldingHistoricalData(user, symbol)
  }

  async getHoldingTransactions(user: AuthUser, symbol: string): Promise<Transaction[]> {
    const allTransactions = await this.getTransactions(user)
    return allTransactions.filter(t => t.symbol === symbol)
  }


  private calculatePositionsFromTransactions(transactions: Transaction[], symbols: Symbol[]): PortfolioPosition[] {
    const positionMap = new Map<string, PortfolioPosition>()

    // Process transactions to build positions
    transactions
      .filter(t => t.symbol !== 'CASH') // Exclude cash transactions
      .forEach(transaction => {
        const symbol = transaction.symbol
        const existing = positionMap.get(symbol)
        const symbolData = symbols.find(s => s.symbol === symbol)

        if (transaction.type === 'buy') {
          if (existing) {
            // Add to existing position
            const totalCost = (existing.avgCost * existing.quantity) + (transaction.quantity * transaction.price_per_unit)
            const totalQuantity = existing.quantity + transaction.quantity
            
            existing.quantity = totalQuantity
            existing.avgCost = totalCost / totalQuantity
          } else {
            // Create new position
            positionMap.set(symbol, {
              symbol,
              quantity: transaction.quantity,
              avgCost: transaction.price_per_unit,
              currentPrice: symbolData?.last_price || transaction.price_per_unit,
              value: 0, // Will be calculated below
              unrealizedPnL: 0, // Will be calculated below
              isCustom: symbolData?.is_custom || false
            })
          }
        } else if (transaction.type === 'sell' && existing) {
          // Reduce position
          existing.quantity -= transaction.quantity
          if (existing.quantity <= 0) {
            positionMap.delete(symbol)
          }
        }
      })

    // Calculate current values and P&L
    const positions = Array.from(positionMap.values()).map(position => {
      position.value = position.quantity * position.currentPrice
      position.unrealizedPnL = position.value - (position.quantity * position.avgCost)
      return position
    })

    return positions
  }

  /**
   * Fetch historical prices for a given symbol and date range
   * Uses mock data for demo users, Supabase for real users
   */
  private async fetchHistoricalPrices(symbol: string): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>()
    
    if (clientAuthService.isCurrentUserMock()) {
      // Use mock price history for mock users
      mockSymbolPriceHistory
        .filter(p => p.symbol === symbol)
        .forEach(p => priceMap.set(p.date, Number(p.close_price)))
    } else {
      // Fetch all historical prices from Supabase for real users
      const { data: historicalPrices = [] } = await this.supabase
        .from('symbol_price_history')
        .select('date, close_price')
        .eq('symbol', symbol)
      
      historicalPrices.forEach(p => priceMap.set(p.date, Number(p.close_price)))
    }
    
    return priceMap
  }

  /**
   * Get historical price for a symbol on a specific date
   * Finds the latest price <= the given date
   */
  private getHistoricalPriceForDate(symbol: string, date: string, fallbackPrice: number): number {
    if (clientAuthService.isCurrentUserMock()) {
      const relevantPrices = mockSymbolPriceHistory
        .filter(p => p.symbol === symbol && p.date <= date)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      return relevantPrices.length > 0 ? relevantPrices[0].close_price : fallbackPrice
    } else {
      // TODO: Implement historical price fetching for real users
      return fallbackPrice
    }
  }

  /**
   * Calculate portfolio value for positions on a specific date
   */
  private calculatePortfolioValueForDate(positions: PortfolioPosition[], date: string): number {
    let totalValue = 0
    for (const position of positions) {
      const historicalPrice = this.getHistoricalPriceForDate(position.symbol, date, position.currentPrice)
      totalValue += position.quantity * historicalPrice
    }
    return totalValue
  }

  /**
   * Calculate asset type allocations for positions on a specific date
   */
  private calculateAssetTypeAllocations(positions: PortfolioPosition[], symbols: Symbol[], date: string, cashBalance: number): Record<string, number> {
    const assetTypeValues: Record<string, number> = {
      stock: 0,
      etf: 0,
      crypto: 0,
      real_estate: 0,
      other: 0,
      cash: cashBalance
    }
    
    positions.forEach(position => {
      const symbol = symbols.find(s => s.symbol === position.symbol)
      const assetType = symbol?.asset_type || 'other'
      const historicalPrice = this.getHistoricalPriceForDate(position.symbol, date, position.currentPrice)
      const historicalValue = position.quantity * historicalPrice
      assetTypeValues[assetType] += historicalValue
    })
    
    const totalPortfolioValue = Object.values(assetTypeValues).reduce((sum, value) => sum + value, 0)
    const assetTypeAllocations: Record<string, number> = {}
    
    if (totalPortfolioValue > 0) {
      Object.keys(assetTypeValues).forEach(assetType => {
        assetTypeAllocations[assetType] = (assetTypeValues[assetType] / totalPortfolioValue) * 100
      })
    }
    
    return assetTypeAllocations
  }

  /**
   * Calculate cash balance up to a specific date
   */
  private calculateCashBalanceForDate(transactions: Transaction[], date: string): number {
    const cashTransactions = transactions.filter(t => t.symbol === 'CASH' && t.date <= date)
    return cashTransactions.reduce((sum, t) => {
      const sign = ['deposit', 'dividend', 'bonus'].includes(t.type) ? 1 : -1
      return sum + (t.quantity * t.price_per_unit * sign)
    }, 0)
  }

  /**
   * Calculate cumulative invested amount up to a specific date
   * This includes all money put into the portfolio (purchases, deposits, fees)
   */
  private calculateCumulativeInvestedForDate(transactions: Transaction[], date: string): number {
    const investmentTransactions = transactions.filter(t => t.date <= date)
    
    return investmentTransactions.reduce((sum, t) => {
      if (t.type === 'buy') {
        // Money going in: purchase + fees
        return sum + (t.quantity * t.price_per_unit) + (t.fees || 0)
      } else if (t.type === 'sell') {
        // Money coming out: reduce invested amount by original cost basis
        // Note: This is simplified - ideally we'd track the actual cost basis of sold shares
        return sum - (t.quantity * t.price_per_unit) + (t.fees || 0)
      } else if (t.type === 'deposit') {
        // Cash deposits
        return sum + (t.quantity * t.price_per_unit)
      } else if (t.type === 'withdrawal') {
        // Cash withdrawals
        return sum - (t.quantity * t.price_per_unit)
      }
      // Dividends and bonuses don't count as "invested" money
      return sum
    }, 0)
  }

  private async buildHistoricalData(user: AuthUser): Promise<HistoricalDataPoint[]> {
    try {
      const transactions = await this.getTransactions(user)
      const symbols = await this.getSymbols(user)
      
      if (transactions.length === 0) {
        console.log('📈 No transactions found, returning empty historical data')
        return []
      }

      // Get date range from first transaction to now
      const sortedTransactions = transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      const startDate = new Date(sortedTransactions[0].date)
      const endDate = new Date()
      
      const historicalData: HistoricalDataPoint[] = []
      
      // Build data points for each day from historical data
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const currentDate = d.toISOString().split('T')[0]
        
        // Get transactions up to this date
        const transactionsUpToDate = sortedTransactions.filter(t => t.date <= currentDate)
        
        // Calculate positions as of this date
        const positions = this.calculatePositionsFromTransactions(transactionsUpToDate, symbols)
        
        // Calculate values for this date
        const totalValue = this.calculatePortfolioValueForDate(positions, currentDate)
        const cashBalance = this.calculateCashBalanceForDate(sortedTransactions, currentDate)
        const totalPortfolioValue = totalValue + cashBalance
        const cumulativeInvested = this.calculateCumulativeInvestedForDate(sortedTransactions, currentDate)
        
        // Calculate asset allocations
        const assetTypeAllocations = this.calculateAssetTypeAllocations(positions, symbols, currentDate, cashBalance)
        
        // Calculate returns (simplified - using total portfolio growth)
        const initialValue = historicalData[0]?.totalValue || totalPortfolioValue
        const portfolioReturn = initialValue > 0 ? (totalPortfolioValue - initialValue) / initialValue : 0
        
        const assetTypeReturns: Record<string, number> = {
          stock: portfolioReturn * 0.4,   // TODO: Calculate actual returns per asset type
          etf: portfolioReturn * 0.3,
          crypto: portfolioReturn * 0.2,
          real_estate: portfolioReturn * 0.08,
          other: portfolioReturn * 0.02
        }
        
        historicalData.push({
          date: currentDate,
          totalValue: totalPortfolioValue,
          assetTypeAllocations,
          assetTypeReturns,
          costBasis: cumulativeInvested
        })
      }
      
      console.log(`📊 Built ${historicalData.length} historical data points from transactions`)
      return historicalData
      
    } catch (error) {
      return this.handleError('building historical data', error, [])
    }
  }

  private async buildHoldingHistoricalData(user: AuthUser, symbol: string): Promise<HistoricalDataPoint[]> {
    try {
      const transactions = await this.getHoldingTransactions(user, symbol)
      const symbols = await this.getSymbols(user)
      const symbolData = symbols.find(s => s.symbol === symbol)
  
      if (transactions.length === 0) {
        console.log('📈 No transactions found for holding:', symbol)
        return []
      }
  
      // Fetch historical prices using unified function
      const priceMap = await this.fetchHistoricalPrices(symbol)
  
      // Date range
      const sortedTransactions = transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      const startDate = new Date(sortedTransactions[0].date)
      const endDate = new Date()
  
      const historicalData: HistoricalDataPoint[] = []
      let cumulativeQuantity = 0
      let totalCost = 0
  
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const currentDate = d.toISOString().split('T')[0]
  
        // Apply transactions up to this date
        const transactionsUpToDate = sortedTransactions.filter(t => t.date <= currentDate)
        cumulativeQuantity = 0
        totalCost = 0
  
        transactionsUpToDate.forEach(transaction => {
          if (transaction.type === 'buy') {
            cumulativeQuantity += transaction.quantity
            totalCost += transaction.quantity * transaction.price_per_unit
          } else if (transaction.type === 'sell') {
            const avgCost = cumulativeQuantity > 0 ? totalCost / cumulativeQuantity : 0
            cumulativeQuantity -= transaction.quantity
            totalCost = Math.max(0, cumulativeQuantity * avgCost)
          } else if (transaction.type === 'bonus') {
            cumulativeQuantity += transaction.quantity
          }
        })
  
        if (cumulativeQuantity <= 0) continue
  
        // Get price from historical data - skip if not available
        const historicalPrice = priceMap.get(currentDate)
        if (!historicalPrice) {
          continue // Skip dates without real historical price data
        }
        const adjustedPrice = historicalPrice
  
        const currentValue = cumulativeQuantity * adjustedPrice
  
        const dataPoint: HistoricalDataPoint & { costBasis: number } = {
          date: currentDate,
          totalValue: currentValue * USD_TO_EUR_RATE,
          assetTypeAllocations: { [symbolData?.asset_type || 'other']: 100 },
          assetTypeReturns: { [symbolData?.asset_type || 'other']: totalCost > 0 ? (currentValue - totalCost) / totalCost : 0 },
          costBasis: totalCost * USD_TO_EUR_RATE
        }
  
        historicalData.push(dataPoint)
      }
  
      console.log(`📊 Built ${historicalData.length} historical data points for holding from transactions:`, symbol)
      return historicalData
  
    } catch (error) {
      return this.handleError('building holding historical data', error, [])
    }
  }
  
  private getEmptyPortfolio(): PortfolioData {
    return {
      totalValue: 0,
      cashBalance: 0,
      positions: [],
      dailyChange: { value: 0, percentage: 0 },
      totalPnL: { realized: 0, unrealized: 0, total: 0 }
    }
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
          updated_at: new Date().toISOString()
        } as Symbol
      }

      // For custom symbols, check if it exists first
      const { data: existingSymbol, error: fetchError } = await this.supabase
        .from('symbols')
        .select('*')
        .eq('symbol', symbolData.symbol.toUpperCase())
        .eq('created_by_user_id', symbolData.created_by_user_id)
        .single()
      
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
   * Add a new transaction (buy/sell/etc)
   */
  async addTransaction(transactionData: {
    user_id: string
    symbol: string
    type: Database["public"]["Enums"]["transaction_type"]
    quantity: number
    price_per_unit: number
    date: string
    notes?: string | null
    fees?: number
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
   * Add a new holding (creates symbol if needed and adds buy transaction)
   */
  async addHolding(user: AuthUser, holdingData: {
    symbol: string
    name: string
    assetType: Database["public"]["Enums"]["asset_type"]
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
        is_custom: holdingData.isCustom,
        created_by_user_id: holdingData.isCustom ? user.id : null,
        last_price: holdingData.purchasePrice
      })
      
      if (!symbol) {
        return { success: false, error: 'Failed to create or get symbol' }
      }
      
      // Add the buy transaction
      const transaction = await this.addTransaction({
        user_id: user.id,
        symbol: holdingData.symbol,
        type: 'buy',
        quantity: holdingData.quantity,
        price_per_unit: holdingData.purchasePrice,
        date: holdingData.purchaseDate,
        notes: holdingData.notes
      })
      
      if (!transaction) {
        return { success: false, error: 'Failed to add transaction' }
      }
      
      return { success: true }
    } catch (error) {
      console.error('Error adding holding:', error)
      return { success: false, error: 'An unexpected error occurred' }
    }
  }

}

// Singleton instance
export const portfolioService = new PortfolioService()