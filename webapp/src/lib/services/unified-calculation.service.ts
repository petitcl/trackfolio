import type { AuthUser } from '@/lib/auth/client.auth.service'
import type { Transaction, Symbol } from '@/lib/supabase/types'
import type { HistoricalDataPoint } from '@/lib/mockData'
import { historicalPriceService } from './historical-price.service'
import { currencyService, type SupportedCurrency } from './currency.service'
import { returnCalculationService } from './return-calculation.service'
import { historicalDataService } from './historical-data.service'

export interface PortfolioPosition {
  symbol: string
  quantity: number
  avgCost: number
  currentPrice: number
  value: number
  unrealizedPnL: number
  realizedPnL: number // Track realized gains/losses from sales and dividends
  realizedCostBasis: number // Track total cost basis for realized positions (for percentage calculation)
  isCustom: boolean
  dividendIncome: number // Track total dividend income received as cash
}

interface UnifiedPosition {
  symbol: string
  quantity: number
  totalCost: number
  avgCost: number
  dividendIncome: number  // Track total dividend income received as cash
}

/**
 * Unified calculation engine that ensures consistent results
 * between portfolio and individual holding calculations
 */
export class UnifiedCalculationService {

  /**
   * Unified method to calculate positions from transactions
   * Uses consistent logic for both portfolio and individual holdings
   */
  private calculatePositionsUpToDate(
    transactions: Transaction[],
    date: string,
    targetSymbol?: string,
    includeClosedPositions: boolean = false
  ): UnifiedPosition[] {
    // Filter transactions up to date and optionally by symbol
    const relevantTransactions = transactions
      .filter(t => t.date <= date)
      .filter(t => !targetSymbol || t.symbol === targetSymbol)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const positionMap = new Map<string, UnifiedPosition>()

    relevantTransactions.forEach(transaction => {
      const symbol = transaction.symbol
      const existing = positionMap.get(symbol) || {
        symbol,
        quantity: 0,
        totalCost: 0,
        avgCost: 0,
        dividendIncome: 0
      }

      if (transaction.type === 'buy' || transaction.type === 'deposit') {
        existing.quantity += transaction.quantity
        existing.totalCost += transaction.quantity * transaction.price_per_unit
        existing.avgCost = existing.quantity > 0 ? existing.totalCost / existing.quantity : 0
      } else if (transaction.type === 'sell' || transaction.type === 'withdrawal') {
        existing.quantity -= transaction.quantity
        if (existing.quantity <= 0) {
          if (!includeClosedPositions) {
            positionMap.delete(symbol)
            return
          }
          // For closed positions, preserve data but reset cost basis
          existing.totalCost = 0
          existing.avgCost = 0
        } else {
          // Maintain cost basis proportionally
          existing.totalCost = existing.quantity * existing.avgCost
        }
      } else if (transaction.type === 'dividend') {
        existing.dividendIncome += (transaction.amount || 0)
      } else if (transaction.type === 'bonus') {
        // Reinvested dividend or bonus shares - add to position
        existing.quantity += transaction.quantity
        existing.totalCost += transaction.quantity * transaction.price_per_unit
        existing.avgCost = existing.quantity > 0 ? existing.totalCost / existing.quantity : 0
      }

      if (existing.quantity > 0 || (includeClosedPositions && existing.quantity === 0)) {
        positionMap.set(symbol, existing)
      }
    })

    return Array.from(positionMap.values())
  }

