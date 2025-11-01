import type { AuthUser } from '@/lib/auth/client.auth.service'
import type { HistoricalDataPoint } from '@/lib/mockData'
import { historicalPriceService } from './historical-price.service'
import { portfolioCalculationService, type PortfolioPosition, type ReturnMetrics, type BucketedReturnMetrics } from './portfolio-calculation.service'
import { TransactionData, transactionService } from './transaction.service'
import { positionService } from './position.service'
import { type SupportedCurrency } from './currency.service'
import { getStartDateForTimeRange, type TimeRange } from '../utils/timeranges'

// Re-export types for external components
export type { PortfolioPosition, ReturnMetrics, BucketedReturnMetrics }

export interface PortfolioData {
  positions: PortfolioPosition[]
  returns: ReturnMetrics
}

/**
 * Main Portfolio Service - orchestrates other services
 */
export class PortfolioService {
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
    historicalPriceService.clearCache()
  }

  async getPortfolioData(user: AuthUser, targetCurrency: SupportedCurrency = 'USD', timeRange: TimeRange, includeClosedPositions: boolean = false): Promise<PortfolioData> {
    console.log('🔄 Fetching portfolio data: currency=', targetCurrency, ', timeRange=', timeRange, ', includeClosedPositions=', includeClosedPositions)

    try {
      // Fetch positions, transactions and symbols
      const positions = await positionService.getPositions(user)
      const transactions = await transactionService.getTransactions(user)
      const symbols = await transactionService.getSymbols(user)

      // Get unique symbols from both positions and transactions
      const positionSymbols = new Set(positions.map(p => p.symbol))
      const transactionSymbols = new Set(transactions.map(t => t.symbol))

      // Log warnings for transactions without positions (graceful fallback)
      transactions.forEach(tx => {
        if (!positionSymbols.has(tx.symbol)) {
          console.warn(`⚠️ Transaction found without position for symbol ${tx.symbol}. Treating as if position exists.`)
        }
      })

      // If no positions AND no transactions, return empty portfolio
      if (positions.length === 0 && transactions.length === 0) {
        console.log('📈 No positions or transactions found for user, returning empty portfolio')
        return this.getEmptyPortfolio()
      }

      let startDate: string | undefined
      if (timeRange && timeRange !== 'all') {
        const filterStartDate: Date = getStartDateForTimeRange(timeRange)

        startDate = filterStartDate.toISOString().split('T')[0]
      }

      // Calculate positions using portfolio calculation service (already in target currency)
      // This will include positions with transactions AND positions without transactions (treated as closed)
      const calculatedPositions = await portfolioCalculationService.calculateCurrentPositions(
        transactions,
        symbols,
        user,
        targetCurrency,
        includeClosedPositions,
        positions // Pass explicit positions to include those without transactions
      )

      // Calculate unified return metrics (always present, defaults to zeros if insufficient data)
      let returns: ReturnMetrics
      try {
        const historicalData = await portfolioCalculationService.calculateHistoricalData(user, transactions, symbols, targetCurrency)
        returns = portfolioCalculationService.calculatePortfolioReturnMetrics(
          transactions,
          historicalData,
          symbols,
          { startDate },
        )
      } catch (error) {
        console.warn('Could not calculate return metrics:', error)
        returns = portfolioCalculationService.getEmptyReturnMetrics()
      }

      return {
        positions: calculatedPositions,
        returns
      }
    } catch (error) {
      return this.handleError('fetching portfolio data', error, this.getEmptyPortfolio())
    }
  }

  // Delegate to transaction service
  async getSymbols(user: AuthUser) {
    return transactionService.getSymbols(user)
  }

  async getTransactions(user: AuthUser) {
    return transactionService.getTransactions(user)
  }

  async getPortfolioHistoricalData(user: AuthUser, targetCurrency: SupportedCurrency = 'USD'): Promise<HistoricalDataPoint[]> {
    console.log('📊 Building portfolio historical data for user')
    const transactions = await transactionService.getTransactions(user)
    const symbols = await transactionService.getSymbols(user)
    return await portfolioCalculationService.calculateHistoricalData(user, transactions, symbols, targetCurrency)
  }

  async getPortfolioHistoricalDataByTimeRange(user: AuthUser, timeRange: TimeRange, targetCurrency: SupportedCurrency = 'USD'): Promise<HistoricalDataPoint[]> {
    const transactions = await transactionService.getTransactions(user)
    const symbols = await transactionService.getSymbols(user)
    return await portfolioCalculationService.getHistoricalDataByTimeRange(user, transactions, symbols, timeRange, targetCurrency)
  }

  async getHoldingHistoricalData(user: AuthUser, symbol: string, targetCurrency: SupportedCurrency = 'USD'): Promise<HistoricalDataPoint[]> {
    console.log('📊 Building holding historical data for:', symbol)
    const transactions = await transactionService.getTransactions(user)
    const symbols = await transactionService.getSymbols(user)
    return await portfolioCalculationService.calculateHistoricalData(user, transactions, symbols, targetCurrency, {
      targetSymbol: symbol
    })
  }

  async getHoldingTransactions(user: AuthUser, symbol: string) {
    return transactionService.getHoldingTransactions(user, symbol)
  }

  async getHoldingReturnMetrics(user: AuthUser, symbol: string, targetCurrency: SupportedCurrency = 'USD', timeRange?: TimeRange): Promise<ReturnMetrics> {
    try {
      console.log('📊 Calculating detailed returns for holding:', symbol, 'timeRange:', timeRange)

      // Get data specific to this holding
      const [transactions, symbols, historicalData] = await Promise.all([
        transactionService.getHoldingTransactions(user, symbol),
        transactionService.getSymbols(user),
        this.getHoldingHistoricalData(user, symbol, targetCurrency)
      ])

      if (transactions.length === 0 || historicalData.length < 2) {
        console.log('📊 Insufficient data for detailed return calculation')
        return portfolioCalculationService.getEmptyReturnMetrics()
      }

      // Apply time range filter if specified
      let startDate: string | undefined
      if (timeRange && timeRange !== 'all') {
        const filterStartDate: Date = getStartDateForTimeRange(timeRange)

        startDate = filterStartDate.toISOString().split('T')[0]
      }

      // Calculate unified return metrics
      const returns = portfolioCalculationService.calculatePortfolioReturnMetrics(
        transactions,
        historicalData,
        symbols,
        { startDate }
      )

      return returns
    } catch (error) {
      console.error('❌ Error calculating holding detailed returns:', error)
      return portfolioCalculationService.getEmptyReturnMetrics()
    }
  }

  /**
   * Calculate return metrics for all symbols in the portfolio
   * Returns a map of symbol -> return metrics
   * OPTIMIZED: Processes symbols in parallel for faster initial load
   */
  async getReturnsMetricsByHolding(user: AuthUser, targetCurrency: SupportedCurrency = 'USD', timeRange?: TimeRange): Promise<Map<string, ReturnMetrics>> {
    const transactions = await transactionService.getTransactions(user)

    const symbols = new Set<string>()
    transactions.forEach(t => symbols.add(t.symbol))

    // Process all symbols in parallel instead of sequentially
    // This allows cache coordination via singleflight and faster I/O
    const symbolArray = Array.from(symbols)
    const metricsPromises = symbolArray.map(symbol =>
      this.getHoldingReturnMetrics(user, symbol, targetCurrency, timeRange)
        .then(metrics => ({ symbol, metrics }))
    )

    const results = await Promise.all(metricsPromises)

    // Convert array results to Map
    const metricsMap = new Map<string, ReturnMetrics>()
    results.forEach(({ symbol, metrics }) => {
      metricsMap.set(symbol, metrics)
    })

    return metricsMap
  }

  /**
   * Calculate bucketed return metrics for the entire portfolio
   * Returns performance info per sub-period "buckets" (e.g., yearly, monthly)
   */
  async getPortfolioBucketedReturnMetrics(user: AuthUser, timeRange: TimeRange, targetCurrency: SupportedCurrency = 'USD'): Promise<BucketedReturnMetrics> {
    try {
      console.log('📊 Calculating bucketed returns for portfolio: timeRange:', timeRange)

      const [transactions, symbols, historicalData] = await Promise.all([
        transactionService.getTransactions(user),
        transactionService.getSymbols(user),
        this.getPortfolioHistoricalData(user, targetCurrency)
      ])

      if (transactions.length === 0 || historicalData.length < 2) {
        console.log('📊 Insufficient data for bucketed return calculation')
        return {
          buckets: [],
          timePeriod: 'year',
          totalMetrics: portfolioCalculationService.getEmptyReturnMetrics()
        }
      }

      // Calculate bucketed return metrics
      return portfolioCalculationService.calculateBucketedPortfolioMetrics(
        transactions,
        historicalData,
        symbols,
        timeRange
      )
    } catch (error) {
      console.error('❌ Error calculating portfolio bucketed returns:', error)
      return {
        buckets: [],
        timePeriod: 'year',
        totalMetrics: portfolioCalculationService.getEmptyReturnMetrics()
      }
    }
  }

  /**
   * Calculate bucketed return metrics for a specific holding
   * Returns performance info per sub-period "buckets" for a single symbol
   */
  async getHoldingBucketedReturnMetrics(user: AuthUser, symbol: string, timeRange: TimeRange, targetCurrency: SupportedCurrency = 'USD'): Promise<BucketedReturnMetrics> {
    try {
      console.log('📊 Calculating bucketed returns for holding:', symbol, 'timeRange:', timeRange)

      const [transactions, symbols, historicalData] = await Promise.all([
        transactionService.getHoldingTransactions(user, symbol),
        transactionService.getSymbols(user),
        this.getHoldingHistoricalData(user, symbol, targetCurrency)
      ])

      if (transactions.length === 0 || historicalData.length < 2) {
        console.log('📊 Insufficient data for bucketed return calculation')
        return {
          buckets: [],
          timePeriod: 'year',
          totalMetrics: portfolioCalculationService.getEmptyReturnMetrics()
        }
      }

      // Calculate bucketed return metrics
      return portfolioCalculationService.calculateBucketedHoldingMetrics(
        transactions,
        historicalData,
        symbols,
        timeRange
      )
    } catch (error) {
      console.error('❌ Error calculating holding bucketed returns:', error)
      return {
        buckets: [],
        timePeriod: 'year',
        totalMetrics: portfolioCalculationService.getEmptyReturnMetrics()
      }
    }
  }

  /**
   * Calculate return metrics grouped by asset type
   * Returns a map of asset type -> return metrics (similar to assetTypeAllocations/assetTypeValues)
   */
  async getReturnMetricsByAssetType(user: AuthUser, targetCurrency: SupportedCurrency = 'USD', timeRange?: TimeRange): Promise<Map<string, ReturnMetrics>> {
    try {
      console.log('📊 Calculating return metrics by asset type: timeRange:', timeRange)

      const [transactions, symbols] = await Promise.all([
        transactionService.getTransactions(user),
        transactionService.getSymbols(user)
      ])

      if (transactions.length === 0) {
        console.log('📊 No transactions found')
        return new Map()
      }

      // Group transactions by asset type
      const transactionsByAssetType = new Map<string, typeof transactions>()

      for (const transaction of transactions) {
        const symbol = symbols.find(s => s.symbol === transaction.symbol)
        const assetType = symbol?.asset_type || 'other'

        if (!transactionsByAssetType.has(assetType)) {
          transactionsByAssetType.set(assetType, [])
        }
        transactionsByAssetType.get(assetType)!.push(transaction)
      }

      // Calculate return metrics for each asset type in parallel
      const assetTypes = Array.from(transactionsByAssetType.keys())
      const metricsPromises = assetTypes.map(async (assetType) => {
        const assetTransactions = transactionsByAssetType.get(assetType)!

        try {
          // Calculate historical data for this asset type's transactions
          // Use cacheContext to ensure each asset type has a unique cache entry
          const historicalData = await portfolioCalculationService.calculateHistoricalData(
            user,
            assetTransactions,
            symbols,
            targetCurrency,
            { cacheContext: `assetType:${assetType}` }
          )

          if (historicalData.length < 2) {
            return {
              assetType,
              metrics: portfolioCalculationService.getEmptyReturnMetrics()
            }
          }

          // Apply time range filter if specified
          let startDate: string | undefined
          if (timeRange && timeRange !== 'all') {
            const filterStartDate: Date = getStartDateForTimeRange(timeRange)
            startDate = filterStartDate.toISOString().split('T')[0]
          }

          // Calculate return metrics
          const metrics = portfolioCalculationService.calculatePortfolioReturnMetrics(
            assetTransactions,
            historicalData,
            symbols,
            { startDate }
          )

          return { assetType, metrics }
        } catch (error) {
          console.warn(`Failed to calculate metrics for asset type ${assetType}:`, error)
          return {
            assetType,
            metrics: portfolioCalculationService.getEmptyReturnMetrics()
          }
        }
      })

      const results = await Promise.all(metricsPromises)

      // Convert array results to Map
      const metricsMap = new Map<string, ReturnMetrics>()
      results.forEach(({ assetType, metrics }) => {
        metricsMap.set(assetType, metrics)
      })

      console.log(`📊 Calculated return metrics for ${metricsMap.size} asset types`)
      return metricsMap
    } catch (error) {
      console.error('❌ Error calculating asset type return metrics:', error)
      return new Map()
    }
  }

  async getPortfolioRepartitionData(user: AuthUser, targetCurrency: SupportedCurrency = 'USD', timeRange?: TimeRange, date?: string): Promise<Array<{
    assetType: string;
    value: number;
    percentage: number
  }>> {
    try {
      console.log('📊 Getting portfolio repartition data for user:', user.email, 'timeRange:', timeRange, 'date:', date || 'current')

      let historicalData: HistoricalDataPoint[]

      // If timeRange is provided, use the same aggregated data as the history chart
      if (timeRange) {
        historicalData = await this.getPortfolioHistoricalDataByTimeRange(user, timeRange, targetCurrency)
      } else {
        // Fallback to full historical data (backwards compatibility)
        historicalData = await this.getPortfolioHistoricalData(user, targetCurrency)
      }

      if (historicalData.length === 0) {
        console.log('📊 No historical data available')
        return []
      }

      // Find the data point for the target date, or use the last available point
      const targetDate = date || new Date().toISOString().split('T')[0]
      let targetDataPoint = historicalData.find(point => point.date === targetDate)

      // If no exact date match, use the last available point (most current/recent aggregated data)
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

      console.log('📊 Portfolio repartition from historical data:', result.length, 'asset types', timeRange ? `(timeRange: ${timeRange})` : '(full historical)')
      return result

    } catch (error) {
      console.error('❌ Error getting portfolio repartition data:', error)
      return []
    }
  }

  private getEmptyPortfolio(): PortfolioData {
    return {
      positions: [],
      returns: portfolioCalculationService.getEmptyReturnMetrics()
    }
  }

  // Delegate CRUD operations to transaction service
  async createOrGetSymbol(symbolData: any) {
    return transactionService.createOrGetSymbol(symbolData)
  }

  async addTransactionForUser(user: AuthUser, transactionData: TransactionData) {
    return transactionService.addTransactionForUser(user, transactionData)
  }

  async updateTransactionForUser(user: AuthUser, transactionId: string, transactionData: TransactionData) {
    return transactionService.updateTransactionForUser(user, transactionId, transactionData)
  }

  async deleteTransactionForUser(user: AuthUser, transactionId: string) {
    return transactionService.deleteTransactionForUser(user, transactionId)
  }

  async addHolding(user: AuthUser, holdingData: any) {
    return transactionService.addHolding(user, holdingData)
  }

  async deleteHolding(user: AuthUser, symbol: string) {
    return transactionService.deleteHolding(user, symbol)
  }

  async getUserSymbolPrices(user: AuthUser, symbol: string) {
    return transactionService.getUserSymbolPrices(user, symbol)
  }

  async addUserSymbolPrice(user: AuthUser, priceData: any) {
    return transactionService.addUserSymbolPrice(user, priceData)
  }

  async updateUserSymbolPrice(user: AuthUser, priceId: string, priceData: any) {
    return transactionService.updateUserSymbolPrice(user, priceId, priceData)
  }

  async deleteUserSymbolPrice(user: AuthUser, priceId: string) {
    return transactionService.deleteUserSymbolPrice(user, priceId)
  }

  // Position management
  async addPosition(user: AuthUser, symbol: string) {
    return positionService.createPosition(user, symbol)
  }

  async getPositions(user: AuthUser) {
    return positionService.getPositions(user)
  }

  async deletePosition(user: AuthUser, symbol: string) {
    return positionService.deletePosition(user, symbol)
  }

  // Legacy method signatures for backward compatibility
  async updateTransaction(user: AuthUser, transactionId: string, transactionData: any) {
    return transactionService.updateTransactionForUser(user, transactionId, transactionData)
  }

  async deleteTransaction(user: AuthUser, transactionId: string) {
    return transactionService.deleteTransactionForUser(user, transactionId)
  }
}

// Singleton instance
export const portfolioService = new PortfolioService()
