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

export interface DetailedReturnMetrics extends AnnualizedReturnMetrics {
  // Capital gains breakdown
  capitalGains: {
    realized: number // Actual gains from completed sales (absolute value)
    unrealized: number // Paper gains on current holdings (absolute value)
    realizedPercentage: number // Realized gains as % of total invested
    unrealizedPercentage: number // Unrealized gains as % of current cost basis
    annualizedRate: number // Capital appreciation rate (annualized %)
  }

  // Dividend income breakdown
  dividendIncome: {
    total: number // Total dividends received (absolute value)
    percentage: number // Dividends as % of total invested
    annualizedYield: number // Dividend yield (annualized %)
  }

  // Realized vs Unrealized summary
  realizedVsUnrealized: {
    totalRealized: number // All realized gains + dividends (absolute value)
    totalUnrealized: number // All unrealized gains (absolute value)
    realizedPercentage: number // Realized as % of total return
    unrealizedPercentage: number // Unrealized as % of total return
  }

  // Investment summary for context
  investmentSummary: {
    totalInvested: number // Total money put in
    currentValue: number // Current portfolio value
    totalWithdrawn: number // Total money taken out (from sales)
  }
}

export interface ReturnCalculationOptions {
  startDate?: string
  endDate?: string
  includeVolatility?: boolean
}

export interface DetailedReturnCalculationOptions extends ReturnCalculationOptions {
  includeDetailed?: boolean // Whether to calculate detailed breakdowns
  fifoMethod?: boolean // Use FIFO for realized gains calculation (default: true)
}



// FIFO lot
interface Lot {
  quantity: number;
  costPerUnit: number;
}

interface PortfolioSummary {
  totalPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
  capitalGains: number;
  dividends: number;
  costBasis: number;
  totalInvested: number;
  annualizedReturn: number;
}



interface Lot {
  quantity: number;
  costPerUnit: number;
}

interface PortfolioSummary {
  totalPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
  capitalGains: number;
  dividends: number;
  costBasis: number;
  totalInvested: number;
  annualizedReturn: number;
}

function computePortfolioSummaryV2(
  transactions: Transaction[],
  histData: HistoricalDataPoint[],
  startDate: string,
  endDate: string
): PortfolioSummary {
  // Sort historical data
  const histSorted = histData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const histStart = histSorted.find(d => d.date >= startDate) ?? histSorted[0];
  const histEnd = histSorted.slice().reverse().find(d => d.date <= endDate) ?? histSorted[histSorted.length - 1];

  // Filter transactions within range
  const txs = transactions.filter(tx => tx.date >= startDate && tx.date <= endDate);

  const lotsBySymbol: Record<string, Lot[]> = {};
  let realizedPnL = 0;
  let dividends = 0;
  let totalInvested = 0;

  // Process transactions
  for (const tx of txs) {
    if (!lotsBySymbol[tx.symbol]) lotsBySymbol[tx.symbol] = [];

    switch (tx.type) {
      case "buy":
        if (tx.quantity > 0) {
          lotsBySymbol[tx.symbol].push({ quantity: tx.quantity, costPerUnit: tx.price_per_unit + (tx.fees || 0) / tx.quantity });
          totalInvested += tx.price_per_unit * tx.quantity + (tx.fees || 0);
        }
        break;

      case "sell":
        let remainingQty = tx.quantity;
        while (remainingQty > 0 && lotsBySymbol[tx.symbol].length > 0) {
          const lot = lotsBySymbol[tx.symbol][0];
          const qtyUsed = Math.min(remainingQty, lot.quantity);
          realizedPnL += qtyUsed * (tx.price_per_unit - lot.costPerUnit);
          lot.quantity -= qtyUsed;
          remainingQty -= qtyUsed;
          if (lot.quantity === 0) lotsBySymbol[tx.symbol].shift();
        }
        break;

      case "dividend":
        dividends += tx.price_per_unit;
        break;

      case "bonus":
        if (tx.quantity > 0) lotsBySymbol[tx.symbol].push({ quantity: tx.quantity, costPerUnit: 0 });
        break;
    }
  }

  // Compute cost basis of remaining lots
  let costBasis = 0;
  for (const symbol in lotsBySymbol) {
    for (const lot of lotsBySymbol[symbol]) {
      costBasis += lot.quantity * lot.costPerUnit;
    }
  }

  // Compute unrealized PnL using historical end values
  const totalCurrentValue = Object.values(histEnd.assetTypeValues).reduce((a, b) => a + b, 0);
  const unrealizedPnL = totalCurrentValue - costBasis;

  // Capital gains and total PnL
  const capitalGains = realizedPnL + unrealizedPnL;
  const totalPnL = capitalGains + dividends;

  // Annualized TWR
  const startValue = Object.values(histStart.assetTypeValues).reduce((a, b) => a + b, 0);
  const years = (new Date(histEnd.date).getTime() - new Date(histStart.date).getTime()) / (1000 * 3600 * 24 * 365.25);
  const annualizedReturn = computeAnnualizedTWR(histData, txs, startDate, endDate);

  return {
    totalPnL,
    realizedPnL,
    unrealizedPnL,
    capitalGains,
    dividends,
    costBasis,
    totalInvested,
    annualizedReturn,
  };
}