  /**
   * Calculate realized P&L and cost basis for a specific symbol
   * Uses the return calculation service to get accurate realized gains/losses
   */
  private async calculateRealizedPnLForSymbol(
    symbol: string,
    transactions: Transaction[],
    symbols: Symbol[],
    user: AuthUser,
    targetCurrency: SupportedCurrency
  ): Promise<{ realizedPnL: number; costBasis: number }> {
    try {
      // Filter transactions for this symbol only
      const symbolTransactions = transactions.filter(t => t.symbol === symbol)

      if (symbolTransactions.length === 0) {
        return { realizedPnL: 0, costBasis: 0 }
      }

      // Build historical data for this symbol (needed for return calculation)
      const historicalData = await historicalDataService.buildHistoricalData(
        user,
        symbolTransactions,
        symbols,
        targetCurrency,
        { symbol, useSimplePriceLookup: true }
      )

      if (historicalData.length < 2) {
        return { realizedPnL: 0, costBasis: 0 }
      }

      // Calculate portfolio summary which includes realized P&L
      const summary = returnCalculationService.calculatePortfolioSummaryV2(
        symbolTransactions,
        historicalData
      )

      // Calculate total cost basis from all buy transactions
      const totalCostBasis = symbolTransactions
        .filter(t => t.type === 'buy' || t.type === 'deposit')
        .reduce((sum, t) => sum + (t.quantity * t.price_per_unit + (t.fees || 0)), 0)

      // Return realized P&L + dividends (both are "realized" income) and cost basis
      return {
        realizedPnL: summary.realizedPnL + summary.dividends,
        costBasis: totalCostBasis
      }

    } catch (error) {
      console.warn(`Failed to calculate realized P&L for ${symbol}:`, error)
      return { realizedPnL: 0, costBasis: 0 }
    }
  }

  /**
   * Unified method to get historical price for any symbol
   * Uses consistent logic and fallback strategy
   */
  private async getUnifiedHistoricalPrice(
    symbol: string,
    date: string,
    user: AuthUser,
    symbols: Symbol[],
    priceMap?: Map<string, number>
  ): Promise<number | null> {
    // Try price map lookup first (for performance) with latest-price-before-date logic
    if (priceMap) {
      // Find the latest price <= the given date (same logic as historicalPriceService)
      let latestPrice: number | null = null
      let latestDate = ''
      
      for (const [priceDate, price] of priceMap.entries()) {
        if (priceDate <= date && priceDate > latestDate) {
          latestDate = priceDate
          latestPrice = price
        }
      }
      
      if (latestPrice !== null) {
        return latestPrice
      }
    }

    // Fall back to complex lookup (handles custom symbols, user prices, etc.)
    const symbolData = symbols.find(s => s.symbol === symbol) || null
    return await historicalPriceService.getHistoricalPriceForDate(
      symbol,
      date,
      user,
      symbolData
    )
  }


