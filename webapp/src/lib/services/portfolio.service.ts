import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/lib/auth/auth.service'
import type { Transaction, Symbol } from '@/lib/supabase/database.types'
import { 
  mockPortfolioData, 
  mockSymbols, 
  mockHistoricalData, 
  mockTransactions,
  generateMockHistoricalData,
  type HistoricalDataPoint 
} from '@/lib/mockData'

// Demo user identifier
const DEMO_USER_EMAIL = 'test@trackfolio.com'
const DEMO_USER_ID = 'mock-user-id'

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

  private isDemoUser(user: AuthUser): boolean {
    return user.email === DEMO_USER_EMAIL || user.id === DEMO_USER_ID
  }

  async getPortfolioData(user: AuthUser): Promise<PortfolioData> {
    console.log('🔄 Fetching portfolio data for user:', user.email)
    
    if (this.isDemoUser(user)) {
      console.log('👤 Demo user detected - using mock data')
      return mockPortfolioData
    }

    console.log('🔗 Real user detected - fetching from Supabase')
    return await this.fetchRealPortfolioData(user)
  }

  async getSymbols(user: AuthUser): Promise<Symbol[]> {
    if (this.isDemoUser(user)) {
      return mockSymbols
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
      console.error('Error fetching symbols:', error)
      return []
    }
  }

  async getTransactions(user: AuthUser): Promise<Transaction[]> {
    if (this.isDemoUser(user)) {
      return mockTransactions
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
      console.error('Error fetching transactions:', error)
      return []
    }
  }

  async getHistoricalData(user: AuthUser): Promise<HistoricalDataPoint[]> {
    if (this.isDemoUser(user)) {
      return mockHistoricalData
    }

    console.log('📊 Generating historical data for real user')
    return await this.generateRealHistoricalData(user)
  }

  private async fetchRealPortfolioData(user: AuthUser): Promise<PortfolioData> {
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
      console.error('Error fetching real portfolio data:', error)
      return this.getEmptyPortfolio()
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

  private async generateRealHistoricalData(user: AuthUser): Promise<HistoricalDataPoint[]> {
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
      
      // Generate data points for each day from start to end
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const currentDate = d.toISOString().split('T')[0]
        
        // Get transactions up to this date
        const transactionsUpToDate = sortedTransactions.filter(t => t.date <= currentDate)
        
        // Calculate positions as of this date
        const positions = this.calculatePositionsFromTransactions(transactionsUpToDate, symbols)
        
        // Calculate total portfolio value
        const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0)
        
        // Calculate cash balance as of this date
        const cashTransactions = transactionsUpToDate.filter(t => t.symbol === 'CASH')
        const cashBalance = cashTransactions.reduce((sum, t) => {
          const sign = ['deposit', 'dividend', 'bonus'].includes(t.type) ? 1 : -1
          return sum + (t.quantity * t.price_per_unit * sign)
        }, 0)
        
        const totalPortfolioValue = totalValue + cashBalance
        
        // Calculate asset type allocations
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
          assetTypeValues[assetType] += position.value
        })
        
        // Convert to percentages
        const assetTypeAllocations: Record<string, number> = {}
        if (totalPortfolioValue > 0) {
          Object.keys(assetTypeValues).forEach(assetType => {
            assetTypeAllocations[assetType] = (assetTypeValues[assetType] / totalPortfolioValue) * 100
          })
        }
        
        // Calculate returns (simplified - using total portfolio growth)
        const initialValue = historicalData[0]?.totalValue || totalPortfolioValue
        const portfolioReturn = initialValue > 0 ? (totalPortfolioValue - initialValue) / initialValue : 0
        
        const assetTypeReturns: Record<string, number> = {
          stock: portfolioReturn * 0.4,   // Assume stocks contribute 40% of returns
          etf: portfolioReturn * 0.3,     // ETFs 30%
          crypto: portfolioReturn * 0.2,  // Crypto 20%
          real_estate: portfolioReturn * 0.08, // Real estate 8%
          other: portfolioReturn * 0.02   // Other 2%
        }
        
        historicalData.push({
          date: currentDate,
          totalValue: totalPortfolioValue,
          assetTypeAllocations,
          assetTypeReturns
        })
      }
      
      console.log(`📊 Generated ${historicalData.length} historical data points`)
      return historicalData
      
    } catch (error) {
      console.error('Error generating historical data:', error)
      return []
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
}

// Singleton instance
export const portfolioService = new PortfolioService()