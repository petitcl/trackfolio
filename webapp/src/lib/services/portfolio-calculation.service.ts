import type { AuthUser } from '@/lib/auth/client.auth.service'
import type { Transaction, Symbol } from '@/lib/supabase/types'
import type { HistoricalDataPoint } from '@/lib/mockData'
import type { TimeRange, TimePeriod } from '@/lib/utils/timeranges'
import { getStartDateForTimeRange, getGroupByTimePeriodForTimeRange, getTimePeriodBucketsForTimePeriod } from '@/lib/utils/timeranges'
import { historicalPriceService } from './historical-price.service'
import { currencyService, type SupportedCurrency } from './currency.service'
import { cacheService } from './cache.service'

// ============================================================================
// DATA MODEL DOCUMENTATION
// ============================================================================
/**
 * TRACKFOLIO DATA MODEL OVERVIEW
 *
 * This service is the core calculation engine for portfolio tracking. Understanding
 * the data model is critical for maintaining and extending this code.
 *
 * ============================================================================
 * TRANSACTION TYPES
 * ============================================================================
 *
 * Transactions are the fundamental building blocks. All portfolio state is derived
 * from processing transactions chronologically using FIFO (First-In-First-Out) logic.
 *
 * ## Standard Asset Transactions
 *
 * **BUY** - Purchase of shares/units
 *   - Adds quantity to position
 *   - Increases cost basis by (quantity × price_per_unit + fees)
 *   - Creates a new FIFO lot with costPerUnit = price_per_unit + (fees / quantity)
 *   - Increases totalInvested
 *   - Example: Buy 10 shares of AAPL at $150 with $5 fees
 *     → quantity: 10, price_per_unit: 150, fees: 5
 *     → Lot: { quantity: 10, costPerUnit: 150.50 }
 *
 * **SELL** - Sale of shares/units
 *   - Reduces quantity from position (FIFO: sells oldest lots first)
 *   - Realizes capital gains/losses by comparing sale price to lot cost basis
 *   - Calculates realized P&L = quantity × (sale_price - fees_per_unit - lot_cost)
 *   - Does NOT reduce totalInvested (that's already counted from the buy)
 *   - Example: Sell 5 shares at $160 with $3 fees, oldest lot cost $150.50
 *     → Realized P&L = 5 × (160 - 0.60 - 150.50) = $44.50
 *
 * **DIVIDEND** - Can be EITHER stock dividend OR cash dividend
 *   - Stock dividend (quantity > 0): Adds shares to position
 *     → Increases quantity, no cost basis change (costPerUnit = 0 for new lot)
 *     → Example: Receive 2 bonus shares → quantity increases by 2
 *   - Cash dividend (quantity = 0, amount > 0): Cash payment to investor
 *     → Tracked separately in dividends accumulator
 *     → Does NOT affect position quantity or cost basis
 *     → Example: $50 dividend payment → dividends += 50
 *
 * **BONUS** - Bonus shares issued by company (stock split, rights issue, etc.), or re-invested dividends
 *   - Similar to stock dividend but explicitly labeled as bonus
 *   - Adds quantity to position with zero cost basis
 *   - Creates lot with costPerUnit = 0
 *   - Example: 1-for-10 bonus issue → existing holder gets 1 free share per 10 held
 *
 * ## Account/Cash Asset Transactions
 *
 * These are for tracking cash accounts, bank accounts, or currency holdings.
 * They use "amount" instead of "quantity × price_per_unit".
 *
 * **DEPOSIT** - Add cash to account
 *   - Increases position value by amount
 *   - Increases cost basis and totalInvested
 *   - Creates a FIFO lot with amount field (not quantity × costPerUnit)
 *   - Example: Deposit $1000 to savings account
 *     → Lot: { quantity: 1, costPerUnit: 0, amount: 1000 }
 *
 * **WITHDRAWAL** - Remove cash from account
 *   - Decreases position value by amount
 *   - Uses FIFO to remove from oldest deposit lots
 *   - Reduces cost basis proportionally
 *   - Example: Withdraw $300 from account with two deposits [$1000, $500]
 *     → Removes $300 from first lot, leaving [$700, $500]
 *
 * ============================================================================
 * HOLDING TYPES
 * ============================================================================
 *
 * Holdings (Symbols) can be categorized in two dimensions:
 *
 * ## Dimension 1: Market vs Custom (is_custom field)
 *
 * **MARKET HOLDINGS** (is_custom = false)
 *   - Public securities with market prices (stocks, ETFs, crypto)
 *   - Prices fetched from external APIs (Yahoo Finance, CoinGecko)
 *   - symbol.last_price contains current market price
 *   - Historical prices from symbol_price_history table
 *   - Examples: AAPL, MSFT, BTC, SPY
 *
 * **CUSTOM HOLDINGS** (is_custom = true)
 *   - User-created assets without market prices
 *   - Prices set manually by user via user_symbol_prices table
 *   - Examples: Real estate, collectibles, private equity, art
 *   - User must update prices periodically for accurate valuations
 *   - symbol.last_price is ignored (always use historical price service)
 *
 * ## Dimension 2: Standard vs Account (holding_type field)
 *
 * **STANDARD HOLDINGS** (holding_type = 'standard' or null)
 *   - Quantifiable assets with units/shares
 *   - Value = quantity × price_per_unit
 *   - Uses buy/sell/dividend/bonus transactions
 *   - Examples: Stocks, crypto, real estate units
 *   - Most holdings are standard type
 *
 * **ACCOUNT HOLDINGS** (holding_type = 'account')
 *   - Cash accounts or currency holdings
 *   - Value = account balance (price_per_unit IS the balance, not a unit price)
 *   - Uses deposit/withdrawal transactions
 *   - quantity field is typically 1 (meaningless for accounts)
 *   - Examples: Savings account, checking account, cash reserve
 *   - Special handling: In historical data, historicalPrice IS the account balance
 *
 * ## Asset Types (asset_type field)
 *
 * Used for portfolio allocation/diversification display:
 *   - 'stock' - Public equities
 *   - 'crypto' - Cryptocurrencies
 *   - 'real_estate' - Property, REITs
 *   - 'cash' - Cash accounts, money market
 *   - 'currency' - Foreign currency holdings
 *   - 'other' - Everything else (collectibles, private equity, etc.)
 *
 * ============================================================================
 * COST BASIS & FIFO TRACKING
 * ============================================================================
 *
 * **Cost Basis**: The amount of money invested that is still "at risk" in the portfolio
 *   - Initial value: Sum of all buy transactions
 *   - Decreases when: Shares are sold (proportionally)
 *   - Increases when: Shares are bought
 *   - Example: Buy 10 @ $100 (cost basis = $1000), sell 5 @ $120
 *     → Cost basis reduces to $500 (50% sold)
 *
 * **Total Invested**: Lifetime sum of ALL money put into portfolio (never decreases)
 *   - Increases with: buys, deposits
 *   - Never decreases (even when selling)
 *   - Used for XIRR (money-weighted return) calculation
 *
 * **FIFO (First-In-First-Out) Lot Tracking**:
 *   - Each buy creates a "lot" with specific quantity and cost per unit
 *   - Sells consume from oldest lots first
 *   - Critical for accurate realized P&L and cost basis
 *   - Example:
 *     → Buy 10 @ $100 (Lot A)
 *     → Buy 5 @ $110 (Lot B)
 *     → Sell 12 → Sells all of Lot A (10 shares) + 2 from Lot B
 *     → Remaining: 3 shares @ $110 cost basis
 *
 * ============================================================================
 * P&L CALCULATION
 * ============================================================================
 *
 * **Realized P&L**: Gains/losses from completed sales
 *   - sell_proceeds - cost_basis_of_sold_shares - fees
 *   - Locked in, cannot change
 *
 * **Unrealized P&L**: Gains/losses on currently held positions
 *   - current_value - current_cost_basis
 *   - Changes with market prices
 *
 * **Capital Gains**: realized_pnl + unrealized_pnl
 *   - Total gains from price appreciation
 *
 * **Dividends**: Cash dividends received (tracked separately)
 *   - Not included in capital gains
 *
 * **Total P&L**: capital_gains + dividends
 *   - Complete picture of investment returns
 *
 * ============================================================================
 * RETURN METRICS
 * ============================================================================
 *
 * **Time-Weighted Return (TWR)**: Pure investment performance
 *   - Eliminates impact of investor cash flows
 *   - Answers: "How well did the investment perform?"
 *   - Good for comparing to benchmarks
 *   - Always calculated from full lifetime (not filtered by date range)
 *
 * **Money-Weighted Return (XIRR)**: Investor experience
 *   - Accounts for timing and size of cash flows
 *   - Answers: "How well did I do as an investor?"
 *   - Penalizes bad timing (buying high, selling low)
 *   - Calculated using Newton's method for IRR
 *   - Always uses ALL transactions (not filtered by date range)
 *
 * **Total Return %**: Simple return for a specific period
 *   - (total_pnl / avg_capital) × 100
 *   - CAN be calculated for filtered date ranges
 *
 * ============================================================================
 * CURRENCY HANDLING
 * ============================================================================
 *
 * - Each symbol has a currency field (USD, EUR, GBP, etc.)
 * - All calculations convert to a target currency for display
 * - Exchange rates fetched for the specific date (historical accuracy)
 * - Cost basis, dividends, and values all converted consistently
 * - Fallback to 1:1 rate if conversion fails (with warning)
 *
 * ============================================================================
 * CACHING STRATEGY
 * ============================================================================
 *
 * - Historical data is expensive (loops through every day)
 * - Cache key: user_id + symbol/portfolio + target_currency
 * - TTL: 5 minutes for portfolio-level, appropriate for holdings
 * - Invalidate on: transaction add/edit/delete, manual price update
 *
 * ============================================================================
 * KEY INVARIANTS
 * ============================================================================
 *
 * 1. **Transaction Order Matters**: Always sort by date before processing
 * 2. **FIFO is Sacred**: Never process sells without FIFO lot tracking
 * 3. **Cost Basis ≤ Total Invested**: Always true by definition
 * 4. **Closed Positions**: quantity = 0, cost_basis = 0, but preserve history
 * 5. **Account Holdings**: price_per_unit IS the balance, not a unit price
 * 6. **Annualized Returns**: Always use full lifetime data, never filtered
 * 7. **Period Metrics**: CAN use filtered date ranges (total_pnl, etc.)
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================


/**
 * Represents a single holding's current state in the portfolio.
 * This is the public interface used by UI components to display positions.
 *
 * Contains calculated values like current price, total value, and dividend income.
 * Includes flags to distinguish between different holding types (custom vs market, account vs standard).
 */