function computeAnnualizedTWR(
  histData: HistoricalDataPoint[],
  transactions: Transaction[],
  startDate: string,
  endDate: string
): number {
  // Sort historical data
  const histSorted = histData
    .filter(d => d.date >= startDate && d.date <= endDate)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (histSorted.length < 2) return 0;

  let twr = 1;

  for (let i = 0; i < histSorted.length - 1; i++) {
    const start = histSorted[i];
    const end = histSorted[i + 1];

    // Cash flows between start.date (exclusive) and end.date (inclusive)
    const cf = transactions
      .filter(tx => tx.date > start.date && tx.date <= end.date)
      .reduce((acc, tx) => {
        switch (tx.type) {
          case "buy":
            return acc + tx.price_per_unit * tx.quantity + (tx.fees || 0);
          case "sell":
            return acc - tx.price_per_unit * tx.quantity + (tx.fees || 0);
          // dividend is inflow, reduce net outflow
          case "dividend":
            return acc - tx.price_per_unit;
          default:
            return acc;
        }
      }, 0);

    const V_start = Object.values(start.assetTypeValues).reduce((a, b) => a + b, 0);
    const V_end = Object.values(end.assetTypeValues).reduce((a, b) => a + b, 0);

    if (V_start > 0) {
      const periodReturn = (V_end - cf) / V_start - 1;
      twr *= 1 + periodReturn;
    }
  }

  const years =
    (new Date(histSorted[histSorted.length - 1].date).getTime() -
      new Date(histSorted[0].date).getTime()) /
    (1000 * 3600 * 24 * 365.25);

  return years > 0 ? Math.pow(twr, 1 / years) - 1 : 0;
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

    const { startDate: optionsStartDate, endDate: optionsEndDate, includeVolatility = false } = options

    // Filter historical data by date range if specified
    let filteredData = historicalData
    if (optionsStartDate || optionsEndDate) {
      filteredData = historicalData.filter(point => {
        const pointDate = point.date
        if (optionsStartDate && pointDate < optionsStartDate) return false
        if (optionsEndDate && pointDate > optionsEndDate) return false
        return true
      })
    }

    if (filteredData.length < 2) {
      return this.getEmptyMetrics()
    }

    const firstPoint = filteredData[0]
    const lastPoint = filteredData[filteredData.length - 1]
    const periodYears = this.calculateYearsDifference(firstPoint.date, lastPoint.date)

    // Use actual data range for transaction filtering
    const actualStartDate = optionsStartDate || firstPoint.date
    const actualEndDate = optionsEndDate || lastPoint.date

    if (periodYears <= 0) {
      return this.getEmptyMetrics()
    }

    // Calculate investment summary first to check if position is closed
    const investmentSummary = this.calculateInvestmentSummary(transactions, lastPoint, actualStartDate, actualEndDate)

    // Check if this is a closed position - handle rounding errors
    // A position is closed if net quantity is effectively 0 (within rounding tolerance) AND we have withdrawals
    const netQuantity = transactions
      .filter(t => t.date >= actualStartDate && t.date <= actualEndDate)
      .reduce((qty, t) => {
        switch (t.type) {
          case 'buy':
          case 'deposit':
            return qty + t.quantity
          case 'sell':
          case 'withdrawal':
            return qty - t.quantity
          default:
            return qty
        }
      }, 0)

    // Consider position closed if:
    // 1. Net quantity is very small (< 0.001 shares) - handles rounding errors
    // 2. We have meaningful withdrawals (> $1)
    // 3. Current value is very small (< $1) - additional check
    const isClosedPosition = Math.abs(netQuantity) < 0.001 &&
                             investmentSummary.totalWithdrawn > 1 &&
                             investmentSummary.currentValue < 1

    // Calculate Time-Weighted Return (TWR) - handle closed positions properly
    let twr = 0
    if (isClosedPosition) {
      // For closed positions, use the simple return based on cash flows
      twr = investmentSummary.totalInvested > 0
        ? (investmentSummary.totalWithdrawn - investmentSummary.totalInvested) / investmentSummary.totalInvested
        : 0
      // If it's an annualized calculation and period > 1 year, annualize it
      if (periodYears > 1) {
        twr = Math.pow(1 + twr, 1 / periodYears) - 1
      }
    } else {
      // For open positions, use the sophisticated method
      twr = this.calculateTimeWeightedReturnFromData(
        filteredData,
        transactions,
        actualStartDate,
        actualEndDate
      )
    }

    // Calculate Money-Weighted Return (XIRR)
    const mwr = this.calculateMoneyWeightedReturn(
      transactions,
      filteredData,
      actualStartDate,
      actualEndDate
    )

    let totalReturn = 0
    if (investmentSummary.totalInvested > 0) {
      if (isClosedPosition) {
        // For closed positions: return = (total withdrawn - total invested) / total invested
        totalReturn = ((investmentSummary.totalWithdrawn - investmentSummary.totalInvested) / investmentSummary.totalInvested) * 100
      } else {
        // For open positions: return = (current value + total withdrawn - total invested) / total invested
        totalReturn = ((investmentSummary.currentValue + investmentSummary.totalWithdrawn - investmentSummary.totalInvested) / investmentSummary.totalInvested) * 100
      }
    }


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
   * Calculate detailed return metrics with capital gains, dividends, and realized/unrealized breakdown
   */
  calculateDetailedReturns(
    transactions: Transaction[],
    historicalData: HistoricalDataPoint[],
    symbols: Symbol[],
    options: DetailedReturnCalculationOptions = {}
  ): DetailedReturnMetrics {

        

    const res = computePortfolioSummaryV2(transactions, historicalData, '2000-01-01', '2025-09-20')
    console.log("computePortfolioSummaryV2", res);


    // First get the basic metrics
    const basicMetrics = this.calculateAnnualizedReturns(transactions, historicalData, symbols, options)

    if (historicalData.length === 0) {
      return this.getEmptyDetailedMetrics()
    }

    const { startDate: optionsStartDate, endDate: optionsEndDate, fifoMethod = true } = options

    // Filter historical data by date range if specified
    let filteredData = historicalData
    if (optionsStartDate || optionsEndDate) {
      filteredData = historicalData.filter(point => {
        const pointDate = point.date
        if (optionsStartDate && pointDate < optionsStartDate) return false
        if (optionsEndDate && pointDate > optionsEndDate) return false
        return true
      })
    }

    if (filteredData.length < 2) {
      return this.getEmptyDetailedMetrics()
    }

    const firstPoint = filteredData[0]
    const lastPoint = filteredData[filteredData.length - 1]

    // Use actual data range for transaction filtering
    const actualStartDate = optionsStartDate || firstPoint.date
    const actualEndDate = optionsEndDate || lastPoint.date

    // Calculate detailed metrics
    const fifoResults = this.calculateFIFORealizedGains(transactions, actualStartDate, actualEndDate)
    const dividendResults = this.calculateDividendIncome(transactions, actualStartDate, actualEndDate)
    const investmentSummary = this.calculateInvestmentSummary(transactions, lastPoint, actualStartDate, actualEndDate)

    // Calculate capital gains (unrealized = current value - remaining cost basis)
    // For closed positions, all gains are realized
    // Handle rounding errors in position detection
    const netQuantity = transactions
      .filter(t => t.date >= actualStartDate && t.date <= actualEndDate)
      .reduce((qty, t) => {
        switch (t.type) {
          case 'buy':
          case 'deposit':
            return qty + t.quantity
          case 'sell':
          case 'withdrawal':
            return qty - t.quantity
          default:
            return qty
        }
      }, 0)

    // Consider position closed if:
    // 1. Net quantity is very small (< 0.001 shares) - handles rounding errors
    // 2. We have meaningful withdrawals (> $1)
    // 3. Current value is very small (< $1) - additional check
    const isClosedPosition = Math.abs(netQuantity) < 0.001 &&
                             investmentSummary.totalWithdrawn > 1 &&
                             investmentSummary.currentValue < 1

    let unrealizedCapitalGains = 0
    let totalReturn = 0

    if (isClosedPosition) {
      // For closed positions: total return = total withdrawn - total invested
      totalReturn = investmentSummary.totalWithdrawn - investmentSummary.totalInvested
      unrealizedCapitalGains = 0 // All gains are realized for closed positions
    } else {
      // For open positions: use the original calculation
      const totalChange = investmentSummary.currentValue - investmentSummary.totalInvested + investmentSummary.totalWithdrawn
      unrealizedCapitalGains = Math.max(0, totalChange - fifoResults.totalRealizedGains - dividendResults.totalDividends)
      totalReturn = investmentSummary.currentValue - investmentSummary.totalInvested + investmentSummary.totalWithdrawn
    }

    // Calculate percentages
    const totalInvested = investmentSummary.totalInvested

    return {
      ...basicMetrics,
      // Override start/end dates to use actual filtered dates
      startDate: actualStartDate,
      endDate: actualEndDate,
      capitalGains: {
        realized: fifoResults.totalRealizedGains,
        unrealized: Math.max(0, unrealizedCapitalGains),
        realizedPercentage: totalInvested > 0 ? (fifoResults.totalRealizedGains / totalInvested) * 100 : 0,
        unrealizedPercentage: totalInvested > 0 ? (unrealizedCapitalGains / totalInvested) * 100 : 0,
        annualizedRate: basicMetrics.timeWeightedReturn // Use TWR as capital appreciation rate
      },
      dividendIncome: {
        total: dividendResults.totalDividends,
        percentage: totalInvested > 0 ? (dividendResults.totalDividends / totalInvested) * 100 : 0,
        annualizedYield: dividendResults.annualizedYield
      },
      realizedVsUnrealized: {
        totalRealized: fifoResults.totalRealizedGains + dividendResults.totalDividends,
        totalUnrealized: Math.max(0, unrealizedCapitalGains),
        realizedPercentage: isClosedPosition ? 100.0 : (totalReturn > 0 ? ((fifoResults.totalRealizedGains + dividendResults.totalDividends) / Math.abs(totalReturn)) * 100 : 0),
        unrealizedPercentage: isClosedPosition ? 0.0 : (totalReturn > 0 ? (unrealizedCapitalGains / Math.abs(totalReturn)) * 100 : 0)
      },
      investmentSummary
    }
  }

  /**
   * Calculate Time-Weighted Return (TWR) from historical data and transactions
   * Uses a weighted average approach based on when money was actually invested
   */
  private calculateTimeWeightedReturnFromData(
    historicalData: HistoricalDataPoint[],
    transactions: Transaction[],
    startDate: string,
    endDate: string
  ): number {
    if (historicalData.length < 2) {
      return 0
    }

    // Get relevant buy transactions within the period
    const relevantTransactions = transactions.filter(t =>
      t.date >= startDate && t.date <= endDate && (t.type === 'buy' || t.type === 'deposit')
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    if (relevantTransactions.length === 0) {
      return 0
    }

    const firstPoint = historicalData[0]
    const lastPoint = historicalData[historicalData.length - 1]
    const currentValue = lastPoint.totalValue || 0

    // For a single holding with regular investments, we can use a simplified TWR approach
    // Calculate the weighted average time money was invested
    const totalEndDate = new Date(endDate).getTime()
    let weightedInvestment = 0
    let totalInvested = 0

    relevantTransactions.forEach(transaction => {
      const investmentAmount = transaction.quantity * transaction.price_per_unit + (transaction.fees || 0)
      const investmentDate = new Date(transaction.date).getTime()
      const timeInvested = (totalEndDate - investmentDate) / (365.25 * 24 * 60 * 60 * 1000) // years

      weightedInvestment += investmentAmount * Math.max(timeInvested, 0.001) // minimum 1 day
      totalInvested += investmentAmount
    })

    if (totalInvested <= 0 || weightedInvestment <= 0) {
      return 0
    }

    // Average time money was invested
    const avgTimeInvested = weightedInvestment / totalInvested

    if (avgTimeInvested <= 0) {
      return 0
    }

    // Calculate total return
    const totalReturn = (currentValue / totalInvested) - 1

    // For periods less than 0.1 years, return simple return
    if (avgTimeInvested < 0.1) {
      return totalReturn
    }

    // Calculate annualized return based on average time invested
    const annualizedReturn = Math.pow(1 + totalReturn, 1 / avgTimeInvested) - 1

    // Reasonable bounds for annualized returns (-95% to +200%)
    return Math.max(-0.95, Math.min(2.0, annualizedReturn))
  }

  /**
   * Calculate Time-Weighted Return (TWR) - legacy method for simple cases
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

    // Calculate simple total return
    const totalReturn = (endValue / startValue) - 1

    // For periods less than 1 year, return simple return
    if (periodYears < 1) {
      return totalReturn
    }

    // Annualized return
    const annualizedReturn = Math.pow(1 + totalReturn, 1 / periodYears) - 1

    // Cap extreme values to prevent unrealistic results
    return Math.max(-0.95, Math.min(5.0, annualizedReturn))
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
          // Income (positive) - handle different data structures
          if (transaction.quantity === 0 && transaction.price_per_unit > 0) {
            // Dividend amount is stored in price_per_unit field
            amount = transaction.price_per_unit
          } else {
            // Standard calculation
            amount = transaction.quantity * transaction.price_per_unit
          }
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
   * Calculate FIFO realized gains from sell transactions
   */
  private calculateFIFORealizedGains(
    transactions: Transaction[],
    startDate: string,
    endDate: string
  ): { totalRealizedGains: number; salesCount: number } {

    // Filter transactions within the date range
    const relevantTransactions = transactions.filter(t =>
      t.date >= startDate && t.date <= endDate
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Track holdings using FIFO
    const holdings: Array<{ quantity: number; costPerUnit: number; date: string }> = []
    let totalRealizedGains = 0
    let salesCount = 0

    for (const transaction of relevantTransactions) {
      const quantity = transaction.quantity
      const pricePerUnit = transaction.price_per_unit
      const fees = transaction.fees || 0

      switch (transaction.type) {
        case 'buy':
        case 'deposit':
          // Add to holdings (FIFO queue)
          holdings.push({
            quantity,
            costPerUnit: pricePerUnit + (fees / quantity), // Include fees in cost basis
            date: transaction.date
          })
          break

        case 'sell':
        case 'withdrawal':
          // Sell using FIFO
          let remainingToSell = quantity
          const salePrice = pricePerUnit - (fees / quantity) // Deduct fees from sale price

          while (remainingToSell > 0 && holdings.length > 0) {
            const oldestHolding = holdings[0]
            const sellFromThisLot = Math.min(remainingToSell, oldestHolding.quantity)

            // Calculate realized gain/loss
            const realizedGain = (salePrice - oldestHolding.costPerUnit) * sellFromThisLot
            totalRealizedGains += realizedGain

            // Update holdings
            oldestHolding.quantity -= sellFromThisLot
            remainingToSell -= sellFromThisLot

            // Remove empty lots
            if (oldestHolding.quantity <= 0) {
              holdings.shift()
            }
          }
          salesCount++
          break

        // Note: dividends and bonuses don't affect cost basis in FIFO calculation
      }
    }

    return {
      totalRealizedGains,
      salesCount
    }
  }

  /**
   * Calculate dividend income within date range
   */
  private calculateDividendIncome(
    transactions: Transaction[],
    startDate: string,
    endDate: string
  ): { totalDividends: number; annualizedYield: number } {

    // Get dividend transactions within the date range
    const dividendTransactions = transactions.filter(t =>
      t.date >= startDate &&
      t.date <= endDate &&
      (t.type === 'dividend' || t.type === 'bonus')
    )

    const totalDividends = dividendTransactions.reduce((sum, t) => {
      // Handle different dividend data structures:
      // Case 1: quantity=0, price_per_unit=dividend_amount (actual dividend amount in price field)
      // Case 2: quantity=dividend_amount, price_per_unit=1 (dividend amount in quantity field)
      // Case 3: quantity=shares, price_per_unit=dividend_per_share (standard structure)

      if (t.quantity === 0 && t.price_per_unit > 0) {
        // Dividend amount is stored in price_per_unit field
        return sum + t.price_per_unit
      } else {
        // Standard calculation
        return sum + (t.quantity * t.price_per_unit)
      }
    }, 0)

    // Calculate annualized yield based on average invested amount
    // Get all buy transactions to calculate average investment
    const buyTransactions = transactions.filter(t =>
      t.date >= startDate &&
      t.date <= endDate &&
      (t.type === 'buy' || t.type === 'deposit')
    )

    const totalInvested = buyTransactions.reduce((sum, t) => {
      return sum + (t.quantity * t.price_per_unit + (t.fees || 0))
    }, 0)

    // Calculate period in years
    const periodYears = this.calculateYearsDifference(startDate, endDate)

    const annualizedYield = totalInvested > 0 && periodYears > 0
      ? (totalDividends / totalInvested / periodYears) * 100
      : 0

    return {
      totalDividends,
      annualizedYield
    }
  }

  /**
   * Calculate investment summary
   */
  private calculateInvestmentSummary(
    transactions: Transaction[],
    lastDataPoint: HistoricalDataPoint,
    startDate: string,
    endDate: string
  ): { totalInvested: number; currentValue: number; totalWithdrawn: number } {

    const relevantTransactions = transactions.filter(t =>
      t.date >= startDate && t.date <= endDate
    )

    let totalInvested = 0
    let totalWithdrawn = 0
    let currentQuantity = 0

    for (const transaction of relevantTransactions) {
      const amount = transaction.quantity * transaction.price_per_unit
      const fees = transaction.fees || 0

      switch (transaction.type) {
        case 'buy':
        case 'deposit':
          totalInvested += amount + fees
          currentQuantity += transaction.quantity
          break
        case 'sell':
        case 'withdrawal':
          totalWithdrawn += amount - fees
          currentQuantity -= transaction.quantity
          break
        // Dividends and bonuses don't affect invested amount or quantity
      }
    }

    // For closed positions (quantity <= 0), current value should be total withdrawn
    // This ensures proper total return calculation: (currentValue + totalWithdrawn - totalInvested) / totalInvested
    const currentValue = currentQuantity <= 0 ? 0 : (lastDataPoint.totalValue || 0)

    return {
      totalInvested,
      currentValue,
      totalWithdrawn
    }
  }

  /**
   * Return empty detailed metrics structure
   */
  private getEmptyDetailedMetrics(): DetailedReturnMetrics {
    const emptyBasic = this.getEmptyMetrics()
    return {
      ...emptyBasic,
      capitalGains: {
        realized: 0,
        unrealized: 0,
        realizedPercentage: 0,
        unrealizedPercentage: 0,
        annualizedRate: 0
      },
      dividendIncome: {
        total: 0,
        percentage: 0,
        annualizedYield: 0
      },
      realizedVsUnrealized: {
        totalRealized: 0,
        totalUnrealized: 0,
        realizedPercentage: 0,
        unrealizedPercentage: 0
      },
      investmentSummary: {
        totalInvested: 0,
        currentValue: 0,
        totalWithdrawn: 0
      }
    }
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