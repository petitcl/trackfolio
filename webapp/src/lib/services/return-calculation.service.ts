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

  // IMPORTANT: For FIFO lot tracking, we need to process ALL transactions from the beginning,
  // not just those in the date range. This ensures lots are built correctly for closed positions.
  const allTxs = transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // For TWR calculation, we still need transactions within the date range
  const txs = allTxs.filter(tx => tx.date >= startDate && tx.date <= endDate);

  const lotsBySymbol: Record<string, Lot[]> = {};
  let realizedPnL = 0;
  let dividends = 0;
  let totalInvested = 0;

  // Process ALL transactions for FIFO lot tracking
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

  // Compute unrealized PnL using historical end values
  const totalCurrentValue = Object.values(histEnd.assetTypeValues).reduce((a, b) => a + b, 0);
  const unrealizedPnL = totalCurrentValue - costBasis;

  // Capital gains and total PnL
  const capitalGains = realizedPnL + unrealizedPnL;
  const totalPnL = capitalGains + dividends;

  // Annualized TWR
  const annualizedReturn = computeAnnualizedTWR(histData, txs, startDate, endDate);

  return {
    totalValue: totalCurrentValue,
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

  // Check if this is a closed position (final value is 0)
  const finalValue = Object.values(histSorted[histSorted.length - 1].assetTypeValues).reduce((a, b) => a + b, 0);
  const isClosedPosition = finalValue === 0;

  // For closed positions, use realized return calculation instead of TWR
  if (isClosedPosition) {
    // Calculate total invested (all buys)
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
      return this.getEmptyReturnMetrics()
    }

    const firstPoint = filteredData[0]
    const lastPoint = filteredData[filteredData.length - 1]
    const periodYears = this.calculateYearsDifference(firstPoint.date, lastPoint.date)

    // Use actual data range for calculation
    const actualStartDate = optionsStartDate || firstPoint.date
    const actualEndDate = optionsEndDate || lastPoint.date

    if (periodYears <= 0) {
      return this.getEmptyReturnMetrics()
    }

    // Calculate V2 summary for P&L breakdown
    const v2Summary = computePortfolioSummaryV2(transactions, filteredData, actualStartDate, actualEndDate)

    // Calculate total return percentage
    let totalReturn = 0
    if (v2Summary.totalInvested > 0) {
      totalReturn = (v2Summary.totalPnL / v2Summary.totalInvested) * 100
    }

    // Calculate XIRR for money-weighted return
    const finalValue = Object.values(lastPoint.assetTypeValues).reduce((a, b) => a + b, 0)
    const xirrTransactions = transactions.filter(tx =>
      tx.date >= actualStartDate && tx.date <= actualEndDate
    )
    const xirr = calculateXIRR(xirrTransactions, finalValue, actualEndDate)

    return {
      // Portfolio Value
      totalValue: v2Summary.totalValue,

      // P&L Breakdown
      totalPnL: v2Summary.totalPnL,
      realizedPnL: v2Summary.realizedPnL,
      unrealizedPnL: v2Summary.unrealizedPnL,
      capitalGains: v2Summary.capitalGains,
      dividends: v2Summary.dividends,

      // Cost Basis
      costBasis: v2Summary.costBasis,
      totalInvested: v2Summary.totalInvested,

      // Annualized Returns
      timeWeightedReturn: v2Summary.annualizedReturn * 100,
      moneyWeightedReturn: xirr * 100,
      totalReturnPercentage: totalReturn,

      // Time Period
      startDate: firstPoint.date,
      endDate: lastPoint.date,
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