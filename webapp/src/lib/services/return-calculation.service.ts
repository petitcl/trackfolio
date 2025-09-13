import type { Transaction, Symbol } from '@/lib/supabase/types'
import type { HistoricalDataPoint } from '@/lib/mockData'

export interface AnnualizedReturnMetrics {
  timeWeightedReturn: number // TWR - pure investment performance
  moneyWeightedReturn: number // XIRR - investor experience with cash flow timing
  totalReturn: number // Absolute return percentage
  annualizedVolatility?: number // Risk metric (optional)
  startDate: string
  endDate: string
  periodYears: number
}

export interface ReturnCalculationOptions {
  startDate?: string
  endDate?: string
  includeVolatility?: boolean
}

/**
 * Service for calculating various return metrics including annualized returns
 * Supports both Time-Weighted Return (TWR) and Money-Weighted Return (XIRR)
 */
export class ReturnCalculationService {

  /**
   * Calculate comprehensive annualized return metrics for a portfolio or holding
   */
  calculateAnnualizedReturns(
    transactions: Transaction[],
    historicalData: HistoricalDataPoint[],
    symbols: Symbol[],
    options: ReturnCalculationOptions = {}
  ): AnnualizedReturnMetrics {
    
    if (historicalData.length === 0) {
      return this.getEmptyMetrics()
    }

    const { startDate, endDate, includeVolatility = false } = options
    
    // Filter historical data by date range if specified
    let filteredData = historicalData
    if (startDate || endDate) {
      filteredData = historicalData.filter(point => {
        const pointDate = point.date
        if (startDate && pointDate < startDate) return false
        if (endDate && pointDate > endDate) return false
        return true
      })
    }

    if (filteredData.length < 2) {
      return this.getEmptyMetrics()
    }

    const firstPoint = filteredData[0]
    const lastPoint = filteredData[filteredData.length - 1]
    const periodYears = this.calculateYearsDifference(firstPoint.date, lastPoint.date)

    if (periodYears <= 0) {
      return this.getEmptyMetrics()
    }

    // Calculate Time-Weighted Return (TWR)
    const twr = this.calculateTimeWeightedReturn(
      firstPoint.totalValue || 0,
      lastPoint.totalValue || 0,
      periodYears
    )

    // Calculate Money-Weighted Return (XIRR)
    const mwr = this.calculateMoneyWeightedReturn(
      transactions,
      filteredData,
      firstPoint.date,
      lastPoint.date
    )

    // Calculate total return percentage
    const totalReturn = firstPoint.totalValue > 0 
      ? ((lastPoint.totalValue - firstPoint.totalValue) / firstPoint.totalValue) * 100
      : 0

    // Calculate annualized volatility if requested
    let annualizedVolatility: number | undefined
    if (includeVolatility && filteredData.length > 1) {
      annualizedVolatility = this.calculateAnnualizedVolatility(filteredData)
    }

    return {
      timeWeightedReturn: twr * 100, // Convert to percentage
      moneyWeightedReturn: mwr * 100, // Convert to percentage
      totalReturn,
      annualizedVolatility,
      startDate: firstPoint.date,
      endDate: lastPoint.date,
      periodYears
    }
  }

  /**
   * Calculate Time-Weighted Return (TWR) - measures pure investment performance
   * Formula: ((End Value / Begin Value) ^ (1 / Years)) - 1
   */
  private calculateTimeWeightedReturn(
    startValue: number,
    endValue: number,
    periodYears: number
  ): number {
    if (startValue <= 0 || endValue <= 0 || periodYears <= 0) {
      return 0
    }

    // For periods less than 1 year, return simple return
    if (periodYears < 1) {
      return (endValue / startValue) - 1
    }

    // Annualized return
    return Math.pow(endValue / startValue, 1 / periodYears) - 1
  }

  /**
   * Calculate Money-Weighted Return (XIRR) - measures investor experience
   * Uses Newton-Raphson method to find IRR
   */
  private calculateMoneyWeightedReturn(
    transactions: Transaction[],
    historicalData: HistoricalDataPoint[],
    startDate: string,
    endDate: string
  ): number {
    
    // Filter transactions within the date range
    const relevantTransactions = transactions.filter(t => 
      t.date >= startDate && t.date <= endDate
    )

    if (relevantTransactions.length === 0) {
      return 0
    }

    // Build cash flow array
    const cashFlows: Array<{date: string, amount: number}> = []
    
    // Add all investment transactions (negative for investments, positive for sales/dividends)
    relevantTransactions.forEach(transaction => {
      let amount = 0
      
      switch (transaction.type) {
        case 'buy':
        case 'deposit':
          // Cash going out (negative)
          amount = -(transaction.quantity * transaction.price_per_unit + (transaction.fees || 0))
          break
        case 'sell':
        case 'withdrawal':
          // Cash coming in (positive)
          amount = (transaction.quantity * transaction.price_per_unit) - (transaction.fees || 0)
          break
        case 'dividend':
        case 'bonus':
          // Income (positive)
          amount = transaction.quantity * transaction.price_per_unit
          break
      }
      
      if (amount !== 0) {
        cashFlows.push({ date: transaction.date, amount })
      }
    })

    // Add final portfolio value as positive cash flow
    const finalValue = historicalData[historicalData.length - 1]?.totalValue || 0
    if (finalValue > 0) {
      cashFlows.push({ date: endDate, amount: finalValue })
    }

    if (cashFlows.length < 2) {
      return 0
    }

    // Calculate XIRR using Newton-Raphson method
    return this.calculateXIRR(cashFlows)
  }