export interface PortfolioPosition {
  symbol: string           // Symbol identifier (e.g., "AAPL", "BTC", "MY_HOUSE")
  quantity: number         // Number of shares/units held (0 for closed positions)
  avgCost: number          // Average cost basis per unit
  currentPrice: number     // Current market/manual price (in target currency)
  value: number            // Current total value (quantity × currentPrice for standard, balance for accounts)
  isCustom: boolean        // true for user-created assets (real estate, collectibles, private equity)
  isAccount: boolean       // true for account holdings (cash accounts, trading accounts) where holding_type='account'
  isClosed: boolean        // true for closed positions (quantity <= 0) that are not accounts
  dividendIncome: number   // Total dividends received (in target currency)
}

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
  unrealizedPnlPercentage: number
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

/**
 * Performance metrics for a specific time bucket (e.g., one year, one quarter, one month)
 */
export interface PeriodBucketMetrics {
  periodKey: string           // e.g., "2024", "2024-Q1", "2024-01", "2024-01-15"
  startDate: string
  endDate: string

  // Value metrics
  startValue: number         // Portfolio value at period start
  endValue: number           // Portfolio value at period end

  // P&L breakdown (period-specific)
  totalPnL: number
  realizedPnL: number
  unrealizedPnLChange: number  // Change in unrealized during this period
  capitalGains: number         // Realized + unrealized change
  dividends: number

  // Return metrics
  totalReturnPercentage: number         // Simple return % for this bucket

  // Cash flows during period
  netInflows: number          // Buy - Sell (excluding dividends)
}

/**
 * Bucketed return metrics for a time range
 * Breaks down performance into sub-periods (e.g., yearly buckets for "all" time range)
 */
export interface BucketedReturnMetrics {
  buckets: PeriodBucketMetrics[]
  timePeriod: TimePeriod       // 'day' | 'week' | 'month' | 'quarter' | 'year'
  totalMetrics: ReturnMetrics  // Overall metrics for entire range
}

// Internal position tracking
interface UnifiedPosition {
  symbol: string
  quantity: number
  avgCost: number
  totalCost: number
  dividendIncome: number
}

// FIFO lot for precise cost basis tracking
interface Lot {
  quantity: number
  costPerUnit: number
  // only for dividend & withdrawal
  amount?: number
}

// Portfolio state at a specific date
interface PortfolioState {
  costBasis: number
  totalInvested: number
  realizedPnL: number
  dividends: number
  lotsBySymbol: Record<string, Lot[]>
}

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

/**
 * Unified Portfolio Calculation Service
 *
 * Consolidates logic from:
 * - UnifiedCalculationService (position calculation)
 * - ReturnCalculationService (P&L and returns)
 * - HistoricalDataService (time series generation)
 *
 * Uses superior FIFO lot tracking from ReturnCalculationService throughout
 */