  /**
   * Unified historical data calculation for both portfolio and individual holdings
   * This replaces both portfolio and holding-specific calculations
   */
  async calculateUnifiedHistoricalData(
    user: AuthUser,
    transactions: Transaction[],
    symbols: Symbol[],
    options?: {
      targetSymbol?: string // If provided, calculates for single holding only
      targetCurrency?: SupportedCurrency // Target currency for conversion (defaults to USD)
    }
  ): Promise<HistoricalDataPoint[]> {
    const { targetSymbol, targetCurrency = 'USD' } = options || {}
    
    if (transactions.length === 0) {
      return []
    }

    // Pre-fetch price maps for all relevant symbols to ensure consistent price coverage
    const priceMapCache = new Map<string, Map<string, number>>()
    
    if (targetSymbol) {
      // For single holding, only fetch prices for that symbol
      priceMapCache.set(targetSymbol, await historicalPriceService.fetchHistoricalPrices(targetSymbol))
    } else {
      // For portfolio, pre-fetch prices for all symbols to avoid missing data
      const uniqueSymbols = [...new Set(transactions.map(t => t.symbol))]
      await Promise.all(
        uniqueSymbols.map(async symbol => {
          priceMapCache.set(symbol, await historicalPriceService.fetchHistoricalPrices(symbol))
        })
      )
    }

    // Get date range
    const sortedTransactions = transactions
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const startDate = new Date(sortedTransactions[0].date)
    const endDate = new Date()

    const historicalData: HistoricalDataPoint[] = []

    // Build data points for each day
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const currentDate = d.toISOString().split('T')[0]
      
      // Calculate positions as of this date
      // For single holdings, include closed positions to continue generating data after liquidation
      const positions = this.calculatePositionsUpToDate(transactions, currentDate, targetSymbol, !!targetSymbol)
      
      if (positions.length === 0) {
        continue
      }

      // Calculate total value and asset allocations
      let totalValue = 0
      let targetSymbolValue = 0 // Track individual holding value separately
      const assetTypeValues: Record<string, number> = {
        stock: 0,
        crypto: 0,
        real_estate: 0,
        cash: 0,
        currency: 0,
        other: 0
      }

      let totalCostBasis = 0
      let totalDividendIncome = 0
      let validPriceCount = 0

      // Track converted values per position to handle multi-currency portfolios correctly
      let convertedTotalValue = 0
      let convertedTargetSymbolValue = 0
      let convertedTotalDividendIncome = 0
      const convertedAssetTypeValues: Record<string, number> = {
        stock: 0,
        crypto: 0,
        real_estate: 0,
        cash: 0,
        currency: 0,
        other: 0
      }

      for (const position of positions) {
        const symbolPriceMap = priceMapCache.get(position.symbol)
        const historicalPrice = await this.getUnifiedHistoricalPrice(
          position.symbol,
          currentDate,
          user,
          symbols,
          symbolPriceMap
        )

        // Always include cost basis and dividend income for positions that exist on this date
        totalCostBasis += position.totalCost
        totalDividendIncome += position.dividendIncome

        if (historicalPrice !== null) {
          validPriceCount++
          const positionValue = position.quantity * historicalPrice
          
          // Get symbol currency and convert to target currency
          const symbolData = symbols.find(s => s.symbol === position.symbol)
          const symbolCurrency = symbolData?.currency
          
          // Add console warning for implicit USD fallback
          if (!symbolCurrency) {
            console.warn(`⚠️  Symbol ${position.symbol} has no currency specified, implicitly treating as USD`)
          }
          
          const fromCurrency = (symbolCurrency || 'USD') as SupportedCurrency
          
          let convertedPositionValue = positionValue
          if (fromCurrency !== targetCurrency) {
            try {
              const conversionRate = await currencyService.getExchangeRate(fromCurrency, targetCurrency, user, symbols, currentDate)
              convertedPositionValue = positionValue * conversionRate
            } catch (error) {
              console.warn(`Failed to get exchange rate from ${fromCurrency} to ${targetCurrency} on ${currentDate}, using rate 1:`, error)
              convertedPositionValue = positionValue
            }
          }

          totalValue += positionValue  // Keep for allocation calculations (in original currencies)
          convertedTotalValue += convertedPositionValue

          // Track target symbol value separately
          if (targetSymbol && position.symbol === targetSymbol) {
            targetSymbolValue = positionValue // Original currency for allocation calculation
            convertedTargetSymbolValue = convertedPositionValue
          }

          // Add to asset type allocation (use converted values)
          const assetType = symbolData?.asset_type || 'other'
          assetTypeValues[assetType] += positionValue // For allocation % calculation
          convertedAssetTypeValues[assetType] += convertedPositionValue
        }
        
        // Convert dividend income to target currency
        if (position.dividendIncome > 0) {
          const symbolData = symbols.find(s => s.symbol === position.symbol)
          const symbolCurrency = symbolData?.currency
          const fromCurrency = (symbolCurrency || 'USD') as SupportedCurrency
          
          let convertedDividendIncome = position.dividendIncome
          if (fromCurrency !== targetCurrency) {
            try {
              const conversionRate = await currencyService.getExchangeRate(fromCurrency, targetCurrency, user, symbols, currentDate)
              convertedDividendIncome = position.dividendIncome * conversionRate
            } catch (error) {
              console.warn(`Failed to convert dividend income from ${fromCurrency} to ${targetCurrency} for ${position.symbol} on ${currentDate}, using rate 1:`, error)
              convertedDividendIncome = position.dividendIncome
            }
          }
          
          convertedTotalDividendIncome += convertedDividendIncome
        }
        
        // If no price found, the position still contributes to cost basis
        // but contributes zero to market value - this shows realistic P&L
      }

      // Skip this date only if we have no valid prices at all
      if (validPriceCount === 0) {
        continue
      }

      // Convert cost basis using symbol currency (not transaction currency)
      // Note: We use symbol.currency instead of transaction.currency for simplicity.
      // This assumes all transactions for a symbol are in the symbol's base currency,
      // which is the most common case and avoids complex per-transaction currency tracking.
      let convertedCostBasis = 0
      
      for (const position of positions) {
        const symbolData = symbols.find(s => s.symbol === position.symbol)
        const symbolCurrency = symbolData?.currency
        
        // Add console warning for implicit USD fallback on cost basis
        if (!symbolCurrency) {
          console.warn(`⚠️  Cost basis for symbol ${position.symbol} has no currency specified, implicitly treating as USD`)
        }
        
        const fromCurrency = (symbolCurrency || 'USD') as SupportedCurrency
        
        let convertedPositionCostBasis = position.totalCost
        if (fromCurrency !== targetCurrency) {
          try {
            const costBasisConversionRate = await currencyService.getExchangeRate(fromCurrency, targetCurrency, user, symbols, currentDate)
            convertedPositionCostBasis = position.totalCost * costBasisConversionRate
          } catch (error) {
            console.warn(`Failed to convert cost basis from ${fromCurrency} to ${targetCurrency} for ${position.symbol} on ${currentDate}, using rate 1:`, error)
            convertedPositionCostBasis = position.totalCost
          }
        }
        
        convertedCostBasis += convertedPositionCostBasis
      }

      // Calculate allocations
      const assetTypeAllocations: Record<string, number> = {}
      if (totalValue > 0) {
        for (const [assetType, value] of Object.entries(assetTypeValues)) {
          assetTypeAllocations[assetType] = (value / totalValue) * 100
        }
      }

      // For single holdings, set allocation to 100% for that asset type
      if (targetSymbol && positions.length === 1) {
        const symbolData = symbols.find(s => s.symbol === targetSymbol)
        const assetType = symbolData?.asset_type || 'other'
        
        // Reset allocations and set to 100% for this asset type
        Object.keys(assetTypeAllocations).forEach(key => {
          assetTypeAllocations[key] = 0
        })
        assetTypeAllocations[assetType] = 100

        // Reset values to only this asset type using the converted holding value
        Object.keys(convertedAssetTypeValues).forEach(key => {
          convertedAssetTypeValues[key] = 0
        })
        convertedAssetTypeValues[assetType] = convertedTargetSymbolValue
      }

      // For single holdings, use the individual holding value instead of total portfolio value
      // Add dividend income to the total value (this represents cash dividends received)
      const finalTotalValue = targetSymbol 
        ? convertedTargetSymbolValue + convertedTotalDividendIncome 
        : convertedTotalValue + convertedTotalDividendIncome
      
      historicalData.push({
        date: currentDate,
        totalValue: finalTotalValue,
        assetTypeAllocations,
        assetTypeValues: convertedAssetTypeValues,
        costBasis: convertedCostBasis
      })
    }

