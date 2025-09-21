import type { AuthUser } from '@/lib/auth/client.auth.service'
import type { HistoricalDataPoint } from '@/lib/mockData'
import type { TimeRange } from '@/components/TimeRangeSelector'
import { historicalPriceService } from './historical-price.service'
import { unifiedCalculationService, type PortfolioPosition } from './unified-calculation.service'
import { historicalDataService } from './historical-data.service'
import { transactionService } from './transaction.service'
import { currencyService, type SupportedCurrency } from './currency.service'
import { returnCalculationService, type AnnualizedReturnMetrics, type PortfolioSummaryV2 } from './return-calculation.service'

// Re-export types for external components
export type { PortfolioPosition, AnnualizedReturnMetrics, PortfolioSummaryV2 }

export interface PortfolioData {
  totalValue: number
  totalCostBasis: number
  positions: PortfolioPosition[]
  totalPnL: {
    realized: number
    unrealized: number
    total: number
    totalPercentage: number
  }
  annualizedReturns?: AnnualizedReturnMetrics
}

export interface EnhancedPortfolioData extends Omit<PortfolioData, 'annualizedReturns'> {
  summaryV2?: PortfolioSummaryV2
  annualizedReturns?: AnnualizedReturnMetrics
}

export interface HoldingReturnsData {
  summaryV2: PortfolioSummaryV2
  annualizedReturns: AnnualizedReturnMetrics
}