export class PortfolioCalculationService {

  // ==========================================================================
  // SECTION 1: POSITION CALCULATION
  // ==========================================================================

  /**
   * Calculate positions up to a specific date
   * Simplified position tracking without full FIFO (used for filtering only)
   * For accurate cost basis, use computePortfolioStateAt() instead
   */
  private calculatePositionsUpToDate(
    transactions: Transaction[],
    date: string,
    targetSymbol: string | undefined,
    allSymbols: Symbol[],
    includeClosedPositions?: boolean,
  ): UnifiedPosition[] {
    // For single holdings, include closed positions to continue tracking after liquidation
    // For portfolio, exclude closed positions by default unless explicitly requested
    const shouldIncludeClosedPositions = includeClosedPositions !== undefined ? includeClosedPositions : !!targetSymbol

    // Filter transactions up to date and optionally by symbol
    const relevantTransactions = transactions
      .filter(t => t.date <= date)
      .filter(t => !targetSymbol || t.symbol === targetSymbol)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const positionMap = new Map<string, UnifiedPosition>()

    relevantTransactions.forEach(transaction => {
      const symbol = transaction.symbol
      const existing = positionMap.get(symbol) || {
        symbol,
        quantity: 0,
        avgCost: 0,
        totalCost: 0,
        dividendIncome: 0
      }

      if (transaction.type === 'buy') {
        existing.quantity += transaction.quantity
        existing.totalCost += transaction.quantity * transaction.price_per_unit
        existing.avgCost = existing.quantity > 0 ? existing.totalCost / existing.quantity : 0
      } else if (transaction.type === 'sell') {
        existing.quantity -= transaction.quantity
        if (existing.quantity <= 0) {
          if (!shouldIncludeClosedPositions) {
            positionMap.delete(symbol)
            return
          }
          // For closed positions, preserve data but reset cost basis
          existing.totalCost = 0
          existing.avgCost = 0
        } else {
          // Maintain cost basis proportionally
          existing.totalCost = existing.quantity * existing.avgCost
        }
      } else if (transaction.type === 'deposit') {
        // Deposit adds to cost basis without changing quantity
        existing.totalCost += (transaction.amount || 0)
      } else if (transaction.type === 'withdrawal') {
        // Withdrawal reduces cost basis without changing quantity
        existing.totalCost -= (transaction.amount || 0)
        existing.totalCost = Math.max(0, existing.totalCost)
      } else if (transaction.type === 'dividend') {
        if (transaction.quantity > 0) {
          // Stock dividend - add shares
          existing.quantity += transaction.quantity
          existing.totalCost += transaction.quantity * transaction.price_per_unit
          existing.avgCost = existing.quantity > 0 ? existing.totalCost / existing.quantity : 0
        } else {
          // Cash dividend - track as income
          existing.dividendIncome += (transaction.amount || 0)
        }
      } else if (transaction.type === 'bonus') {
        // Bonus shares - add to position
        existing.quantity += transaction.quantity
        existing.totalCost += transaction.quantity * transaction.price_per_unit
        existing.avgCost = existing.quantity > 0 ? existing.totalCost / existing.quantity : 0
      }

      const symbolData = allSymbols.find(s => s.symbol == symbol)!
      const isAccount = symbolData?.holding_type === 'account'
      if (existing.quantity > 0 || isAccount || (shouldIncludeClosedPositions && existing.quantity === 0)) {
        positionMap.set(symbol, existing)
      }
    })

    return Array.from(positionMap.values())
  }

  /**
   * Get historical price for a symbol on a specific date
   * Uses consistent logic and fallback strategy
   */
  private async getUnifiedHistoricalPrice(
    symbol: string,
    date: string,
    user: AuthUser,
    symbolData: Symbol,
    priceMap?: Map<string, number>
  ): Promise<number | null> {
    // Try price map lookup first (for performance) with latest-price-before-date logic
    if (priceMap) {
      let latestPrice: number | null = null
      let latestDate = ''

      for (const [priceDate, price] of priceMap.entries()) {
        if (priceDate <= date && priceDate > latestDate) {
          latestDate = priceDate
          latestPrice = price
        }
      }

      if (latestPrice !== null) {
        return latestPrice
      }
    }

    // Fall back to complex lookup (handles custom symbols, user prices, etc.)
    // const symbolData = symbols.find(s => s.symbol === symbol) || null
    return await historicalPriceService.getHistoricalPriceForDate(
      symbol,
      date,
      user,
      symbolData
    )
  }

  /**
   * Calculate current positions using unified logic
   * Returns PortfolioPosition format for compatibility
   */
  async calculateCurrentPositions(
    transactions: Transaction[],
    symbols: Symbol[],
    user: AuthUser,
    targetCurrency: SupportedCurrency = 'USD',
    includeClosedPositions: boolean = false,
    explicitPositions?: Array<{ symbol: string }> // Optional: positions without transactions
  ): Promise<PortfolioPosition[]> {
    const currentDate = new Date().toISOString().split('T')[0]

    // Calculate positions as of current date from transactions
    const unifiedPositions = this.calculatePositionsUpToDate(transactions, currentDate, undefined, symbols, includeClosedPositions)

    // Add positions that exist but have no transactions (quantity = 0)
    if (explicitPositions) {
      const transactionSymbols = new Set(unifiedPositions.map(p => p.symbol))

      for (const position of explicitPositions) {
        if (!transactionSymbols.has(position.symbol)) {
          unifiedPositions.push({
            symbol: position.symbol,
            quantity: 0,
            totalCost: 0,
            avgCost: 0,
            dividendIncome: 0
          })
        }
      }
    }

    if (unifiedPositions.length === 0) {
      return []
    }

    // Convert to PortfolioPosition format with current prices - process in parallel
    const portfolioPositions = await Promise.all(unifiedPositions.map(async (position) => {
      const symbolData = symbols.find(s => s.symbol === position.symbol)!

      // Get current price - handle custom vs market symbols differently
      let finalCurrentPrice: number = 0

      if (symbolData?.is_custom) {
        // For custom symbols, always use historical price service to get latest manual price
        const historicalPrice = await this.getUnifiedHistoricalPrice(
          position.symbol,
          currentDate,
          user,
          symbolData,
        )
        finalCurrentPrice = historicalPrice || position.avgCost
      } else {
        // For market symbols, prioritize symbol's last_price (current market price)
        finalCurrentPrice = symbolData?.last_price || 0

        // Fallback to historical price if no last_price available
        if (!finalCurrentPrice) {
          const historicalPrice = await this.getUnifiedHistoricalPrice(
            position.symbol,
            currentDate,
            user,
            symbolData,
          )
          finalCurrentPrice = historicalPrice || position.avgCost
        }
      }

      // Convert to target currency if needed
      const symbolCurrency = (symbolData?.currency || 'USD') as SupportedCurrency
      let convertedCurrentPrice = finalCurrentPrice
      let convertedDividendIncome = position.dividendIncome

      if (symbolCurrency !== targetCurrency) {
        try {
          const conversionRate = await currencyService.getExchangeRate(
            symbolCurrency,
            targetCurrency,
            user,
            symbols,
            currentDate
          )
          convertedCurrentPrice = finalCurrentPrice * conversionRate
          convertedDividendIncome = position.dividendIncome * conversionRate
        } catch (error) {
          console.warn(`Failed to convert ${position.symbol} from ${symbolCurrency} to ${targetCurrency}:`, error)
        }
      }

      // Calculate value WITHOUT dividend income
      const isAccount = symbolData?.holding_type === 'account'
      let value: number
      if (isAccount) {
        // Account holdings: finalCurrentPrice IS the account balance (already converted)
        value = convertedCurrentPrice
      } else {
        // Regular holdings: value = quantity × price
        value = position.quantity * convertedCurrentPrice
      }

      // Determine if position is closed (quantity <= 0 AND not an account)
      const isClosed = !isAccount && position.quantity <= 0

      return {
        symbol: position.symbol,
        quantity: position.quantity,
        avgCost: position.avgCost,
        currentPrice: convertedCurrentPrice,
        value: value,
        isCustom: symbolData?.is_custom || false,
        isAccount: isAccount,
        isClosed: isClosed,
        dividendIncome: convertedDividendIncome
      }
    }))

    return portfolioPositions
  }

