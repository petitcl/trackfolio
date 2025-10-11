import type { AuthUser } from '@/lib/auth/client.auth.service'
import type { Transaction, Symbol } from '@/lib/supabase/types'
import type { HistoricalDataPoint } from '@/lib/mockData'
import { unifiedCalculationService } from './unified-calculation.service'
import type { SupportedCurrency } from './currency.service'
import { getGroupByTimePeriodForTimeRange, getStartDateForTimeRange, getTimePeriodBucketsForTimePeriod, type TimeRange } from '../utils/timeranges'
import { cacheService } from './cache.service'

/**
 * Service responsible for generating historical data time series
 * Unifies logic between portfolio and individual holding calculations
 */
export class HistoricalDataService {

  /**
   * Standardized error handling for service methods
   */
  private handleError<T>(operation: string, error: unknown, fallback: T): T {
    console.error(`Error ${operation}:`, error)
    return fallback
  }

  /**
   * Unified method to build historical data for portfolio or individual holdings
   * Now uses the unified calculation engine to ensure consistent results
   * CACHED: Results are cached per user/symbol/currency to avoid expensive recalculations
   */
  async buildHistoricalData(
    user: AuthUser,
    transactions: Transaction[],
    symbols: Symbol[],
    targetCurrency: SupportedCurrency = 'USD',
    options?: {
      symbol?: string // If provided, calculates for single holding only
      useSimplePriceLookup?: boolean // Legacy option, now ignored (unified approach)
    }
  ): Promise<HistoricalDataPoint[]> {
    try {
      const { symbol: targetSymbol } = options || {}

      // Generate cache key based on user, symbol (or 'portfolio'), and currency
      const cacheKey = targetSymbol
        ? cacheService.Keys.holdingHistoricalData(user.id, targetSymbol, targetCurrency)
        : cacheService.Keys.historicalData(user.id, targetCurrency)

      // Use cache with 5 minute TTL for portfolio-level calculations (expensive)
      return await cacheService.getOrFetch(
        cacheKey,
        async () => {
          console.log(`📊 Building ${targetSymbol ? `holding data for ${targetSymbol}` : 'portfolio data'} using unified calculation engine`)

          // Use the unified calculation service for consistent results
          return await unifiedCalculationService.calculateUnifiedHistoricalData(
            user,
            transactions,
            symbols,
            {
              targetSymbol,
              targetCurrency // Pass the target currency
            }
          )
        },
        cacheService.getTTL('portfolio') // 5 minute TTL
      )

    } catch (error) {
      return this.handleError('building historical data', error, [])
    }
  }

  /**
   * Filter historical data based on time range
   */
  filterDataByTimeRange(data: HistoricalDataPoint[], range: TimeRange): HistoricalDataPoint[] {
    const startDate: Date = getStartDateForTimeRange(range)

    return data.filter(point => new Date(point.date) >= startDate)
  }

  /**
   * Aggregate historical data points based on time range to avoid too many bars
   */
  aggregateDataByTimeRange(data: HistoricalDataPoint[], range: TimeRange): HistoricalDataPoint[] {
    if (data.length === 0) return data
    
    const groupByPeriod = getGroupByTimePeriodForTimeRange(range)

    // First, determine all time periods that should be displayed
    const startDate = new Date(data[0].date)
    const endDate = new Date(data[data.length - 1].date)

    const allPeriods = getTimePeriodBucketsForTimePeriod(startDate, endDate, groupByPeriod)
    
    // Group data points by time period
    const grouped = new Map<string, HistoricalDataPoint[]>()
    
    data.forEach(point => {
      const date = new Date(point.date)
      let key: string
      
      switch (groupByPeriod) {
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
        const assetTypes = ['stock', 'crypto', 'real_estate', 'cash', 'currency', 'other']
        
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

  /**
   * Get historical data with time range filtering and aggregation
   */
  async getHistoricalDataByTimeRange(
    user: AuthUser,
    transactions: Transaction[],
    symbols: Symbol[],
    timeRange: TimeRange,
    targetCurrency: SupportedCurrency = 'USD',
    options?: { symbol?: string; useSimplePriceLookup?: boolean }
  ): Promise<HistoricalDataPoint[]> {
    try {
      console.log('📊 Getting historical data for time range:', timeRange)
      
      // Get full historical data
      const fullHistoricalData = await this.buildHistoricalData(user, transactions, symbols, targetCurrency, options)
      
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
}

// Singleton instance
export const historicalDataService = new HistoricalDataService()