    return historicalData
  }

  /**
   * Calculate current positions using unified logic
   * Returns PortfolioPosition format for compatibility
   */
  async calculateCurrentPositions(
    transactions: Transaction[],
    symbols: Symbol[],
    user: AuthUser,
    targetCurrency: SupportedCurrency = 'USD',
    includeClosedPositions: boolean = false
  ): Promise<PortfolioPosition[]> {
    const currentDate = new Date().toISOString().split('T')[0]

    // Calculate positions as of current date
    const unifiedPositions = this.calculatePositionsUpToDate(transactions, currentDate, undefined, includeClosedPositions)

    if (unifiedPositions.length === 0) {
      return []
    }

    // Convert to PortfolioPosition format with current prices
    const portfolioPositions: PortfolioPosition[] = []

    for (const position of unifiedPositions) {
      const symbolData = symbols.find(s => s.symbol === position.symbol)

      // Get current price - handle custom vs market symbols differently
      let finalCurrentPrice: number = 0

      if (symbolData?.is_custom) {
        // For custom symbols, always use historical price service to get latest manual price
        const historicalPrice = await this.getUnifiedHistoricalPrice(
          position.symbol,
          currentDate,
          user,
          symbols
        )
        finalCurrentPrice = historicalPrice || position.avgCost
      } else {
        // For market symbols, prioritize symbol's last_price (current market price)
        finalCurrentPrice = symbolData?.last_price || 0

        // Fallback to historical price if no last_price available
        if (!finalCurrentPrice) {
          const historicalPrice = await this.getUnifiedHistoricalPrice(
            position.symbol,
            currentDate,
            user,
            symbols
          )
          finalCurrentPrice = historicalPrice || position.avgCost
        }
      }

      // Convert to target currency if needed
      const symbolCurrency = (symbolData?.currency || 'USD') as SupportedCurrency
      let convertedCurrentPrice = finalCurrentPrice
      let convertedDividendIncome = position.dividendIncome

      if (symbolCurrency !== targetCurrency) {
        try {
          const conversionRate = await currencyService.getExchangeRate(
            symbolCurrency,
            targetCurrency,
            user,
            symbols,
            currentDate
          )
          convertedCurrentPrice = finalCurrentPrice * conversionRate
          convertedDividendIncome = position.dividendIncome * conversionRate
        } catch (error) {
          console.warn(`Failed to convert ${position.symbol} from ${symbolCurrency} to ${targetCurrency}:`, error)
        }
      }

      // Calculate value WITHOUT dividend income (as per user's requirement)
      const value = position.quantity * convertedCurrentPrice
      const unrealizedPnL = value - (position.quantity * position.avgCost)

      // Calculate realized P&L for this symbol (includes realized gains + dividends)
      let realizedPnL = 0
      let realizedCostBasis = 0
      if (includeClosedPositions || position.quantity === 0) {
        const realizedData = await this.calculateRealizedPnLForSymbol(
          position.symbol,
          transactions,
          symbols,
          user,
          targetCurrency
        )
        realizedPnL = realizedData.realizedPnL
        realizedCostBasis = realizedData.costBasis
      }

      portfolioPositions.push({
        symbol: position.symbol,
        quantity: position.quantity,
        avgCost: position.avgCost,
        currentPrice: convertedCurrentPrice,
        value: value, // Dividend income NOT included here
        unrealizedPnL: unrealizedPnL,
        realizedPnL: realizedPnL,
        realizedCostBasis: realizedCostBasis,
        isCustom: symbolData?.is_custom || false,
        dividendIncome: convertedDividendIncome // Tracked separately
      })
    }

    return portfolioPositions
  }

  /**
   * Calculate cumulative invested amount up to a specific date
   * This includes all money put into the portfolio (purchases, deposits, fees)
   */
  calculateCumulativeInvestedForDate(transactions: Transaction[], date: string): number {
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

  /**
   * Calculate portfolio value for positions on a specific date
   * Returns null if any symbol lacks historical price data
   *
   * Note: This method is available for backward compatibility but the recommended
   * approach is to use calculateUnifiedHistoricalData() for comprehensive results
   */
  async calculatePortfolioValueForDate(
    positions: PortfolioPosition[],
    date: string,
    user: AuthUser,
    symbols: Symbol[]
  ): Promise<number | null> {
    let totalValue = 0
    for (const position of positions) {
      const symbolData = symbols.find(s => s.symbol === position.symbol) || null
      const historicalPrice = await historicalPriceService.getHistoricalPriceForDate(
        position.symbol,
        date,
        user,
        symbolData
      )

      // If ANY symbol lacks historical data, skip the entire date
      if (historicalPrice === null) {
        return null
      }

      totalValue += position.quantity * historicalPrice
    }
    return totalValue
  }

  /**
   * Calculate asset type allocations for positions on a specific date
   * Returns null if any symbol lacks historical price data
   *
   * Note: This method is available for backward compatibility but the recommended
   * approach is to use calculateUnifiedHistoricalData() for comprehensive results
   */
  async calculateAssetTypeAllocations(
    positions: PortfolioPosition[],
    symbols: Symbol[],
    date: string,
    user: AuthUser
  ): Promise<{ allocations: Record<string, number>; values: Record<string, number> } | null> {
    const assetTypeValues: Record<string, number> = {
      stock: 0,
      crypto: 0,
      real_estate: 0,
      cash: 0,
      currency: 0,
      other: 0
    }

    for (const position of positions) {
      const symbolData = symbols.find(s => s.symbol === position.symbol)
      const assetType = symbolData?.asset_type || 'other'
      const historicalPrice = await historicalPriceService.getHistoricalPriceForDate(
        position.symbol,
        date,
        user,
        symbolData || null
      )

      // If ANY symbol lacks historical data, skip the entire date
      if (historicalPrice === null) {
        return null
      }

      const historicalValue = position.quantity * historicalPrice
      assetTypeValues[assetType] += historicalValue
    }

    const totalPortfolioValue = Object.values(assetTypeValues).reduce((sum, value) => (sum || 0) + (value || 0), 0)
    const assetTypeAllocations: Record<string, number> = {}

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
}

// Singleton instance
export const unifiedCalculationService = new UnifiedCalculationService()