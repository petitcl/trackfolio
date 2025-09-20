import type { AuthUser } from '@/lib/auth/client.auth.service'
import type { Transaction, Symbol } from '@/lib/supabase/types'
import { historicalPriceService } from './historical-price.service'
import { unifiedCalculationService } from './unified-calculation.service'
import type { SupportedCurrency } from './currency.service'

export interface PortfolioPosition {
  symbol: string
  quantity: number
  avgCost: number
  currentPrice: number
  value: number
  unrealizedPnL: number
  isCustom: boolean
  dividendIncome: number // Track total dividend income received as cash
}

/**
 * Service responsible for portfolio calculations
 * Handles position calculations, asset allocations, and portfolio valuations
 */
export class PortfolioCalculationService {

  /**
   * Calculate positions from a list of transactions with current prices
   * This async version delegates to unified calculation service for consistency
   */
  async calculatePositionsFromTransactionsAsync(
    transactions: Transaction[],
    symbols: Symbol[],
    user: AuthUser,
    targetCurrency: SupportedCurrency = 'USD'
  ): Promise<PortfolioPosition[]> {
    // Delegate to unified calculation service for consistent logic
    return await unifiedCalculationService.calculateCurrentPositions(
      transactions,
      symbols,
      user,
      targetCurrency
    )
  }


  /**
   * Calculate portfolio value for positions on a specific date
   * Returns null if any symbol lacks historical price data
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
}

// Singleton instance
export const portfolioCalculationService = new PortfolioCalculationService()