  /**
   * Calculate XIRR (Extended Internal Rate of Return) using Newton-Raphson method
   */
  private calculateXIRR(cashFlows: Array<{date: string, amount: number}>): number {
    if (cashFlows.length < 2) return 0

    // Sort cash flows by date
    const sortedCashFlows = [...cashFlows].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    const firstDate = new Date(sortedCashFlows[0].date).getTime()
    
    // Convert dates to years from first date
    const flows = sortedCashFlows.map(cf => ({
      years: (new Date(cf.date).getTime() - firstDate) / (365.25 * 24 * 60 * 60 * 1000),
      amount: cf.amount
    }))

    // Initial guess
    let rate = 0.1
    const maxIterations = 100
    const precision = 1e-6

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0
      let dnpv = 0

      // Calculate NPV and derivative
      flows.forEach(flow => {
        const factor = Math.pow(1 + rate, flow.years)
        npv += flow.amount / factor
        dnpv -= flow.years * flow.amount / (factor * (1 + rate))
      })

      // Newton-Raphson step
      if (Math.abs(dnpv) < precision) break
      
      const newRate = rate - npv / dnpv
      
      if (Math.abs(newRate - rate) < precision) {
        return newRate
      }
      
      rate = newRate
    }

    return rate
  }

  /**
   * Calculate annualized volatility (standard deviation of returns)
   */
  private calculateAnnualizedVolatility(historicalData: HistoricalDataPoint[]): number {
    if (historicalData.length < 2) return 0

    // Calculate daily returns
    const dailyReturns: number[] = []
    for (let i = 1; i < historicalData.length; i++) {
      const prevValue = historicalData[i - 1].totalValue
      const currentValue = historicalData[i].totalValue
      
      if (prevValue > 0) {
        const dailyReturn = (currentValue - prevValue) / prevValue
        dailyReturns.push(dailyReturn)
      }
    }

    if (dailyReturns.length < 2) return 0

    // Calculate standard deviation
    const mean = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length
    const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / (dailyReturns.length - 1)
    const dailyVolatility = Math.sqrt(variance)

    // Annualize volatility (assuming ~252 trading days per year)
    return dailyVolatility * Math.sqrt(252)
  }

  /**
   * Calculate the difference in years between two dates
   */
  private calculateYearsDifference(startDate: string, endDate: string): number {
    const start = new Date(startDate).getTime()
    const end = new Date(endDate).getTime()
    return (end - start) / (365.25 * 24 * 60 * 60 * 1000)
  }

  /**
   * Return empty metrics structure
   */
  private getEmptyMetrics(): AnnualizedReturnMetrics {
    return {
      timeWeightedReturn: 0,
      moneyWeightedReturn: 0,
      totalReturn: 0,
      startDate: '',
      endDate: '',
      periodYears: 0
    }
  }

  /**
   * Format return percentage for display
   */
  formatReturnPercentage(returnValue: number, decimals: number = 2): string {
    const sign = returnValue >= 0 ? '+' : ''
    return `${sign}${returnValue.toFixed(decimals)}%`
  }

  /**
   * Get display color class based on return value
   */
  getReturnColorClass(returnValue: number): string {
    if (returnValue > 0) return 'text-green-600 dark:text-green-400'
    if (returnValue < 0) return 'text-red-600 dark:text-red-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  /**
   * Calculate simple annualized return for quick estimates
   * Less accurate than TWR/XIRR but faster for real-time updates
   */
  calculateSimpleAnnualizedReturn(
    currentValue: number,
    totalInvested: number,
    firstTransactionDate: string
  ): number {
    if (totalInvested <= 0) return 0

    const years = this.calculateYearsDifference(
      firstTransactionDate,
      new Date().toISOString().split('T')[0]
    )

    if (years <= 0) return 0

    const totalReturn = (currentValue / totalInvested) - 1
    
    // For periods less than 1 year, return simple return
    if (years < 1) {
      return totalReturn * 100
    }

    // Annualized return
    return (Math.pow(1 + totalReturn, 1 / years) - 1) * 100
  }
}

// Singleton instance
export const returnCalculationService = new ReturnCalculationService()