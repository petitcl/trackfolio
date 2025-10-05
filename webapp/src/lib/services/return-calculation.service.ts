import type { Transaction, Symbol } from '@/lib/supabase/types'
import type { HistoricalDataPoint } from '@/lib/mockData'

/**
 * Unified return metrics interface
 * Used for both portfolio-level and symbol-level calculations
 * Combines P&L breakdown, cost basis, and annualized returns
 */
export interface ReturnMetrics {
  // Portfolio Value
  totalValue: number  // current total portfolio value

  // P&L Breakdown
  totalPnL: number
  realizedPnL: number
  unrealizedPnL: number
  capitalGains: number
  dividends: number

  // Cost Basis
  costBasis: number  // how much money was invested, taking into account shares sold
  totalInvested: number  // how much money was invested in total

  // Annualized Returns (portfolio-level, zeros for symbol-level)
  timeWeightedReturn: number     // TWR - pure investment performance (%)
  moneyWeightedReturn: number    // XIRR - investor experience with cash flow timing (%)
  totalReturnPercentage: number  // Absolute return percentage (%)

  // Time Period
  startDate: string
  endDate: string
  periodYears: number
}

export type PortfolioReturnMetrics = ReturnMetrics
export type HoldingReturnMetrics = ReturnMetrics

export interface ReturnCalculationOptions {
  startDate?: string
  endDate?: string
}

// FIFO lot
interface Lot {
  quantity: number;
  costPerUnit: number;
}

/**
 * Find the historical data point at or immediately before the specified date
 * Returns the closest point without going past the target date
 */
function findHistoricalDataPointAt(
  histData: HistoricalDataPoint[],
  targetDate: string
): HistoricalDataPoint | null {
  if (histData.length === 0) return null;

  const sorted = histData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Find the last point that is <= targetDate
  let result: HistoricalDataPoint | null = null;
  for (const point of sorted) {
    if (point.date <= targetDate) {
      result = point;
    } else {
      break;
    }
  }

  // If no point found before target, return the first point
  return result || sorted[0];
}

/**
 * Compute portfolio state (cost basis, lots) at a specific date
 * Processes all transactions up to and including the target date
 */