  // ==========================================================================
  // SECTION 2: FIFO LOT TRACKING
  // ==========================================================================

  /**
   * Compute portfolio state (cost basis, lots) at a specific date
   * Processes all transactions up to and including the target date
   * Uses precise FIFO lot tracking for accurate cost basis
   */
  private computePortfolioStateAt(
    transactions: Transaction[],
    targetDate: string
  ): PortfolioState {
    const allTxs = transactions
      .filter(tx => tx.date <= targetDate)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const lotsBySymbol: Record<string, Lot[]> = {}
    let realizedPnL = 0
    let dividends = 0
    let totalInvested = 0

    for (const tx of allTxs) {
      if (!lotsBySymbol[tx.symbol]) lotsBySymbol[tx.symbol] = []

      switch (tx.type) {
        case "buy":
          if (tx.quantity > 0) {
            lotsBySymbol[tx.symbol].push({ quantity: tx.quantity, costPerUnit: tx.price_per_unit + (tx.fees || 0) / tx.quantity })
            totalInvested += tx.price_per_unit * tx.quantity + (tx.fees || 0)
          }
          break

        case "sell":
          let remainingQty = tx.quantity
          const sellFeesPerUnit = (tx.fees || 0) / tx.quantity
          while (remainingQty > 0 && lotsBySymbol[tx.symbol].length > 0) {
            const lot = lotsBySymbol[tx.symbol][0]
            const qtyUsed = Math.min(remainingQty, lot.quantity)
            realizedPnL += qtyUsed * (tx.price_per_unit - sellFeesPerUnit - lot.costPerUnit)
            lot.quantity -= qtyUsed
            remainingQty -= qtyUsed
            if (lot.quantity === 0) lotsBySymbol[tx.symbol].shift()
          }
          break

        case "dividend":
          dividends += (tx.amount || 0)
          break

        case "deposit":
          // Deposit adds a cash lot with amount field for FIFO tracking
          lotsBySymbol[tx.symbol].push({
            quantity: 1,           // Placeholder for lot tracking
            costPerUnit: 0,        // Not meaningful for cash
            amount: tx.amount || 0 // Actual cash amount deposited
          })
          totalInvested += tx.amount || 0
          break

        case "withdrawal":
          // Withdrawal removes cash using FIFO
          let remainingAmount = tx.amount || 0
          while (remainingAmount > 0 && lotsBySymbol[tx.symbol].length > 0) {
            const lot = lotsBySymbol[tx.symbol][0]
            const lotAmount = lot.amount || 0

            if (lotAmount <= 0) {
              lotsBySymbol[tx.symbol].shift()
              continue
            }

            const amountUsed = Math.min(remainingAmount, lotAmount)
            lot.amount = lotAmount - amountUsed
            remainingAmount -= amountUsed

            if (lot.amount <= 0) {
              lotsBySymbol[tx.symbol].shift()
            }
          }
          break

        case "bonus":
          if (tx.quantity > 0) lotsBySymbol[tx.symbol].push({ quantity: tx.quantity, costPerUnit: 0 })
          break
      }
    }

    // Compute cost basis of remaining lots
    let costBasis = 0
    for (const symbol in lotsBySymbol) {
      for (const lot of lotsBySymbol[symbol]) {
        if (lot.amount) {
          costBasis += lot.amount
        } else {
          costBasis += lot.quantity * lot.costPerUnit
        }
      }
    }

    return { costBasis, totalInvested, realizedPnL, dividends, lotsBySymbol }
  }

  /**
   * Compute period-specific realized P&L and dividends
   * Only considers transactions within the specified date range
   */
  private computePeriodMetrics(
    transactions: Transaction[],
    startDate: string,
    endDate: string
  ): { periodRealizedPnL: number; periodDividends: number } {
    // Get state at period start (just before)
    const stateBeforeStart = this.computePortfolioStateAt(transactions, new Date(new Date(startDate).getTime() - 1).toISOString().split('T')[0])

    // Get state at period end
    const stateAtEnd = this.computePortfolioStateAt(transactions, endDate)

    // Period metrics are the delta
    const periodRealizedPnL = stateAtEnd.realizedPnL - stateBeforeStart.realizedPnL
    const periodDividends = stateAtEnd.dividends - stateBeforeStart.dividends

    return { periodRealizedPnL, periodDividends }
  }

  /**
   * Calculate net cash inflows for a specific period
   * Buys/deposits = positive inflow, Sells/withdrawals = negative
   * Excludes dividends (tracked separately)
   */
  private computeNetInflowsForPeriod(
    transactions: Transaction[],
    startDate: string,
    endDate: string
  ): number {
    const periodTxs = transactions.filter(tx => tx.date > startDate && tx.date <= endDate)

    let netInflows = 0
    for (const tx of periodTxs) {
      switch (tx.type) {
        case 'buy':
          netInflows += tx.price_per_unit * tx.quantity + (tx.fees || 0)
          break
        case 'sell':
          netInflows -= (tx.price_per_unit * tx.quantity - (tx.fees || 0))
          break
        case 'deposit':
          netInflows += tx.amount || 0
          break
        case 'withdrawal':
          netInflows -= tx.amount || 0
          break
        // Dividends excluded - tracked separately
      }
    }

    return netInflows
  }

