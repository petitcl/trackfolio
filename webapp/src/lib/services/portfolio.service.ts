import type { AuthUser } from '@/lib/auth/client.auth.service'
import type { HistoricalDataPoint } from '@/lib/mockData'
import type { TimeRange } from '@/components/TimeRangeSelector'
import { historicalPriceService } from './historical-price.service'
import { portfolioCalculationService, type PortfolioPosition } from './portfolio-calculation.service'
import { historicalDataService } from './historical-data.service'
import { transactionService } from './transaction.service'

// Re-export types for external components
export type { PortfolioPosition }

export interface PortfolioData {
  totalValue: number
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

  async getPortfolioData(user: AuthUser): Promise<PortfolioData> {
    console.log('🔄 Fetching portfolio data for user:', user.email)
    
    try {
      // Fetch transactions and symbols using transaction service
      const transactions = await transactionService.getTransactions(user)
      const symbols = await transactionService.getSymbols(user)
      
      if (transactions.length === 0) {
        console.log('📈 No transactions found for user, returning empty portfolio')
        return this.getEmptyPortfolio()
      }

      // Calculate positions using calculation service
      const positions = portfolioCalculationService.calculatePositionsFromTransactions(transactions, symbols)
      
      // Calculate totals
      const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0)
      const totalUnrealizedPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0)

      return {
        totalValue,
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

  // Delegate to transaction service
  async getSymbols(user: AuthUser) {
    return transactionService.getSymbols(user)
  }

  async getTransactions(user: AuthUser) {
    return transactionService.getTransactions(user)
  }

  async getPortfolioHistoricalData(user: AuthUser): Promise<HistoricalDataPoint[]> {
    console.log('📊 Building portfolio historical data for user')
    const transactions = await transactionService.getTransactions(user)
    const symbols = await transactionService.getSymbols(user)
    return await historicalDataService.buildHistoricalData(user, transactions, symbols)
  }

  async getPortfolioHistoricalDataByTimeRange(user: AuthUser, timeRange: TimeRange): Promise<HistoricalDataPoint[]> {
    const transactions = await transactionService.getTransactions(user)
    const symbols = await transactionService.getSymbols(user)
    return await historicalDataService.getHistoricalDataByTimeRange(user, transactions, symbols, timeRange)
  }

  async getHoldingHistoricalData(user: AuthUser, symbol: string): Promise<HistoricalDataPoint[]> {
    console.log('📊 Building holding historical data for:', symbol)
    const transactions = await transactionService.getTransactions(user)
    const symbols = await transactionService.getSymbols(user)
    return await historicalDataService.buildHistoricalData(user, transactions, symbols, {
      symbol,
      useSimplePriceLookup: true
    })
  }

  async getHoldingTransactions(user: AuthUser, symbol: string) {
    return transactionService.getHoldingTransactions(user, symbol)
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

  private getEmptyPortfolio(): PortfolioData {
    return {
      totalValue: 0,
      positions: [],
      dailyChange: { value: 0, percentage: 0 },
      totalPnL: { realized: 0, unrealized: 0, total: 0 }
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