function computePortfolioStateAt(
  transactions: Transaction[],
  targetDate: string
): { costBasis: number; totalInvested: number; realizedPnL: number; dividends: number; lotsBySymbol: Record<string, Lot[]> } {
  const allTxs = transactions
    .filter(tx => tx.date <= targetDate)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const lotsBySymbol: Record<string, Lot[]> = {};
  let realizedPnL = 0;
  let dividends = 0;
  let totalInvested = 0;

  for (const tx of allTxs) {
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
        const sellFeesPerUnit = (tx.fees || 0) / tx.quantity;
        while (remainingQty > 0 && lotsBySymbol[tx.symbol].length > 0) {
          const lot = lotsBySymbol[tx.symbol][0];
          const qtyUsed = Math.min(remainingQty, lot.quantity);
          realizedPnL += qtyUsed * (tx.price_per_unit - sellFeesPerUnit - lot.costPerUnit);
          lot.quantity -= qtyUsed;
          remainingQty -= qtyUsed;
          if (lot.quantity === 0) lotsBySymbol[tx.symbol].shift();
        }
        break;

      case "dividend":
        dividends += (tx.amount || 0);
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

  return { costBasis, totalInvested, realizedPnL, dividends, lotsBySymbol };
}

/**
 * Compute period-specific realized P&L and dividends
 * Only considers transactions within the specified date range
 */
function computePeriodMetrics(
  transactions: Transaction[],
  startDate: string,
  endDate: string
): { periodRealizedPnL: number; periodDividends: number } {
  // Get state at period start (just before)
  const stateBeforeStart = computePortfolioStateAt(transactions, new Date(new Date(startDate).getTime() - 1).toISOString().split('T')[0]);

  // Get state at period end
  const stateAtEnd = computePortfolioStateAt(transactions, endDate);

  // Period metrics are the delta
  const periodRealizedPnL = stateAtEnd.realizedPnL - stateBeforeStart.realizedPnL;
  const periodDividends = stateAtEnd.dividends - stateBeforeStart.dividends;

  return { periodRealizedPnL, periodDividends };
}

interface PortfolioSummary {
  totalValue: number;
  totalPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
  capitalGains: number;
  dividends: number;
  costBasis: number;
  totalInvested: number;
  annualizedReturn: number;
}

/**
 * Compute portfolio metrics for a specific period
 * This calculates period-specific P&L while maintaining accurate cost basis
 */
function computePeriodPortfolioSummary(
  transactions: Transaction[],
  histData: HistoricalDataPoint[],
  startDate: string,
  endDate: string
): PortfolioSummary {
  // Find historical data points at period boundaries
  const histStart = findHistoricalDataPointAt(histData, startDate);
  const histEnd = findHistoricalDataPointAt(histData, endDate);

  if (!histStart || !histEnd) {
    return {
      totalValue: 0,
      totalPnL: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      capitalGains: 0,
      dividends: 0,
      costBasis: 0,
      totalInvested: 0,
      annualizedReturn: 0,
    };
  }

  // Get portfolio state at period end (for current cost basis and total invested)
  const endState = computePortfolioStateAt(transactions, endDate);

  // Get portfolio state at period start
  const startState = computePortfolioStateAt(transactions, startDate);

  // Get period-specific metrics (realized P&L and dividends within period)
  const { periodRealizedPnL, periodDividends } = computePeriodMetrics(transactions, startDate, endDate);

  // Current portfolio value from historical data
  const totalCurrentValue = Object.values(histEnd.assetTypeValues).reduce((a, b) => a + b, 0);
  const startValue = Object.values(histStart.assetTypeValues).reduce((a, b) => a + b, 0);

  // Unrealized P&L at period end vs period start
  const unrealizedPnLEnd = totalCurrentValue - endState.costBasis;
  const unrealizedPnLStart = startValue - startState.costBasis;
  const periodUnrealizedPnLChange = unrealizedPnLEnd - unrealizedPnLStart;

  // Period capital gains = period realized + change in unrealized
  const periodCapitalGains = periodRealizedPnL + periodUnrealizedPnLChange;

  // Period total P&L = capital gains + dividends
  const periodTotalPnL = periodCapitalGains + periodDividends;

  // Annualized TWR uses full historical data (calculated separately)
  const annualizedReturn = computeAnnualizedTWR(histData, transactions);

  return {
    totalValue: totalCurrentValue,
    totalPnL: periodTotalPnL,
    realizedPnL: periodRealizedPnL,
    unrealizedPnL: periodUnrealizedPnLChange, // Change in unrealized P&L during period
    capitalGains: periodCapitalGains,
    dividends: periodDividends,
    costBasis: endState.costBasis,
    totalInvested: endState.totalInvested,
    annualizedReturn,
  };
}

/**
 * Compute annualized Time-Weighted Return (TWR)
 * ALWAYS uses full historical data - never filtered by date range
 * This represents the lifetime performance of the portfolio
 */
function computeAnnualizedTWR(
  histData: HistoricalDataPoint[],
  transactions: Transaction[]
): number {
  // Sort historical data - use ALL data points
  const histSorted = histData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (histSorted.length < 2) return 0;

  // Check if this is a closed position (final value is 0)
  const finalValue = Object.values(histSorted[histSorted.length - 1].assetTypeValues).reduce((a, b) => a + b, 0);
  const isClosedPosition = finalValue === 0;

  // For closed positions, use realized return calculation instead of TWR
  if (isClosedPosition) {
    // Calculate total invested (all buys) and total proceeds (all sells)
    let totalInvested = 0;
    let totalProceeds = 0;

    for (const tx of transactions) {
      switch (tx.type) {
        case "buy":
          totalInvested += tx.price_per_unit * tx.quantity + (tx.fees || 0);
          break;
        case "sell":
          totalProceeds += tx.price_per_unit * tx.quantity - (tx.fees || 0);
          break;
      }
    }

    if (totalInvested === 0) return 0;

    // Simple annualized return: ((proceeds / invested) ^ (1/years)) - 1
    const years =
      (new Date(histSorted[histSorted.length - 1].date).getTime() -
        new Date(histSorted[0].date).getTime()) /
      (1000 * 3600 * 24 * 365.25);

    if (years <= 0) return 0;

    const totalReturn = totalProceeds / totalInvested;
    return Math.pow(totalReturn, 1 / years) - 1;
  }

  // Standard TWR calculation for open positions
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
            return acc - (tx.price_per_unit * tx.quantity - (tx.fees || 0));
          // dividend is inflow, reduce net outflow
          case "dividend":
            return acc - (tx.amount || 0);
          default:
            return acc;
        }
      }, 0);

    const V_start = Object.values(start.assetTypeValues).reduce((a, b) => a + b, 0);
    const V_end = Object.values(end.assetTypeValues).reduce((a, b) => a + b, 0);

    if (V_start + cf > 0) {
      const periodReturn = V_end / (V_start + cf) - 1;
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
 * Calculate XIRR (Extended Internal Rate of Return) using Newton's method
 * This is the money-weighted return that accounts for the timing of cash flows
 */
function calculateXIRR(
  transactions: Transaction[],
  endValue: number,
  endDate: string,
  maxIterations: number = 100,
  tolerance: number = 0.000001
): number {
  // Build cash flow array
  const cashFlows: { amount: number; date: Date }[] = [];

  // Add all transactions as cash flows
  for (const tx of transactions) {
    let amount = 0;
    switch (tx.type) {
      case 'buy':
        // Money out (negative)
        amount = -(tx.price_per_unit * tx.quantity + (tx.fees || 0));
        break;
      case 'sell':
        // Money in (positive)
        amount = tx.price_per_unit * tx.quantity - (tx.fees || 0);
        break;
      case 'dividend':
        // Money in (positive)
        amount = (tx.amount || 0);
        break;
      case 'deposit':
        // Money out (negative)
        amount = -tx.price_per_unit;
        break;
      case 'withdrawal':
        // Money in (positive)
        amount = tx.price_per_unit;
        break;
      default:
        continue;
    }

    if (amount !== 0) {
      cashFlows.push({
        amount,
        date: new Date(tx.date)
      });
    }
  }

  // Add final portfolio value as positive cash flow
  if (endValue > 0) {
    cashFlows.push({
      amount: endValue,
      date: new Date(endDate)
    });
  }

  // Need at least 2 cash flows
  if (cashFlows.length < 2) return 0;

  // Sort by date
  cashFlows.sort((a, b) => a.date.getTime() - b.date.getTime());

  const firstDate = cashFlows[0].date;

  // Calculate days from start for each cash flow
  const flows = cashFlows.map(cf => ({
    amount: cf.amount,
    days: (cf.date.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
  }));

  // XIRR calculation using Newton's method
  // Initial guess based on simple return
  const totalIn = flows.filter(f => f.amount < 0).reduce((sum, f) => sum - f.amount, 0);
  const totalOut = flows.filter(f => f.amount > 0).reduce((sum, f) => sum + f.amount, 0);
  let rate = totalIn > 0 ? (totalOut / totalIn - 1) / (flows[flows.length - 1].days / 365.25) : 0.1;

  for (let i = 0; i < maxIterations; i++) {
    // Calculate NPV and its derivative
    let npv = 0;
    let dnpv = 0;

    for (const flow of flows) {
      const years = flow.days / 365.25;
      const pv = flow.amount / Math.pow(1 + rate, years);
      npv += pv;
      dnpv -= years * pv / (1 + rate);
    }

    // Check convergence
    if (Math.abs(npv) < tolerance) {
      return rate;
    }

    // Newton's method update
    if (dnpv === 0) break;
    const newRate = rate - npv / dnpv;

    // Bound the rate to prevent divergence
    if (newRate < -0.99) {
      rate = -0.99;
    } else if (newRate > 10) {
      rate = 10;
    } else {
      rate = newRate;
    }
  }

  return rate;
}

/**
 * Service for calculating various return metrics including annualized returns
 * Supports both Time-Weighted Return (TWR) and Money-Weighted Return (XIRR)
 */
export class ReturnCalculationService {

  /**
   * Calculate unified portfolio return metrics
   * This is the primary calculation method that should be used for all return calculations
   * Returns sensible defaults (zeros) when insufficient data is available
   *
   * IMPORTANT:
   * - Annualized returns (TWR, XIRR) are ALWAYS calculated from full lifetime data
   * - Period metrics (totalPnL, unrealizedPnL, etc.) are calculated for the specified date range
   */
  calculatePortfolioReturnMetrics(
    transactions: Transaction[],
    historicalData: HistoricalDataPoint[],
    symbols: Symbol[],
    options: ReturnCalculationOptions = {}
  ): ReturnMetrics {
    // Return empty metrics if insufficient data
    if (historicalData.length < 2) {
      return this.getEmptyReturnMetrics()
    }

    const { startDate: optionsStartDate, endDate: optionsEndDate } = options

    // Determine period boundaries - use full range if not specified
    const sortedData = historicalData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const firstAvailableDate = sortedData[0].date
    const lastAvailableDate = sortedData[sortedData.length - 1].date

    // IMPORTANT: If requested start date is before first available data, use first available date
    // This prevents calculating returns from before the portfolio existed
    let actualStartDate = optionsStartDate || firstAvailableDate
    if (optionsStartDate && optionsStartDate < firstAvailableDate) {
      actualStartDate = firstAvailableDate
    }

    const actualEndDate = optionsEndDate || lastAvailableDate

    // Find historical data points at period boundaries
    const startPoint = findHistoricalDataPointAt(historicalData, actualStartDate)
    const endPoint = findHistoricalDataPointAt(historicalData, actualEndDate)

    if (!startPoint || !endPoint) {
      return this.getEmptyReturnMetrics()
    }

    const totalRangeDuration = this.calculateYearsDifference(startPoint.date, endPoint.date)
    if (totalRangeDuration <= 0) {
      return this.getEmptyReturnMetrics()
    }

    // Calculate period-specific summary (P&L for the selected time range)
    const periodSummary = computePeriodPortfolioSummary(
      transactions,
      historicalData,  // Pass full historical data
      startPoint.date,  // Use actual found start point
      endPoint.date     // Use actual found end point
    )

    // Calculate total return percentage for the period
    // This represents the total P&L as a percentage of the cost basis
    let totalReturnPercentage = 0
    if (periodSummary.costBasis > 0) {
      // Total return % = Total P&L / Cost Basis
      // This shows the total gain/loss relative to the amount invested
      totalReturnPercentage = (periodSummary.totalPnL / periodSummary.costBasis) * 100
    }

    // Calculate XIRR for money-weighted return - ALWAYS use ALL transactions
    const finalValue = Object.values(endPoint.assetTypeValues).reduce((a, b) => a + b, 0)
    const xirr = calculateXIRR(transactions, finalValue, endPoint.date)

    const periodYears = this.calculateYearsDifference(firstAvailableDate, lastAvailableDate)
    return {
      // Portfolio Value
      totalValue: periodSummary.totalValue,

      // P&L Breakdown (period-specific)
      totalPnL: periodSummary.totalPnL,
      realizedPnL: periodSummary.realizedPnL,
      unrealizedPnL: periodSummary.unrealizedPnL,
      capitalGains: periodSummary.capitalGains,
      dividends: periodSummary.dividends,

      // Cost Basis
      costBasis: periodSummary.costBasis,
      totalInvested: periodSummary.totalInvested,

      // Annualized Returns (lifetime, not affected by date range)
      timeWeightedReturn: periodSummary.annualizedReturn * 100,
      moneyWeightedReturn: xirr * 100,

      // Period Return Percentage (period-specific)
      totalReturnPercentage: totalReturnPercentage,

      // Time Period
      startDate: startPoint.date,
      endDate: endPoint.date,
      periodYears
    }
  }

  /**
   * Return empty metrics structure (all zeros)
   */
  getEmptyReturnMetrics(): ReturnMetrics {
    return {
      totalValue: 0,
      totalPnL: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      capitalGains: 0,
      dividends: 0,
      costBasis: 0,
      totalInvested: 0,
      timeWeightedReturn: 0,
      moneyWeightedReturn: 0,
      totalReturnPercentage: 0,
      startDate: '',
      endDate: '',
      periodYears: 0
    }
  }

  /**
   * Calculate the difference in years between two dates
   */
  private calculateYearsDifference(startDate: string, endDate: string): number {
    const start = new Date(startDate).getTime()
    const end = new Date(endDate).getTime()
    return (end - start) / (365.25 * 24 * 60 * 60 * 1000)
  }

}

// Singleton instance
export const returnCalculationService = new ReturnCalculationService()