  // ==========================================================================
  // SECTION 3: HISTORICAL DATA GENERATION
  // ==========================================================================

  /**
   * Build historical data using superior FIFO logic from ReturnCalculationService
   * This generates a complete time series with accurate cost basis at each point
   *
   * CACHED: Results are cached per user/symbol/currency to avoid expensive recalculations
   */
  async calculateHistoricalData(
    user: AuthUser,
    transactions: Transaction[],
    symbols: Symbol[],
    targetCurrency: SupportedCurrency = 'USD',
    options?: {
      targetSymbol?: string // If provided, calculates for single holding only
    }
  ): Promise<HistoricalDataPoint[]> {
    try {
      const { targetSymbol } = options || {}

      // Generate cache key based on user, symbol (or 'portfolio'), and currency
      const cacheKey = targetSymbol
        ? cacheService.Keys.holdingHistoricalData(user.id, targetSymbol, targetCurrency)
        : cacheService.Keys.historicalData(user.id, targetCurrency)

      // Use cache with 5 minute TTL for portfolio-level calculations (expensive)
      return await cacheService.getOrFetch(
        cacheKey,
        async () => {
          console.log(`📊 Building ${targetSymbol ? `holding data for ${targetSymbol}` : 'portfolio data'} using FIFO logic`)

          return await this.buildHistoricalDataInternal(
            user,
            transactions,
            symbols,
            targetCurrency,
            targetSymbol
          )
        },
        cacheService.getTTL('portfolio') // 5 minute TTL
      )

    } catch (error) {
      console.error('Error building historical data:', error)
      return []
    }
  }

  /**
   * Internal method to build historical data
   * Uses computePortfolioStateAt() for accurate cost basis at each point
   */
  private async buildHistoricalDataInternal(
    user: AuthUser,
    transactions: Transaction[],
    symbols: Symbol[],
    targetCurrency: SupportedCurrency,
    targetSymbol?: string
  ): Promise<HistoricalDataPoint[]> {
    if (transactions.length === 0) {
      return []
    }

    // Pre-fetch price maps for all relevant symbols
    const priceMapCache = new Map<string, Map<string, number>>()

    if (targetSymbol) {
      priceMapCache.set(targetSymbol, await historicalPriceService.fetchHistoricalPrices(targetSymbol))
    } else {
      const uniqueSymbols = [...new Set(transactions.map(t => t.symbol))]
      await Promise.all(
        uniqueSymbols.map(async symbol => {
          priceMapCache.set(symbol, await historicalPriceService.fetchHistoricalPrices(symbol))
        })
      )
    }

    // Get date range
    const sortedTransactions = transactions
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const startDate = new Date(sortedTransactions[0].date)
    const endDate = new Date()

    const historicalData: HistoricalDataPoint[] = []

    // Build data points for each day
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const currentDate = d.toISOString().split('T')[0]

      // Calculate positions as of this date
      const positions = this.calculatePositionsUpToDate(transactions, currentDate, targetSymbol, symbols)

      if (positions.length === 0) {
        continue
      }

      // Use FIFO logic to get accurate cost basis and cumulative dividends
      const portfolioState = this.computePortfolioStateAt(transactions, currentDate)

      // Calculate total value and asset allocations
      let totalValue = 0
      const assetTypeValues: Record<string, number> = {
        stock: 0,
        crypto: 0,
        real_estate: 0,
        cash: 0,
        currency: 0,
        other: 0
      }

      let validPriceCount = 0
      let convertedTotalValue = 0
      let convertedTargetSymbolValue = 0
      const convertedAssetTypeValues: Record<string, number> = {
        stock: 0,
        crypto: 0,
        real_estate: 0,
        cash: 0,
        currency: 0,
        other: 0
      }

      // Process all positions in parallel
      const positionResults = await Promise.all(positions.map(async (position) => {
        const symbolData = symbols.find(s => s.symbol === position.symbol)!
        const symbolPriceMap = priceMapCache.get(position.symbol)
        const historicalPrice = await this.getUnifiedHistoricalPrice(
          position.symbol,
          currentDate,
          user,
          symbolData,
          symbolPriceMap,
        )

        const symbolCurrency = symbolData?.currency
        const fromCurrency = (symbolCurrency || 'USD') as SupportedCurrency

        const result = {
          validPrice: false,
          positionValue: 0,
          convertedPositionValue: 0,
          assetType: symbolData?.asset_type || 'other',
          isTargetSymbol: targetSymbol === position.symbol
        }

        if (historicalPrice !== null) {
          result.validPrice = true

          // For account holdings, historicalPrice IS the account balance
          let positionValue: number
          if (symbolData?.holding_type === 'account') {
            positionValue = historicalPrice
          } else {
            positionValue = position.quantity * historicalPrice
          }

          result.positionValue = positionValue

          // Convert to target currency
          let convertedPositionValue = positionValue
          if (fromCurrency !== targetCurrency) {
            try {
              const conversionRate = await currencyService.getExchangeRate(fromCurrency, targetCurrency, user, symbols, currentDate)
              convertedPositionValue = positionValue * conversionRate
            } catch (error) {
              console.warn(`Failed to get exchange rate from ${fromCurrency} to ${targetCurrency} on ${currentDate}, using rate 1:`, error)
              convertedPositionValue = positionValue
            }
          }
          result.convertedPositionValue = convertedPositionValue
        }

        return result
      }))

      // Aggregate results
      for (const result of positionResults) {
        if (result.validPrice) {
          validPriceCount++
          totalValue += result.positionValue
          convertedTotalValue += result.convertedPositionValue

          if (result.isTargetSymbol) {
            convertedTargetSymbolValue = result.convertedPositionValue
          }

          assetTypeValues[result.assetType] += result.convertedPositionValue
          convertedAssetTypeValues[result.assetType] += result.convertedPositionValue
        }
      }

      // Skip this date if no valid prices
      if (validPriceCount === 0) {
        continue
      }

      // Convert cost basis to target currency
      const costBasisResults = await Promise.all(positions.map(async (position) => {
        const symbolData = symbols.find(s => s.symbol === position.symbol)
        const symbolCurrency = symbolData?.currency
        const fromCurrency = (symbolCurrency || 'USD') as SupportedCurrency

        let convertedPositionCostBasis = position.totalCost
        if (fromCurrency !== targetCurrency) {
          try {
            const costBasisConversionRate = await currencyService.getExchangeRate(fromCurrency, targetCurrency, user, symbols, currentDate)
            convertedPositionCostBasis = position.totalCost * costBasisConversionRate
          } catch (error) {
            console.warn(`Failed to convert cost basis from ${fromCurrency} to ${targetCurrency} for ${position.symbol} on ${currentDate}, using rate 1:`, error)
            convertedPositionCostBasis = position.totalCost
          }
        }

        return convertedPositionCostBasis
      }))

      const convertedCostBasis = costBasisResults.reduce((sum, value) => sum + value, 0)

      // Calculate allocations
      const assetTypeAllocations: Record<string, number> = {}
      if (convertedTotalValue > 0) {
        for (const [assetType, value] of Object.entries(assetTypeValues)) {
          assetTypeAllocations[assetType] = (value / convertedTotalValue) * 100
        }
      }

      // For single holdings, set allocation to 100% for that asset type
      if (targetSymbol && positions.length === 1) {
        const symbolData = symbols.find(s => s.symbol === targetSymbol)
        const assetType = symbolData?.asset_type || 'other'

        Object.keys(assetTypeAllocations).forEach(key => {
          assetTypeAllocations[key] = 0
        })
        assetTypeAllocations[assetType] = 100

        Object.keys(convertedAssetTypeValues).forEach(key => {
          convertedAssetTypeValues[key] = 0
        })
        convertedAssetTypeValues[assetType] = convertedTargetSymbolValue
      }

      // For single holdings, use the individual holding value
      const finalTotalValue = targetSymbol
        ? convertedTargetSymbolValue
        : convertedTotalValue

      // Convert cumulative dividends to target currency
      let convertedDividends = portfolioState.dividends
      if (targetSymbol) {
        const symbolData = symbols.find(s => s.symbol === targetSymbol)
        const fromCurrency = (symbolData?.currency || 'USD') as SupportedCurrency
        if (fromCurrency !== targetCurrency) {
          try {
            const conversionRate = await currencyService.getExchangeRate(fromCurrency, targetCurrency, user, symbols, currentDate)
            convertedDividends = portfolioState.dividends * conversionRate
          } catch (error) {
            console.warn(`Failed to convert dividends from ${fromCurrency} to ${targetCurrency}:`, error)
          }
        }
      }

      historicalData.push({
        date: currentDate,
        totalValue: finalTotalValue,
        assetTypeAllocations,
        assetTypeValues: convertedAssetTypeValues,
        costBasis: convertedCostBasis,
        cumulativeDividends: convertedDividends
      })
    }

