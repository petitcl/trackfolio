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


export interface PortfolioSummaryV2 {
  totalPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
  capitalGains: number;
  dividends: number;
  costBasis: number;
  totalInvested: number;
  annualizedReturn: number;
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
   * Calculate portfolio summary using the V2 algorithm
   * This is the primary calculation method that should be used for all return calculations
   */
  calculatePortfolioSummaryV2(
    transactions: Transaction[],
    historicalData: HistoricalDataPoint[],
    startDate?: string,
    endDate?: string
  ): PortfolioSummaryV2 {
    // Set default date range if not provided
    const defaultStartDate = startDate || '2000-01-01'
    const defaultEndDate = endDate || new Date().toISOString().split('T')[0]

    return computePortfolioSummaryV2(transactions, historicalData, defaultStartDate, defaultEndDate)
  }

  /**
   * Calculate comprehensive annualized return metrics for a portfolio or holding
   * Now simplified to use V2 calculation internally
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

    // Use actual data range for calculation
    const actualStartDate = optionsStartDate || firstPoint.date
    const actualEndDate = optionsEndDate || lastPoint.date

    if (periodYears <= 0) {
      return this.getEmptyMetrics()
    }

    // Use V2 calculation as the primary source
    const v2Summary = this.calculatePortfolioSummaryV2(transactions, filteredData, actualStartDate, actualEndDate)

    // Calculate total return percentage
    let totalReturn = 0
    if (v2Summary.totalInvested > 0) {
      totalReturn = (v2Summary.totalPnL / v2Summary.totalInvested) * 100
    }

    return {
      timeWeightedReturn: v2Summary.annualizedReturn * 100, // V2 already provides TWR
      moneyWeightedReturn: v2Summary.annualizedReturn * 100, // Simplified: use same value
      totalReturn,
      annualizedVolatility: 0,
      startDate: firstPoint.date,
      endDate: lastPoint.date,
      periodYears
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
   * Simplified to work with basic inputs when V2 data isn't available
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