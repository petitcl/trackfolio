import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import { clientAuthService } from '@/lib/auth/client.auth.service'
import type { Transaction, Symbol, Database, UserSymbolPrice, TransactionType } from '@/lib/supabase/types'
import { 
  mockSymbolPriceHistory,
  type HistoricalDataPoint 
} from '@/lib/mockData'
import type { TimeRange } from '@/components/TimeRangeSelector'
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
  private historicalPriceCache = new Map<string, Map<string, number>>()
  private userCustomPriceCache = new Map<string, Map<string, Map<string, number>>>()

  /**
   * Standardized error handling for service methods
   */
  private handleError<T>(operation: string, error: unknown, fallback: T): T {
    console.error(`Error ${operation}:`, error)
    return fallback
  }

  /**
   * Clear historical price cache (useful for testing or when data changes)
   */
  clearHistoricalPriceCache(): void {
    this.historicalPriceCache.clear()
    this.userCustomPriceCache.clear()
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

  async getPortfolioHistoricalData(user: AuthUser): Promise<HistoricalDataPoint[]> {
    console.log('📊 Building portfolio historical data for user')
    return await this.buildPortfolioHistoricalData(user)
  }

  async getPortfolioHistoricalDataByTimeRange(user: AuthUser, timeRange: TimeRange): Promise<HistoricalDataPoint[]> {
    try {
      console.log('📊 Getting portfolio historical data for time range:', timeRange)
      
      // Get full historical data
      const fullHistoricalData = await this.getPortfolioHistoricalData(user)
      
      if (fullHistoricalData.length === 0) {
        console.log('📊 No historical data available')
        return []
      }
      
      // Apply time-based filtering
      const filteredData = this.filterDataByTimeRange(fullHistoricalData, timeRange)
      
      // Apply aggregation based on time range
      const aggregatedData = this.aggregateDataByTimeRange(filteredData, timeRange)
      
      console.log(`📊 Processed historical data: ${fullHistoricalData.length} → ${filteredData.length} → ${aggregatedData.length} points`)
      return aggregatedData
      
    } catch (error) {
      console.error('❌ Error getting historical data by time range:', error)
      return []
    }
  }

  async getHoldingHistoricalData(user: AuthUser, symbol: string): Promise<HistoricalDataPoint[]> {
    console.log('📊 Building holding historical data for:', symbol)
    return await this.buildHoldingHistoricalData(user, symbol)
  }

  async getHoldingTransactions(user: AuthUser, symbol: string): Promise<Transaction[]> {
    const allTransactions = await this.getTransactions(user)
    return allTransactions.filter(t => t.symbol === symbol)
  }

  async getPortfolioRepartitionData(user: AuthUser, date?: string): Promise<Array<{ 
    assetType: string; 
    value: number; 
    percentage: number 
  }>> {
    try {
      console.log('📊 Getting portfolio repartition data for user:', user.email, 'date:', date || 'current')
      
      // Get historical data (which includes both allocations and values)
      const historicalData = await this.getPortfolioHistoricalData(user)
      
      if (historicalData.length === 0) {
        console.log('📊 No historical data available')
        return []
      }
      
      // Find the data point for the target date, or use the last available point
      const targetDate = date || new Date().toISOString().split('T')[0]
      let targetDataPoint = historicalData.find(point => point.date === targetDate)
      
      // If no exact date match, use the last available point (most current data)
      if (!targetDataPoint) {
        targetDataPoint = historicalData[historicalData.length - 1]
        console.log(`📊 Using last available data point: ${targetDataPoint.date} (requested: ${targetDate})`)
      }
      
      // Convert to chart format using both values and percentages from historical data
      const result = Object.entries(targetDataPoint.assetTypeAllocations)
        .filter(([_, percentage]) => percentage > 0)
        .map(([assetType, percentage]) => ({
          assetType,
          value: targetDataPoint.assetTypeValues[assetType] || 0,
          percentage
        }))
      
      console.log('📊 Portfolio repartition from historical data:', result.length, 'asset types')
      return result
      
    } catch (error) {
      console.error('❌ Error getting portfolio repartition data:', error)
      return []
    }
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
      
      historicalPrices?.forEach(p => priceMap.set(p.date, Number(p.close_price)))
    }
    
    return priceMap
  }

  /**
   * Get historical price for a symbol on a specific date
   * Finds the latest price <= the given date
   * Supports both market symbols (symbol_price_history) and custom symbols (user_symbol_prices)
   */
  private async getHistoricalPriceForDate(
    symbol: string, 
    date: string, 
    fallbackPrice: number,
    user: AuthUser,
    symbolData: Symbol | null
  ): Promise<number> {
    const upperSymbol = symbol.toUpperCase()
    
    if (clientAuthService.isCurrentUserMock()) {
      const relevantPrices = mockSymbolPriceHistory
        .filter(p => p.symbol === upperSymbol && p.date <= date)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      return relevantPrices.length > 0 ? relevantPrices[0].close_price : fallbackPrice
    } else {
      // Handle custom symbols - they use user_symbol_prices
      if (symbolData?.is_custom === true) {
        return await this.getCustomSymbolHistoricalPrice(upperSymbol, date, fallbackPrice, user)
      }
      
      // Handle regular market symbols - use symbol_price_history
      return await this.getMarketSymbolHistoricalPrice(upperSymbol, date, fallbackPrice)
    }
  }

  /**
   * Get historical price for custom symbols from user_symbol_prices table
   */
  private async getCustomSymbolHistoricalPrice(
    symbol: string,
    date: string,
    fallbackPrice: number,
    user: AuthUser
  ): Promise<number> {
    // Check cache first
    let userCache = this.userCustomPriceCache.get(user.id)
    if (!userCache) {
      userCache = new Map()
      this.userCustomPriceCache.set(user.id, userCache)
    }
    
    let symbolPriceMap = userCache.get(symbol)
    
    if (!symbolPriceMap) {
      // Cache miss - fetch all user manual prices for this symbol
      try {
        const { data: userPrices = [], error } = await this.supabase
          .from('user_symbol_prices')
          .select('price_date, manual_price')
          .eq('user_id', user.id)
          .eq('symbol', symbol)
          .order('price_date', { ascending: true })
        
        if (error) {
          console.warn(`Failed to fetch user prices for custom symbol ${symbol}:`, error)
          return fallbackPrice
        }
        
        symbolPriceMap = new Map()
        userPrices.forEach(p => {
          const price = Number(p.manual_price)
          if (!isNaN(price) && price > 0) {
            symbolPriceMap!.set(p.price_date, price)
          }
        })
        userCache.set(symbol, symbolPriceMap)
        
        if (symbolPriceMap.size === 0) {
          console.warn(`No manual prices found for custom symbol ${symbol}`)
          return fallbackPrice
        }
      } catch (error) {
        console.error(`Error fetching user prices for custom symbol ${symbol}:`, error)
        return fallbackPrice
      }
    }
    
    // Find the latest price <= the given date
    let latestPrice = fallbackPrice
    let latestDate = ''
    
    for (const [priceDate, price] of symbolPriceMap.entries()) {
      if (priceDate <= date && priceDate > latestDate) {
        latestDate = priceDate
        latestPrice = price
      }
    }
    
    return latestPrice
  }

  /**
   * Get historical price for market symbols from symbol_price_history table
   */
  private async getMarketSymbolHistoricalPrice(
    symbol: string,
    date: string,
    fallbackPrice: number
  ): Promise<number> {
    // Check cache first
    let symbolPriceMap = this.historicalPriceCache.get(symbol)
    
    if (!symbolPriceMap) {
      // Cache miss - fetch all historical prices for this symbol
      try {
        const { data: allPrices = [], error } = await this.supabase
          .from('symbol_price_history')
          .select('date, close_price')
          .eq('symbol', symbol)
          .order('date', { ascending: true })
        
        if (error) {
          console.warn(`Failed to fetch historical prices for ${symbol}:`, error)
          return fallbackPrice
        }
        
        symbolPriceMap = new Map()
        allPrices.forEach(p => {
          const price = Number(p.close_price)
          if (!isNaN(price) && price > 0) {
            symbolPriceMap!.set(p.date, price)
          }
        })
        this.historicalPriceCache.set(symbol, symbolPriceMap)
        
        if (symbolPriceMap.size === 0) {
          console.warn(`No valid historical prices found for ${symbol}`)
          return fallbackPrice
        }
      } catch (error) {
        console.error(`Error fetching historical prices for ${symbol}:`, error)
        return fallbackPrice
      }
    }
    
    // Find the latest price <= the given date
    let latestPrice = fallbackPrice
    let latestDate = ''
    
    for (const [priceDate, price] of symbolPriceMap.entries()) {
      if (priceDate <= date && priceDate > latestDate) {
        latestDate = priceDate
        latestPrice = price
      }
    }
    
    return latestPrice
  }

  /**
   * Calculate portfolio value for positions on a specific date
   */
  private async calculatePortfolioValueForDate(
    positions: PortfolioPosition[], 
    date: string, 
    user: AuthUser, 
    symbols: Symbol[]
  ): Promise<number> {
    let totalValue = 0
    for (const position of positions) {
      const symbolData = symbols.find(s => s.symbol === position.symbol) || null
      const historicalPrice = await this.getHistoricalPriceForDate(
        position.symbol, 
        date, 
        position.currentPrice, 
        user, 
        symbolData
      )
      totalValue += position.quantity * historicalPrice
    }
    return totalValue
  }

  /**
   * Calculate asset type allocations for positions on a specific date
   */
  private async calculateAssetTypeAllocations(
    positions: PortfolioPosition[], 
    symbols: Symbol[], 
    date: string, 
    cashBalance: number, 
    user: AuthUser
  ): Promise<{ allocations: Record<string, number>; values: Record<string, number> }> {
    const assetTypeValues: Record<string, number> = {
      stock: 0,
      etf: 0,
      crypto: 0,
      real_estate: 0,
      cash: cashBalance,
      currency: 0,
      other: 0
    }
    
    for (const position of positions) {
      const symbolData = symbols.find(s => s.symbol === position.symbol)
      const assetType = symbolData?.asset_type || 'other'
      const historicalPrice = await this.getHistoricalPriceForDate(
        position.symbol, 
        date, 
        position.currentPrice, 
        user, 
        symbolData || null
      )
      // console.log("calculateAssetTypeAllocations", "fetched historicalPrice", "symbol=", position.symbol, "date=", date, "price=", historicalPrice, "quantity=", position.quantity);
      const historicalValue = position.quantity * historicalPrice
      assetTypeValues[assetType] += historicalValue
    }
    
    const totalPortfolioValue = Object.values(assetTypeValues).reduce((sum, value) => (sum || 0) + (value || 0), 0)
    const assetTypeAllocations: Record<string, number> = {}

    // console.log("calculateAssetTypeAllocations", "date=", date, totalPortfolioValue, assetTypeValues)
    
    if (totalPortfolioValue > 0) {
      Object.keys(assetTypeValues).forEach(assetType => {
        assetTypeAllocations[assetType] = (assetTypeValues[assetType] / totalPortfolioValue) * 100
      })
    }

    return {
      allocations: assetTypeAllocations,
      values: assetTypeValues
    }
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

  private async buildPortfolioHistoricalData(user: AuthUser): Promise<HistoricalDataPoint[]> {
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
        const totalValue = await this.calculatePortfolioValueForDate(positions, currentDate, user, symbols)
        const cashBalance = this.calculateCashBalanceForDate(sortedTransactions, currentDate)
        const totalPortfolioValue = totalValue + cashBalance
        const cumulativeInvested = this.calculateCumulativeInvestedForDate(sortedTransactions, currentDate)

        // Calculate asset allocations
        const { allocations: assetTypeAllocations, values: assetTypeValues } = await this.calculateAssetTypeAllocations(positions, symbols, currentDate, cashBalance, user)
        
        historicalData.push({
          date: currentDate,
          totalValue: totalPortfolioValue,
          assetTypeAllocations,
          assetTypeValues,
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
          // Skip dates without real historical price data
          continue
        }
        const adjustedPrice = historicalPrice
  
        const currentValue = cumulativeQuantity * adjustedPrice
  
        const dataPoint: HistoricalDataPoint & { costBasis: number } = {
          date: currentDate,
          totalValue: currentValue * USD_TO_EUR_RATE,
          assetTypeAllocations: { [symbolData?.asset_type || 'other']: 100 },
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
   * Add a new transaction (buy/sell/etc) - supports both real and demo users
   */
  async addTransactionForUser(user: AuthUser, transactionData: {
    symbol: string
    type: Database["public"]["Enums"]["transaction_type"]
    quantity: number
    pricePerUnit: number
    date: string
    notes?: string | null
    fees?: number
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
          currency: transactionData.currency,
          broker: transactionData.broker,
          notes: transactionData.notes
        })
        
        console.log('✅ Added transaction to mock data store:', transaction.id)
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
          currency: transactionData.currency,
          broker: transactionData.broker
        })
        
        if (!transaction) {
          return { success: false, error: 'Failed to add transaction to database' }
        }
        
        console.log('✅ Added transaction to database:', transaction.id)
        return { success: true, transaction }
      }
    } catch (error) {
      console.error('Error adding transaction:', error)
      return { success: false, error: 'An unexpected error occurred' }
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
          currency: transactionData.currency,
          broker: transactionData.broker,
          notes: transactionData.notes
        })
        
        if (!success) {
          return { success: false, error: 'Transaction not found' }
        }
        
        console.log('✅ Updated transaction in mock data store:', transactionId)
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
        return { success: true }
      }
    } catch (error) {
      console.error('Error deleting transaction:', error)
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
    } catch (error) {
      console.error('Error in updateUserSymbolPrice:', error)
      throw error
    }
  }

  /**
   * Update a transaction
   */
  async updateTransaction(user: AuthUser, transactionId: string, transactionData: {
    symbol: string
    type: TransactionType
    quantity: number
    pricePerUnit: number
    date: string
    fees: number
    currency?: string
    broker?: string
    notes?: string
  }): Promise<void> {
    // For demo users, update in mock data store
    if (user.isDemo) {
      await getClientMockDataStore().updateTransaction(transactionId, {
        type: transactionData.type as any,
        quantity: transactionData.quantity,
        pricePerUnit: transactionData.pricePerUnit,
        date: transactionData.date,
        fees: transactionData.fees,
        currency: transactionData.currency || 'USD',
        broker: transactionData.broker,
        notes: transactionData.notes
      })
      return
    }

    try {
      const { error } = await this.supabase
        .from('transactions')
        .update({
          type: transactionData.type,
          quantity: transactionData.quantity,
          price_per_unit: transactionData.pricePerUnit,
          date: transactionData.date,
          fees: transactionData.fees,
          currency: transactionData.currency || 'USD',
          broker: transactionData.broker,
          notes: transactionData.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', transactionId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error updating transaction:', error)
        throw new Error('Failed to update transaction')
      }

      console.log(`✅ Updated transaction ${transactionId}`)
    } catch (error) {
      console.error('Error in updateTransaction:', error)
      throw error
    }
  }

  /**
   * Delete a transaction
   */
  async deleteTransaction(user: AuthUser, transactionId: string): Promise<void> {
    // For demo users, delete from mock data store
    if (user.isDemo) {
      const success = getClientMockDataStore().deleteTransaction(transactionId)
      if (!success) {
        throw new Error('Transaction not found')
      }
      return
    }

    try {
      const { error } = await this.supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error deleting transaction:', error)
        throw new Error('Failed to delete transaction')
      }

      console.log(`✅ Deleted transaction ${transactionId}`)
    } catch (error) {
      console.error('Error in deleteTransaction:', error)
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
    } catch (error) {
      console.error('Error in deleteUserSymbolPrice:', error)
      throw error
    }
  }

  /**
   * Filter historical data based on time range
   */
  private filterDataByTimeRange(data: HistoricalDataPoint[], range: TimeRange): HistoricalDataPoint[] {
    const now = new Date()
    let startDate: Date
    
    switch (range) {
      case '5d':
        startDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
        break
      case '1m':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '6m':
        startDate = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000)
        break
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      case '5y':
        startDate = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000)
        break
      case 'all':
      default:
        return data
    }
    
    return data.filter(point => new Date(point.date) >= startDate)
  }

  /**
   * Aggregate historical data points based on time range to avoid too many bars
   */
  private aggregateDataByTimeRange(data: HistoricalDataPoint[], range: TimeRange): HistoricalDataPoint[] {
    if (data.length === 0) return data
    
    let groupBy: 'day' | 'week' | 'month' | 'quarter' | 'year'
    
    switch (range) {
      case '5d':
        groupBy = 'day'
        break
      case '1m':
        groupBy = 'week'
        break
      case '6m':
      case 'ytd':
      case '1y':
        groupBy = 'month'
        break
      case '5y':
        groupBy = 'quarter'
        break
      case 'all':
      default:
        groupBy = 'year'
        break
    }
    
    // First, determine all time periods that should be displayed
    const startDate = new Date(data[0].date)
    const endDate = new Date(data[data.length - 1].date)
    const allPeriods = new Set<string>()
    
    // Generate all periods between start and end date
    for (let d = new Date(startDate); d <= endDate; ) {
      let key: string
      
      switch (groupBy) {
        case 'day':
          key = d.toISOString().split('T')[0]
          d.setDate(d.getDate() + 1)
          break
        case 'week':
          const weekStart = new Date(d)
          weekStart.setDate(d.getDate() - d.getDay())
          key = weekStart.toISOString().split('T')[0]
          d.setDate(d.getDate() + 7)
          break
        case 'month':
          key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          d.setMonth(d.getMonth() + 1)
          break
        case 'quarter':
          key = `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`
          d.setMonth(d.getMonth() + 3)
          break
        case 'year':
          key = `${d.getFullYear()}`
          d.setFullYear(d.getFullYear() + 1)
          break
      }
      
      allPeriods.add(key)
    }
    
    // Group data points by time period
    const grouped = new Map<string, HistoricalDataPoint[]>()
    
    data.forEach(point => {
      const date = new Date(point.date)
      let key: string
      
      switch (groupBy) {
        case 'day':
          key = date.toISOString().split('T')[0]
          break
        case 'week':
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          key = weekStart.toISOString().split('T')[0]
          break
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          break
        case 'quarter':
          key = `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`
          break
        case 'year':
          key = `${date.getFullYear()}`
          break
      }
      
      // Collect all points in each period
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(point)
    })
    
    // For each period, calculate the allocations or use the last known allocation
    const aggregatedData: HistoricalDataPoint[] = []
    let lastKnownAllocations: Record<string, number> | null = null
    let lastKnownValues: Record<string, number> | null = null
    let lastKnownValue = 0
    
    // Sort periods chronologically
    const sortedPeriods = Array.from(allPeriods).sort()
    
    sortedPeriods.forEach(periodKey => {
      const points = grouped.get(periodKey)
      
      if (points && points.length > 0) {
        // We have data for this period
        const lastPoint = points[points.length - 1]
        
        // Calculate average allocations and values across all points in the period
        const avgAllocations: Record<string, number> = {}
        const avgValues: Record<string, number> = {}
        const assetTypes = ['stock', 'etf', 'crypto', 'real_estate', 'cash', 'currency', 'other']
        
        assetTypes.forEach(assetType => {
          const totalAllocations = points.reduce((sum, p) => {
            const allocation = p.assetTypeAllocations?.[assetType] || 0
            return sum + allocation
          }, 0)
          const totalValues = points.reduce((sum, p) => {
            const value = p.assetTypeValues?.[assetType] || 0
            return sum + value
          }, 0)
          avgAllocations[assetType] = totalAllocations / points.length
          avgValues[assetType] = totalValues / points.length
        })
        
        // Ensure allocations sum to 100%
        const totalAllocation = Object.values(avgAllocations).reduce((sum, val) => sum + val, 0)
        if (totalAllocation > 0 && Math.abs(totalAllocation - 100) > 0.01) {
          // Normalize allocations to sum to 100%
          Object.keys(avgAllocations).forEach(key => {
            avgAllocations[key] = (avgAllocations[key] / totalAllocation) * 100
          })
        }
        
        lastKnownAllocations = avgAllocations
        lastKnownValues = avgValues
        lastKnownValue = lastPoint.totalValue
        
        aggregatedData.push({
          ...lastPoint,
          assetTypeAllocations: avgAllocations,
          assetTypeValues: avgValues
        })
      } else if (lastKnownAllocations && lastKnownValues) {
        // No data for this period, use last known allocation and values
        // Create a synthetic data point with the last known data
        let syntheticDate: string
        
        // Parse the period key to get a representative date
        if (periodKey.includes('-Q')) {
          // Quarter format: YYYY-Q#
          const [year, quarter] = periodKey.split('-Q')
          const month = (parseInt(quarter) - 1) * 3
          syntheticDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
        } else if (periodKey.includes('-')) {
          // Month format: YYYY-MM
          syntheticDate = `${periodKey}-01`
        } else {
          // Year format: YYYY
          syntheticDate = `${periodKey}-01-01`
        }
        
        aggregatedData.push({
          date: syntheticDate,
          totalValue: lastKnownValue,
          assetTypeAllocations: { ...lastKnownAllocations },
          assetTypeValues: { ...lastKnownValues },
          costBasis: 0
        })
      }
    })
    
    return aggregatedData.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  }

}

// Singleton instance
export const portfolioService = new PortfolioService()