    return historicalData
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

    // Determine all time periods that should be displayed
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

    const sortedPeriods = Array.from(allPeriods).sort()

    sortedPeriods.forEach(periodKey => {
      const points = grouped.get(periodKey)

      if (points && points.length > 0) {
        const lastPoint = points[points.length - 1]

        // Calculate average allocations and values
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
        // No data for this period, use last known allocation
        let syntheticDate: string

        if (periodKey.includes('-Q')) {
          const [year, quarter] = periodKey.split('-Q')
          const month = (parseInt(quarter) - 1) * 3
          syntheticDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
        } else if (periodKey.includes('-')) {
          syntheticDate = `${periodKey}-01`
        } else {
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
    options?: { targetSymbol?: string }
  ): Promise<HistoricalDataPoint[]> {
    try {
      console.log('📊 Getting historical data for time range:', timeRange)

      // Get full historical data
      const fullHistoricalData = await this.calculateHistoricalData(user, transactions, symbols, targetCurrency, options)

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

  // ==========================================================================
  // SECTION 4: RETURN METRICS CALCULATION
  // ==========================================================================

  /**
   * Find the historical data point at or immediately before the specified date
   */
  private findHistoricalDataPointAt(
    histData: HistoricalDataPoint[],
    targetDate: string
  ): HistoricalDataPoint | null {
    if (histData.length === 0) return null

    const sorted = histData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    let result: HistoricalDataPoint | null = null
    for (const point of sorted) {
      if (point.date <= targetDate) {
        result = point
      } else {
        break
      }
    }

    return result || sorted[0]
  }

  /**
   * Compute portfolio metrics for a specific period
   */
  private computePeriodPortfolioSummary(
    transactions: Transaction[],
    histData: HistoricalDataPoint[],
    startDate: string,
    endDate: string,
    transactionStartDate?: string,
    transactionEndDate?: string
  ): {
    totalValue: number
    totalPnL: number
    realizedPnL: number
    unrealizedPnL: number
    capitalGains: number
    dividends: number
    costBasis: number
    totalInvested: number
    annualizedReturn: number
  } {
    const txStartDate = transactionStartDate || startDate
    const txEndDate = transactionEndDate || endDate

    const histStart = this.findHistoricalDataPointAt(histData, startDate)
    const histEnd = this.findHistoricalDataPointAt(histData, endDate)

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
      }
    }

    const endState = this.computePortfolioStateAt(transactions, endDate)
    const startState = this.computePortfolioStateAt(transactions, startDate)

    const { periodRealizedPnL, periodDividends } = this.computePeriodMetrics(transactions, txStartDate, txEndDate)

    const totalCurrentValue = Object.values(histEnd.assetTypeValues).reduce((a, b) => a + b, 0)
    const startValue = Object.values(histStart.assetTypeValues).reduce((a, b) => a + b, 0)

    const unrealizedPnLEnd = totalCurrentValue - endState.costBasis
    const unrealizedPnLStart = startValue - startState.costBasis

    const periodUnrealizedPnLChange = unrealizedPnLEnd - unrealizedPnLStart
    const periodCapitalGains = periodRealizedPnL + periodUnrealizedPnLChange
    const periodTotalPnL = periodCapitalGains + periodDividends

    const annualizedReturn = this.computeAnnualizedTWR(histData, transactions)

    return {
      totalValue: totalCurrentValue,
      totalPnL: periodTotalPnL,
      realizedPnL: periodRealizedPnL,
      unrealizedPnL: periodUnrealizedPnLChange,
      capitalGains: periodCapitalGains,
      dividends: periodDividends,
      costBasis: endState.costBasis,
      totalInvested: endState.totalInvested,
      annualizedReturn,
    }
  }

  /**
   * Compute annualized Time-Weighted Return (TWR)
   * ALWAYS uses full historical data - never filtered by date range
   */
  private computeAnnualizedTWR(
    histData: HistoricalDataPoint[],
    transactions: Transaction[]
  ): number {
    const histSorted = histData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    if (histSorted.length < 2) return 0

    // Check if this is a closed position
    const finalValue = Object.values(histSorted[histSorted.length - 1].assetTypeValues).reduce((a, b) => a + b, 0)
    const isClosedPosition = finalValue === 0

    if (isClosedPosition) {
      let totalInvested = 0
      let totalProceeds = 0

      for (const tx of transactions) {
        switch (tx.type) {
          case "buy":
            totalInvested += tx.price_per_unit * tx.quantity + (tx.fees || 0)
            break
          case "sell":
            totalProceeds += tx.price_per_unit * tx.quantity - (tx.fees || 0)
            break
          case "deposit":
            totalInvested += (tx.amount || 0)
            break
          case "withdrawal":
            totalProceeds += (tx.amount || 0)
            break
        }
      }

      if (totalInvested === 0) return 0

      const years =
        (new Date(histSorted[histSorted.length - 1].date).getTime() -
          new Date(histSorted[0].date).getTime()) /
        (1000 * 3600 * 24 * 365.25)

      if (years <= 0) return 0

      const totalReturn = totalProceeds / totalInvested
      return Math.pow(totalReturn, 1 / years) - 1
    }

    // Standard TWR calculation
    let twr = 1

    for (let i = 0; i < histSorted.length - 1; i++) {
      const start = histSorted[i]
      const end = histSorted[i + 1]

      const cf = transactions
        .filter(tx => tx.date > start.date && tx.date <= end.date)
        .reduce((acc, tx) => {
          switch (tx.type) {
            case "buy":
              return acc + tx.price_per_unit * tx.quantity + (tx.fees || 0)
            case "sell":
              return acc - (tx.price_per_unit * tx.quantity - (tx.fees || 0))
            case "dividend":
              return acc - (tx.amount || 0)
            default:
              return acc
          }
        }, 0)

      const V_start = Object.values(start.assetTypeValues).reduce((a, b) => a + b, 0)
      const V_end = Object.values(end.assetTypeValues).reduce((a, b) => a + b, 0)

      if (V_start + cf > 0) {
        const periodReturn = V_end / (V_start + cf) - 1
        twr *= 1 + periodReturn
      }
    }

    const years =
      (new Date(histSorted[histSorted.length - 1].date).getTime() -
        new Date(histSorted[0].date).getTime()) /
      (1000 * 3600 * 24 * 365.25)

    return years > 0 ? Math.pow(twr, 1 / years) - 1 : 0
  }

  /**
   * Calculate XIRR (Extended Internal Rate of Return) using Newton's method
   */
  private calculateXIRR(
    transactions: Transaction[],
    endValue: number,
    endDate: string,
    maxIterations: number = 100,
    tolerance: number = 0.000001
  ): number {
    const cashFlows: { amount: number; date: Date }[] = []

    for (const tx of transactions) {
      let amount = 0
      switch (tx.type) {
        case 'buy':
          amount = -(tx.price_per_unit * tx.quantity + (tx.fees || 0))
          break
        case 'sell':
          amount = tx.price_per_unit * tx.quantity - (tx.fees || 0)
          break
        case 'dividend':
          amount = (tx.amount || 0)
          break
        case 'deposit':
          amount = -(tx.amount || 0)
          break
        case 'withdrawal':
          amount = (tx.amount || 0)
          break
        default:
          continue
      }

      if (amount !== 0) {
        cashFlows.push({
          amount,
          date: new Date(tx.date)
        })
      }
    }

    if (endValue > 0) {
      cashFlows.push({
        amount: endValue,
        date: new Date(endDate)
      })
    }

    if (cashFlows.length < 2) return 0

    cashFlows.sort((a, b) => a.date.getTime() - b.date.getTime())

    const firstDate = cashFlows[0].date

    const flows = cashFlows.map(cf => ({
      amount: cf.amount,
      days: (cf.date.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
    }))

    const totalIn = flows.filter(f => f.amount < 0).reduce((sum, f) => sum - f.amount, 0)
    const totalOut = flows.filter(f => f.amount > 0).reduce((sum, f) => sum + f.amount, 0)
    let rate = totalIn > 0 ? (totalOut / totalIn - 1) / (flows[flows.length - 1].days / 365.25) : 0.1

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0
      let dnpv = 0

      for (const flow of flows) {
        const years = flow.days / 365.25
        const pv = flow.amount / Math.pow(1 + rate, years)
        npv += pv
        dnpv -= years * pv / (1 + rate)
      }

      if (Math.abs(npv) < tolerance) {
        return rate
      }

      if (dnpv === 0) break
      const newRate = rate - npv / dnpv

      if (newRate < -0.99) {
        rate = -0.99
      } else if (newRate > 10) {
        rate = 10
      } else {
        rate = newRate
      }
    }

    return rate
  }

  /**
   * Calculate unified portfolio return metrics
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
    if (historicalData.length < 2) {
      return this.getEmptyReturnMetrics()
    }

    const { startDate: optionsStartDate, endDate: optionsEndDate } = options

    const sortedData = historicalData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const firstAvailableDate = sortedData[0].date
    const lastAvailableDate = sortedData[sortedData.length - 1].date

    let actualStartDate = optionsStartDate || firstAvailableDate
    if (optionsStartDate && optionsStartDate < firstAvailableDate) {
      actualStartDate = firstAvailableDate
    }

    const actualEndDate = optionsEndDate || lastAvailableDate

    const startPoint = this.findHistoricalDataPointAt(historicalData, actualStartDate)
    const endPoint = this.findHistoricalDataPointAt(historicalData, actualEndDate)

    if (!startPoint || !endPoint) {
      return this.getEmptyReturnMetrics()
    }

    const totalRangeDuration = this.calculateYearsDifference(startPoint.date, endPoint.date)
    if (totalRangeDuration <= 0) {
      return this.getEmptyReturnMetrics()
    }

    const periodSummary = this.computePeriodPortfolioSummary(
      transactions,
      historicalData,
      startPoint.date,
      endPoint.date
    )

    // Calculate total return percentage for the period
    let totalReturnPercentage = 0

    const startValue = Object.values(startPoint.assetTypeValues).reduce((a, b) => a + b, 0)
    const netInflows = this.computeNetInflowsForPeriod(transactions, startPoint.date, endPoint.date)

    const avgCapital = startValue + (netInflows / 2)

    if (avgCapital > 0) {
      totalReturnPercentage = (periodSummary.totalPnL / avgCapital) * 100
    }

    // Calculate XIRR - ALWAYS use ALL transactions
    const finalValue = Object.values(endPoint.assetTypeValues).reduce((a, b) => a + b, 0)
    const xirr = this.calculateXIRR(transactions, finalValue, endPoint.date)

    const periodYears = this.calculateYearsDifference(firstAvailableDate, lastAvailableDate)

    return {
      totalValue: periodSummary.totalValue,
      totalPnL: periodSummary.totalPnL,
      realizedPnL: periodSummary.realizedPnL,
      unrealizedPnL: periodSummary.unrealizedPnL,
      unrealizedPnlPercentage: (periodSummary.unrealizedPnL / (periodSummary.totalValue - periodSummary.unrealizedPnL)) * 100,
      capitalGains: periodSummary.capitalGains,
      dividends: periodSummary.dividends,
      costBasis: periodSummary.costBasis,
      totalInvested: periodSummary.totalInvested,
      timeWeightedReturn: periodSummary.annualizedReturn * 100,
      moneyWeightedReturn: xirr * 100,
      totalReturnPercentage: totalReturnPercentage,
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
      unrealizedPnlPercentage: 0,
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
   * Convert a period key to actual start and end dates
   */
  private getPeriodDateRange(periodKey: string, timePeriod: TimePeriod): { startDate: string; endDate: string } {
    switch (timePeriod) {
      case 'day': {
        return {
          startDate: periodKey,
          endDate: periodKey
        }
      }

      case 'week': {
        const startDate = new Date(periodKey)
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + 6)
        return {
          startDate: periodKey,
          endDate: endDate.toISOString().split('T')[0]
        }
      }

      case 'month': {
        const [year, month] = periodKey.split('-').map(Number)
        const startDate = new Date(year, month - 1, 1)
        const endDate = new Date(year, month, 0)
        return {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }
      }

      case 'quarter': {
        const [yearStr, quarterStr] = periodKey.split('-')
        const year = Number(yearStr)
        const quarter = Number(quarterStr.substring(1))
        const startMonth = (quarter - 1) * 3
        const startDate = new Date(year, startMonth, 1)
        const endDate = new Date(year, startMonth + 3, 0)
        return {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }
      }

      case 'year': {
        const year = Number(periodKey)
        const startDate = new Date(year, 0, 1)
        const endDate = new Date(year, 11, 31)
        return {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }
      }
    }
  }

  /**
   * Find the closest historical data points for bucket boundaries
   */
  private findBucketBoundaries(
    historicalData: HistoricalDataPoint[],
    periodKey: string,
    timePeriod: TimePeriod
  ): { startPoint: HistoricalDataPoint | null; endPoint: HistoricalDataPoint | null } {
    const { startDate, endDate } = this.getPeriodDateRange(periodKey, timePeriod)

    if (timePeriod === 'day') {
      const currentDate = new Date(startDate)
      const previousDate = new Date(currentDate)
      previousDate.setDate(previousDate.getDate() - 1)
      const previousDateStr = previousDate.toISOString().split('T')[0]

      return {
        startPoint: this.findHistoricalDataPointAt(historicalData, previousDateStr),
        endPoint: this.findHistoricalDataPointAt(historicalData, endDate)
      }
    }

    return {
      startPoint: this.findHistoricalDataPointAt(historicalData, startDate),
      endPoint: this.findHistoricalDataPointAt(historicalData, endDate)
    }
  }

  /**
   * Calculate bucketed portfolio metrics for a time range
   * Breaks down performance into sub-periods
   */
  calculateBucketedPortfolioMetrics(
    transactions: Transaction[],
    historicalData: HistoricalDataPoint[],
    symbols: Symbol[],
    timeRange: TimeRange,
    options: ReturnCalculationOptions = {}
  ): BucketedReturnMetrics {
    if (historicalData.length < 2) {
      return {
        buckets: [],
        timePeriod: getGroupByTimePeriodForTimeRange(timeRange),
        totalMetrics: this.getEmptyReturnMetrics()
      }
    }

    const sortedData = historicalData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const firstAvailableDate = sortedData[0].date
    const lastAvailableDate = sortedData[sortedData.length - 1].date

    const rangeStartDate = options.startDate || getStartDateForTimeRange(timeRange).toISOString().split('T')[0]
    const rangeEndDate = options.endDate || lastAvailableDate

    const actualStartDate = rangeStartDate < firstAvailableDate ? firstAvailableDate : rangeStartDate

    const timePeriod = getGroupByTimePeriodForTimeRange(timeRange)

    const periodBuckets = getTimePeriodBucketsForTimePeriod(
      new Date(actualStartDate),
      new Date(rangeEndDate),
      timePeriod
    )

    const buckets: PeriodBucketMetrics[] = []
    const sortedPeriodKeys = Array.from(periodBuckets).sort()

    for (const periodKey of sortedPeriodKeys) {
      const { startDate: theoreticalStartDate, endDate: theoreticalEndDate } = this.getPeriodDateRange(periodKey, timePeriod)

      const { startPoint, endPoint } = this.findBucketBoundaries(historicalData, periodKey, timePeriod)

      if (!startPoint || !endPoint) {
        continue
      }

      const periodSummary = this.computePeriodPortfolioSummary(
        transactions,
        historicalData,
        startPoint.date,
        endPoint.date,
        theoreticalStartDate,
        theoreticalEndDate
      )

      const startValue = Object.values(startPoint.assetTypeValues).reduce((a, b) => a + b, 0)
      const endValue = Object.values(endPoint.assetTypeValues).reduce((a, b) => a + b, 0)

      const netInflows = this.computeNetInflowsForPeriod(transactions, theoreticalStartDate, theoreticalEndDate)

      let periodReturn = 0
      const avgCapital = startValue + (netInflows / 2)
      if (avgCapital > 0) {
        periodReturn = (periodSummary.totalPnL / avgCapital) * 100
      }

      buckets.push({
        periodKey,
        startDate: startPoint.date,
        endDate: endPoint.date,
        startValue,
        endValue,
        totalPnL: periodSummary.totalPnL,
        realizedPnL: periodSummary.realizedPnL,
        unrealizedPnLChange: periodSummary.unrealizedPnL,
        capitalGains: periodSummary.capitalGains,
        dividends: periodSummary.dividends,
        totalReturnPercentage: periodReturn,
        netInflows
      })
    }

    const totalMetrics = this.calculatePortfolioReturnMetrics(
      transactions,
      historicalData,
      symbols,
      { startDate: actualStartDate, endDate: rangeEndDate }
    )

    return {
      buckets,
      timePeriod,
      totalMetrics
    }
  }

  /**
   * Calculate bucketed holding (per-symbol) metrics for a time range
   * Same as portfolio-level bucketing but for filtered data
   */
  calculateBucketedHoldingMetrics(
    transactions: Transaction[],
    historicalData: HistoricalDataPoint[],
    symbols: Symbol[],
    timeRange: TimeRange,
    options: ReturnCalculationOptions = {}
  ): BucketedReturnMetrics {
    return this.calculateBucketedPortfolioMetrics(transactions, historicalData, symbols, timeRange, options)
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
export const portfolioCalculationService = new PortfolioCalculationService()
