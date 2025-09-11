import type { AuthUser } from '@/lib/auth/client.auth.service'
import type { Transaction, Symbol } from '@/lib/supabase/types'
import type { HistoricalDataPoint } from '@/lib/mockData'
import { historicalPriceService } from './historical-price.service'

// Currency conversion rate (mocked for now - in production would come from API)
const USD_TO_EUR_RATE = 0.85

interface UnifiedPosition {
  symbol: string
  quantity: number
  totalCost: number
  avgCost: number
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
    targetSymbol?: string
  ): UnifiedPosition[] {
    // Filter transactions up to date and optionally by symbol
    const relevantTransactions = transactions
      .filter(t => t.date <= date)
      .filter(t => t.symbol !== 'CASH') // Exclude cash
      .filter(t => !targetSymbol || t.symbol === targetSymbol)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const positionMap = new Map<string, UnifiedPosition>()

    relevantTransactions.forEach(transaction => {
      const symbol = transaction.symbol
      const existing = positionMap.get(symbol) || {
        symbol,
        quantity: 0,
        totalCost: 0,
        avgCost: 0
      }

      if (transaction.type === 'buy') {
        existing.quantity += transaction.quantity
        existing.totalCost += transaction.quantity * transaction.price_per_unit
        existing.avgCost = existing.quantity > 0 ? existing.totalCost / existing.quantity : 0
      } else if (transaction.type === 'sell') {
        existing.quantity -= transaction.quantity
        if (existing.quantity <= 0) {
          positionMap.delete(symbol)
          return
        }
        // Maintain cost basis proportionally
        existing.totalCost = existing.quantity * existing.avgCost
      } else if (transaction.type === 'bonus') {
        existing.quantity += transaction.quantity
        // No cost change for bonus shares
        existing.avgCost = existing.quantity > 0 ? existing.totalCost / existing.quantity : 0
      }

      if (existing.quantity > 0) {
        positionMap.set(symbol, existing)
      }
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
   * Calculate cash balance up to a specific date
   */
  private calculateCashBalance(transactions: Transaction[], date: string): number {
    const cashTransactions = transactions.filter(t => t.symbol === 'CASH' && t.date <= date)
    return cashTransactions.reduce((sum, t) => {
      const sign = ['deposit', 'dividend', 'bonus'].includes(t.type) ? 1 : -1
      return sum + (t.quantity * t.price_per_unit * sign)
    }, 0)
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
      applyCurrencyConversion?: boolean // Whether to apply USD_TO_EUR conversion
    }
  ): Promise<HistoricalDataPoint[]> {
    const { targetSymbol, applyCurrencyConversion = true } = options || {}
    
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
      const uniqueSymbols = [...new Set(transactions.map(t => t.symbol).filter(s => s !== 'CASH'))]
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
      const positions = this.calculatePositionsUpToDate(transactions, currentDate, targetSymbol)
      
      if (positions.length === 0) {
        continue
      }

      // Calculate total value and asset allocations
      let totalValue = 0
      const assetTypeValues: Record<string, number> = {
        stock: 0,
        etf: 0,
        crypto: 0,
        real_estate: 0,
        cash: 0,
        currency: 0,
        other: 0
      }

      let totalCostBasis = 0
      let validPriceCount = 0

      for (const position of positions) {
        const symbolPriceMap = priceMapCache.get(position.symbol)
        const historicalPrice = await this.getUnifiedHistoricalPrice(
          position.symbol,
          currentDate,
          user,
          symbols,
          symbolPriceMap
        )

        // Always include cost basis for positions that exist on this date
        totalCostBasis += position.totalCost

        if (historicalPrice !== null) {
          validPriceCount++
          const positionValue = position.quantity * historicalPrice
          totalValue += positionValue

          // Add to asset type allocation
          const symbolData = symbols.find(s => s.symbol === position.symbol)
          const assetType = symbolData?.asset_type || 'other'
          assetTypeValues[assetType] += positionValue
        }
        // If no price found, the position still contributes to cost basis
        // but contributes zero to market value - this shows realistic P&L
      }

      // Skip this date only if we have no valid prices at all
      if (validPriceCount === 0) {
        continue
      }

      // Add cash balance for portfolio calculations
      let cashBalance = 0
      if (!targetSymbol) {
        cashBalance = this.calculateCashBalance(transactions, currentDate)
        assetTypeValues.cash = cashBalance
        totalValue += cashBalance
      }

      // Apply currency conversion if requested
      const conversionRate = applyCurrencyConversion ? USD_TO_EUR_RATE : 1
      const convertedTotalValue = totalValue * conversionRate
      const convertedCostBasis = totalCostBasis * conversionRate

      // Convert asset type values
      const convertedAssetTypeValues: Record<string, number> = {}
      for (const [assetType, value] of Object.entries(assetTypeValues)) {
        convertedAssetTypeValues[assetType] = value * conversionRate
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

        // Reset values to only this asset type
        Object.keys(convertedAssetTypeValues).forEach(key => {
          convertedAssetTypeValues[key] = 0
        })
        convertedAssetTypeValues[assetType] = convertedTotalValue
      }

      historicalData.push({
        date: currentDate,
        totalValue: convertedTotalValue,
        assetTypeAllocations,
        assetTypeValues: convertedAssetTypeValues,
        costBasis: convertedCostBasis
      })
    }

    return historicalData
  }
}

// Singleton instance
export const unifiedCalculationService = new UnifiedCalculationService()