/**
 * Main Portfolio Service - orchestrates other services
 * Now much smaller and focused on coordination rather than implementation
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

  async getPortfolioData(user: AuthUser, targetCurrency: SupportedCurrency = 'USD', includeClosedPositions: boolean = false): Promise<PortfolioData> {
    console.log('🔄 Fetching portfolio data for user:', user.email)
    
    try {
      // Fetch transactions and symbols using transaction service
      const transactions = await transactionService.getTransactions(user)
      const symbols = await transactionService.getSymbols(user)
      
      if (transactions.length === 0) {
        console.log('📈 No transactions found for user, returning empty portfolio')
        return this.getEmptyPortfolio()
      }

      // Calculate positions using unified calculation service (already in target currency)
      const positions = await unifiedCalculationService.calculateCurrentPositions(transactions, symbols, user, targetCurrency, includeClosedPositions)



      // Calculate totals in target currency (no additional conversion needed)
      const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0)
      const totalCostBasis = positions.reduce((sum, pos) => sum + (pos.quantity * pos.avgCost), 0)
      const totalUnrealizedPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0)
      
      // Calculate total percentage P&L
      const totalPercentage = totalCostBasis > 0 ? (totalUnrealizedPnL / totalCostBasis) * 100 : 0

      // Calculate annualized returns if we have sufficient data
      let annualizedReturns: AnnualizedReturnMetrics | undefined
      let realizedPnL = 0
      try {
        const historicalData = await historicalDataService.buildHistoricalData(user, transactions, symbols, targetCurrency)
        if (historicalData.length >= 2) {
          annualizedReturns = returnCalculationService.calculateAnnualizedReturns(
            transactions,
            historicalData,
            symbols
          )

          // Calculate realized P&L from V2 summary (realized + dividends)
          const v2Summary = returnCalculationService.calculatePortfolioSummaryV2(
            transactions,
            historicalData
          )
          realizedPnL = v2Summary.realizedPnL + v2Summary.dividends
        }
      } catch (error) {
        console.warn('Could not calculate annualized returns:', error)
      }

      return {
        totalValue,
        totalCostBasis,
        positions: positions,
        totalPnL: {
          realized: realizedPnL,
          unrealized: totalUnrealizedPnL,
          total: totalUnrealizedPnL + realizedPnL,
          totalPercentage
        },
        annualizedReturns
      }
    } catch (error) {
      return this.handleError('fetching portfolio data', error, this.getEmptyPortfolio())
    }
  }

  async getEnhancedPortfolioData(user: AuthUser, targetCurrency: SupportedCurrency = 'USD', includeClosedPositions: boolean = false): Promise<EnhancedPortfolioData> {
    console.log('🔄 Fetching enhanced portfolio data with detailed returns for user:', user.email)

    try {
      // Fetch transactions and symbols using transaction service
      const transactions = await transactionService.getTransactions(user)
      const symbols = await transactionService.getSymbols(user)

      if (transactions.length === 0) {
        console.log('📈 No transactions found for user, returning empty portfolio')
        return this.getEmptyEnhancedPortfolio()
      }

      // Calculate positions using unified calculation service (already in target currency)
      const positions = await unifiedCalculationService.calculateCurrentPositions(transactions, symbols, user, targetCurrency, includeClosedPositions)

      // Calculate totals in target currency (no additional conversion needed)
      const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0)
      const totalCostBasis = positions.reduce((sum, pos) => sum + (pos.quantity * pos.avgCost), 0)
      const totalUnrealizedPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0)

      // Calculate total percentage P&L
      const totalPercentage = totalCostBasis > 0 ? (totalUnrealizedPnL / totalCostBasis) * 100 : 0

      // Calculate V2 summary and annualized returns if we have sufficient data
      let summaryV2: PortfolioSummaryV2 | undefined
      let annualizedReturns: AnnualizedReturnMetrics | undefined
      let realizedPnL = 0
      try {
        const historicalData = await historicalDataService.buildHistoricalData(user, transactions, symbols, targetCurrency)
        if (historicalData.length >= 2) {
          summaryV2 = returnCalculationService.calculatePortfolioSummaryV2(
            transactions,
            historicalData
          )
          annualizedReturns = returnCalculationService.calculateAnnualizedReturns(
            transactions,
            historicalData,
            symbols
          )
          realizedPnL = summaryV2.realizedPnL + summaryV2.dividends
        }
      } catch (error) {
        console.warn('Could not calculate returns:', error)
      }

      return {
        totalValue,
        totalCostBasis,
        positions: positions,
        totalPnL: {
          realized: realizedPnL,
          unrealized: totalUnrealizedPnL,
          total: totalUnrealizedPnL + realizedPnL,
          totalPercentage
        },
        summaryV2,
        annualizedReturns
      }
    } catch (error) {
      return this.handleError('fetching enhanced portfolio data', error, this.getEmptyEnhancedPortfolio())
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
    return await historicalDataService.buildHistoricalData(user, transactions, symbols, targetCurrency)
  }

  async getPortfolioHistoricalDataByTimeRange(user: AuthUser, timeRange: TimeRange, targetCurrency: SupportedCurrency = 'USD'): Promise<HistoricalDataPoint[]> {
    const transactions = await transactionService.getTransactions(user)
    const symbols = await transactionService.getSymbols(user)
    return await historicalDataService.getHistoricalDataByTimeRange(user, transactions, symbols, timeRange, targetCurrency)
  }

  async getHoldingHistoricalData(user: AuthUser, symbol: string, targetCurrency: SupportedCurrency = 'USD'): Promise<HistoricalDataPoint[]> {
    console.log('📊 Building holding historical data for:', symbol)
    const transactions = await transactionService.getTransactions(user)
    const symbols = await transactionService.getSymbols(user)
    return await historicalDataService.buildHistoricalData(user, transactions, symbols, targetCurrency, {
      symbol,
      useSimplePriceLookup: true
    })
  }

  async getHoldingTransactions(user: AuthUser, symbol: string) {
    return transactionService.getHoldingTransactions(user, symbol)
  }

  async getHoldingAnnualizedReturns(user: AuthUser, symbol: string, targetCurrency: SupportedCurrency = 'USD', timeRange?: TimeRange): Promise<AnnualizedReturnMetrics | null> {
    try {
      console.log('📊 Calculating annualized returns for holding:', symbol)
      
      // Get data specific to this holding
      const [transactions, symbols, historicalData] = await Promise.all([
        transactionService.getHoldingTransactions(user, symbol),
        transactionService.getSymbols(user),
        this.getHoldingHistoricalData(user, symbol, targetCurrency)
      ])

      if (transactions.length === 0 || historicalData.length < 2) {
        console.log('📊 Insufficient data for annualized return calculation')
        return null
      }

      // Apply time range filter if specified
      let options = {}
      if (timeRange && timeRange !== 'all') {
        const now = new Date()
        let startDate: Date
        
        switch (timeRange) {
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
          default:
            startDate = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000)
        }
        
        options = {
          startDate: startDate.toISOString().split('T')[0]
        }
      }

      const annualizedReturns = returnCalculationService.calculateAnnualizedReturns(
        transactions,
        historicalData,
        symbols,
        options
      )

      // console.log('📊 Calculated annualized returns for', symbol, ':', {
      //   twr: annualizedReturns.timeWeightedReturn.toFixed(2) + '%',
      //   mwr: annualizedReturns.moneyWeightedReturn.toFixed(2) + '%'
      // })

      return annualizedReturns
    } catch (error) {
      console.error('❌ Error calculating holding annualized returns:', error)
      return null
    }
  }

  async getHoldingDetailedReturns(user: AuthUser, symbol: string, targetCurrency: SupportedCurrency = 'USD', timeRange?: TimeRange): Promise<HoldingReturnsData | null> {
    try {
      console.log('📊 Calculating detailed returns for holding:', symbol)

      // Get data specific to this holding
      const [transactions, symbols, historicalData] = await Promise.all([
        transactionService.getHoldingTransactions(user, symbol),
        transactionService.getSymbols(user),
        this.getHoldingHistoricalData(user, symbol, targetCurrency)
      ])

      if (transactions.length === 0 || historicalData.length < 2) {
        console.log('📊 Insufficient data for detailed return calculation')
        return null
      }

      // Apply time range filter if specified
      let startDate: string | undefined
      if (timeRange && timeRange !== 'all') {
        const now = new Date()
        let filterStartDate: Date

        switch (timeRange) {
          case '5d':
            filterStartDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
            break
          case '1m':
            filterStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            break
          case '6m':
            filterStartDate = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000)
            break
          case 'ytd':
            filterStartDate = new Date(now.getFullYear(), 0, 1)
            break
          case '1y':
            filterStartDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
            break
          case '5y':
            filterStartDate = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000)
            break
          default:
            filterStartDate = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000)
        }

        startDate = filterStartDate.toISOString().split('T')[0]
      }

      // DEBUG: Log actual transactions being used for calculation
      if (symbol === 'DHER.DE') {
        console.log('🔍 DHER.DE DEBUG: Actual transactions from database:', transactions.length)
        transactions.forEach((tx, i) => {
          console.log(`  ${i+1}. ${tx.date}: ${tx.type} ${tx.quantity} @ €${tx.price_per_unit} (fees: €${tx.fees || 0})`)
        })

        const totalBought = transactions.filter(t => t.type === 'buy').reduce((sum, t) => sum + t.quantity, 0)
        const totalSold = transactions.filter(t => t.type === 'sell').reduce((sum, t) => sum + t.quantity, 0)
        console.log(`🔍 DHER.DE: Total bought ${totalBought}, sold ${totalSold}, remaining ${totalBought - totalSold}`)
      }

      const summaryV2 = returnCalculationService.calculatePortfolioSummaryV2(
        transactions,
        historicalData,
        startDate
      )

      // DEBUG: Log the calculation result
      if (symbol === 'DHER.DE') {
        console.log('🔍 DHER.DE DEBUG: SummaryV2 result:', summaryV2)
      }

      const annualizedReturns = returnCalculationService.calculateAnnualizedReturns(
        transactions,
        historicalData,
        symbols,
        { startDate }
      )

      console.log('📊 Calculated returns for', symbol, ':', {
        capitalGains: summaryV2.capitalGains,
        dividends: summaryV2.dividends,
        realized: summaryV2.realizedPnL,
        unrealized: summaryV2.unrealizedPnL,
        totalPnL: summaryV2.totalPnL
      })

      return {
        summaryV2,
        annualizedReturns
      }
    } catch (error) {
      console.error('❌ Error calculating holding detailed returns:', error)
      return null
    }
  }

  async getPortfolioRepartitionData(user: AuthUser, targetCurrency: SupportedCurrency = 'USD', date?: string): Promise<Array<{
    assetType: string;
    value: number;
    percentage: number
  }>> {
    try {
      console.log('📊 Getting portfolio repartition data for user:', user.email, 'date:', date || 'current')
      
      // Get historical data (which includes both allocations and values)
      const historicalData = await this.getPortfolioHistoricalData(user, targetCurrency)
      
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

  private getEmptyPortfolio(): PortfolioData {
    return {
      totalValue: 0,
      totalCostBasis: 0,
      positions: [],
      totalPnL: { realized: 0, unrealized: 0, total: 0, totalPercentage: 0 }
    }
  }

  private getEmptyEnhancedPortfolio(): EnhancedPortfolioData {
    return {
      totalValue: 0,
      totalCostBasis: 0,
      positions: [],
      totalPnL: { realized: 0, unrealized: 0, total: 0, totalPercentage: 0 }
    }
  }

  // Delegate CRUD operations to transaction service
  async createOrGetSymbol(symbolData: any) {
    return transactionService.createOrGetSymbol(symbolData)
  }

  async addTransactionForUser(user: AuthUser, transactionData: any) {
    return transactionService.addTransactionForUser(user, transactionData)
  }

  async updateTransactionForUser(user: AuthUser, transactionId: string, transactionData: any) {
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
