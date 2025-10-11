import type { AuthUser } from '@/lib/auth/client.auth.service'
import type { Transaction, Symbol } from '@/lib/supabase/types'
import type { HistoricalDataPoint } from '@/lib/mockData'
import { historicalPriceService } from './historical-price.service'
import { currencyService, type SupportedCurrency } from './currency.service'

export interface PortfolioPosition {
  symbol: string
  quantity: number
  avgCost: number
  currentPrice: number
  value: number
  isCustom: boolean
  dividendIncome: number
}

interface UnifiedPosition {
  symbol: string
  quantity: number
  avgCost: number
  // totalAmount: number
  totalCost: number
  dividendIncome: number
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
    targetSymbol: string | undefined,
    allSymbols: Symbol[],
    includeClosedPositions?: boolean,
  ): UnifiedPosition[] {
    // For single holdings, include closed positions to continue tracking after liquidation
    // For portfolio, exclude closed positions by default unless explicitly requested
    const shouldIncludeClosedPositions = includeClosedPositions !== undefined ? includeClosedPositions : !!targetSymbol
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
        avgCost: 0,
        totalAmount: 0,
        totalCost: 0,
        dividendIncome: 0
      }

      if (transaction.type === 'buy') {
        existing.quantity += transaction.quantity
        existing.totalCost += transaction.quantity * transaction.price_per_unit
        existing.avgCost = existing.quantity > 0 ? existing.totalCost / existing.quantity : 0
      } else if (transaction.type === 'sell' ) {
        existing.quantity -= transaction.quantity
        if (existing.quantity <= 0) {
          if (!shouldIncludeClosedPositions) {
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
      } else if (transaction.type === 'deposit') {
        // Deposit adds to cost basis without changing quantity
        // This represents cash added to the position (e.g., cash account deposit)
        existing.totalCost += (transaction.amount || 0)
        // avgCost remains unchanged - deposit doesn't affect cost per unit
      } else if (transaction.type === 'withdrawal') {
        // Withdrawal reduces cost basis without changing quantity
        // This represents cash removed from the position (e.g., cash account withdrawal)
        existing.totalCost -= (transaction.amount || 0)
        // Prevent negative cost basis
        existing.totalCost = Math.max(0, existing.totalCost)
        // avgCost remains unchanged - withdrawal doesn't affect cost per unit
      } else if (transaction.type === 'dividend') {
        // Dividends can be either:
        // 1. Cash dividends (amount > 0, quantity = 0) - tracked as income
        // 2. Stock dividends/DRIP (quantity > 0) - adds shares to position
        if (transaction.quantity > 0) {
          // Stock dividend - add shares (like bonus shares)
          existing.quantity += transaction.quantity
          existing.totalCost += transaction.quantity * transaction.price_per_unit
          existing.avgCost = existing.quantity > 0 ? existing.totalCost / existing.quantity : 0
        } else {
          // Cash dividend - track as income
          existing.dividendIncome += (transaction.amount || 0)
        }
      } else if (transaction.type === 'bonus') {
        // Reinvested dividend or bonus shares - add to position
        existing.quantity += transaction.quantity
        existing.totalCost += transaction.quantity * transaction.price_per_unit
        existing.avgCost = existing.quantity > 0 ? existing.totalCost / existing.quantity : 0
      }

      const symbolData = allSymbols.find(s => s.symbol == symbol)!
      const isAccount = symbolData?.holding_type === 'account'
      if (existing.quantity > 0 || isAccount || (shouldIncludeClosedPositions && existing.quantity === 0)) {
        positionMap.set(symbol, existing)
      }
      // if (symbol == 'BINANCE') {
      //   console.log({
      //     isAccount,
      //     symbol,
      //     existing,
      //     added: positionMap.get(symbol),
      //   })
      // }
    })

    return Array.from(positionMap.values())
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
      const positions = this.calculatePositionsUpToDate(transactions, currentDate, targetSymbol, symbols)
      
      if (positions.length === 0) {
        continue
      }

      // Calculate total value and asset allocations
      let totalValue = 0
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

      // Process all positions in parallel
      const positionResults = await Promise.all(positions.map(async (position) => {
        const symbolPriceMap = priceMapCache.get(position.symbol)
        const historicalPrice = await this.getUnifiedHistoricalPrice(
          position.symbol,
          currentDate,
          user,
          symbols,
          symbolPriceMap
        )

        const symbolData = symbols.find(s => s.symbol === position.symbol)
        const symbolCurrency = symbolData?.currency
        const fromCurrency = (symbolCurrency || 'USD') as SupportedCurrency

        const result = {
          costBasis: position.totalCost,
          dividendIncome: position.dividendIncome,
          validPrice: false,
          positionValue: 0,
          convertedPositionValue: 0,
          convertedDividendIncome: 0,
          assetType: symbolData?.asset_type || 'other',
          isTargetSymbol: targetSymbol === position.symbol
        }

        if (historicalPrice !== null) {
          result.validPrice = true

          // For account holdings, historicalPrice IS the account balance
          // For regular holdings, positionValue = quantity × price
          let positionValue: number
          if (symbolData?.holding_type === 'account') {
            // Account holdings: historicalPrice stores the full account balance
            // (not a per-unit price), so use it directly as the position value
            positionValue = historicalPrice
          } else {
            // Regular holdings: value = quantity × price
            positionValue = position.quantity * historicalPrice
          }

          result.positionValue = positionValue

          // Add console warning for implicit USD fallback
          if (!symbolCurrency) {
            console.warn(`⚠️  Symbol ${position.symbol} has no currency specified, implicitly treating as USD`)
          }

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
          result.convertedPositionValue = convertedPositionValue
        }

        // Convert dividend income to target currency
        if (position.dividendIncome > 0) {
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
          result.convertedDividendIncome = convertedDividendIncome
        }

        return result
      }))

      // Aggregate results
      for (const result of positionResults) {
        totalCostBasis += result.costBasis
        totalDividendIncome += result.dividendIncome

        if (result.validPrice) {
          validPriceCount++
          totalValue += result.positionValue
          convertedTotalValue += result.convertedPositionValue

          if (result.isTargetSymbol) {
            convertedTargetSymbolValue = result.convertedPositionValue
          }

          // if (result.assetType == "crypto") {
          //   console.log({
          //     result,
          //     assetTypeValues,
          //     convertedAssetTypeValues,
          //   })  
          // }

          // Use converted values for asset type tracking to ensure consistency with totalValue
          assetTypeValues[result.assetType] += result.convertedPositionValue
          convertedAssetTypeValues[result.assetType] += result.convertedPositionValue
        }

        convertedTotalDividendIncome += result.convertedDividendIncome
      }

      // Skip this date only if we have no valid prices at all
      if (validPriceCount === 0) {
        continue
      }

      // Convert cost basis using symbol currency (not transaction currency)
      // Note: We use symbol.currency instead of transaction.currency for simplicity.
      // This assumes all transactions for a symbol are in the symbol's base currency,
      // which is the most common case and avoids complex per-transaction currency tracking.

      // Process cost basis conversions in parallel
      const costBasisResults = await Promise.all(positions.map(async (position) => {
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

        return convertedPositionCostBasis
      }))

      const convertedCostBasis = costBasisResults.reduce((sum, value) => sum + value, 0)

      // Calculate allocations using converted total value for consistency
      const assetTypeAllocations: Record<string, number> = {}
      if (convertedTotalValue > 0) {
        for (const [assetType, value] of Object.entries(assetTypeValues)) {
          assetTypeAllocations[assetType] = (value / convertedTotalValue) * 100
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
      // DO NOT add dividends to totalValue - track them separately
      // This prevents double-counting since dividends are either:
      // - Withdrawn (not part of portfolio value)
      // - Reinvested as new positions (already counted in market value)
      const finalTotalValue = targetSymbol
        ? convertedTargetSymbolValue
        : convertedTotalValue

      historicalData.push({
        date: currentDate,
        totalValue: finalTotalValue,
        assetTypeAllocations,
        assetTypeValues: convertedAssetTypeValues,
        costBasis: convertedCostBasis,
        cumulativeDividends: convertedTotalDividendIncome
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
    includeClosedPositions: boolean = false,
    explicitPositions?: Array<{ symbol: string }> // Optional: positions without transactions
  ): Promise<PortfolioPosition[]> {
    const currentDate = new Date().toISOString().split('T')[0]

    // Calculate positions as of current date from transactions
    const unifiedPositions = this.calculatePositionsUpToDate(transactions, currentDate, undefined, symbols, includeClosedPositions)

    // Add positions that exist but have no transactions (quantity = 0)
    if (explicitPositions) {
      const transactionSymbols = new Set(unifiedPositions.map(p => p.symbol))

      for (const position of explicitPositions) {
        if (!transactionSymbols.has(position.symbol)) {
          // Add position with zero quantity - it exists but has no transactions yet
          unifiedPositions.push({
            symbol: position.symbol,
            quantity: 0,
            totalCost: 0,
            avgCost: 0,
            dividendIncome: 0
          })
        }
      }
    }

    if (unifiedPositions.length === 0) {
      return []
    }

    // Convert to PortfolioPosition format with current prices - process in parallel
    const portfolioPositions = await Promise.all(unifiedPositions.map(async (position) => {
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
      // For account holdings, the "price" is actually the full account balance
      let value: number
      if (symbolData?.holding_type === 'account') {
        // Account holdings: finalCurrentPrice IS the account balance (already converted)
        // Don't multiply by quantity (which is 0 for accounts)
        value = convertedCurrentPrice
      } else {
        // Regular holdings: value = quantity × price
        value = position.quantity * convertedCurrentPrice
      }

      return {
        symbol: position.symbol,
        quantity: position.quantity,
        avgCost: position.avgCost,
        currentPrice: convertedCurrentPrice,
        value: value, // Dividend income NOT included here
        isCustom: symbolData?.is_custom || false,
        dividendIncome: convertedDividendIncome // Tracked separately
      }
    }))

    return portfolioPositions
  }

}

// Singleton instance
export const unifiedCalculationService = new UnifiedCalculationService()