import { returnCalculationService, type AnnualizedReturnMetrics, type DetailedReturnMetrics } from '../return-calculation.service'
import type { Transaction, Symbol } from '@/lib/supabase/types'
import type { HistoricalDataPoint } from '@/lib/mockData'

describe('ReturnCalculationService', () => {
  const mockUserId = 'test-user-123'

  // Anonymized test data based on real ETF investment pattern
  const createMockSymbol = (): Symbol => ({
    id: 'test-etf-001',
    symbol: 'TEST.ETF',
    name: 'Test ETF Fund',
    asset_type: 'stock',
    currency: 'EUR',
    last_price: 139.04,
    is_custom: false,
    created_at: '2022-01-01T00:00:00Z',
    updated_at: '2025-09-20T00:00:00Z'
  })

  // Create realistic transaction pattern: monthly investments over ~3.7 years
  const createMockTransactions = (): Transaction[] => {
    const transactions: Transaction[] = []
    const baseAmount = 2000 // Base investment amount
    const prices = [
      // 2022 prices (lower)
      { date: '2022-01-18', price: 101.70, qty: 9 },
      { date: '2022-01-31', price: 99.56, qty: 21 },
      { date: '2022-03-02', price: 97.05, qty: 30 },
      { date: '2022-04-05', price: 103.30, qty: 19 },
      { date: '2022-07-06', price: 92.73, qty: 22 },
      { date: '2022-08-29', price: 98.78, qty: 20 },
      { date: '2022-09-27', price: 93.26, qty: 31 },

      // 2023 prices (gradual recovery)
      { date: '2023-01-03', price: 92.54, qty: 32 },
      { date: '2023-01-31', price: 94.34, qty: 26 },
      { date: '2023-03-02', price: 94.46, qty: 27 },
      { date: '2023-05-02', price: 95.96, qty: 36 },
      { date: '2023-07-28', price: 103.30, qty: 24 },
      { date: '2023-11-28', price: 102.48, qty: 25 },

      // 2024-2025 prices (higher, more investments)
      { date: '2024-07-01', price: 122.48, qty: 22 },
      { date: '2024-07-29', price: 122.24, qty: 27 },
      { date: '2024-08-27', price: 122.14, qty: 21 },
      { date: '2024-12-27', price: 135.22, qty: 37 },
      { date: '2025-01-02', price: 134.96, qty: 74 }, // Large investment
      { date: '2025-03-03', price: 137.02, qty: 37 },
      { date: '2025-03-31', price: 125.42, qty: 40 },
      { date: '2025-06-16', price: 128.86, qty: 23 },
      { date: '2025-09-09', price: 136.58, qty: 37 }
    ]

    prices.forEach((p, index) => {
      transactions.push({
        id: `tx-${index}`,
        user_id: mockUserId,
        symbol: 'TEST.ETF',
        type: 'buy',
        quantity: p.qty,
        price_per_unit: p.price,
        fees: 1.0,
        date: p.date,
        notes: null,
        created_at: p.date + 'T10:00:00Z',
        updated_at: p.date + 'T10:00:00Z'
      })
    })

    return transactions
  }

  // Create historical data points that show portfolio growth
  const createMockHistoricalData = (): HistoricalDataPoint[] => {
    const transactions = createMockTransactions()

    // Create simple start and end data points
    const startDate = transactions[0].date
    const endDate = '2025-09-20'

    // Calculate total invested and simulate final value
    const totalInvested = transactions.reduce((sum, t) => sum + (t.quantity * t.price_per_unit + (t.fees || 0)), 0)
    const finalValue = totalInvested * 1.1993 // ~20% total return like VWCE.DE

    return [
      {
        date: startDate,
        totalValue: transactions[0].quantity * transactions[0].price_per_unit + (transactions[0].fees || 0),
        costBasis: transactions[0].quantity * transactions[0].price_per_unit + (transactions[0].fees || 0),
        totalPnL: 0,
        totalPnLPercentage: 0,
        assetTypeAllocations: { stock: 100 },
        assetTypeValues: { stock: transactions[0].quantity * transactions[0].price_per_unit }
      },
      {
        date: endDate,
        totalValue: finalValue,
        costBasis: totalInvested,
        totalPnL: finalValue - totalInvested,
        totalPnLPercentage: ((finalValue - totalInvested) / totalInvested) * 100,
        assetTypeAllocations: { stock: 100 },
        assetTypeValues: { stock: finalValue }
      }
    ]
  }

  describe('calculateAnnualizedReturns', () => {
    let mockTransactions: Transaction[]
    let mockSymbols: Symbol[]
    let mockHistoricalData: HistoricalDataPoint[]

    beforeEach(() => {
      mockTransactions = createMockTransactions()
      mockSymbols = [createMockSymbol()]
      mockHistoricalData = createMockHistoricalData()
    })

    it('should calculate realistic annualized returns for regular investment pattern', () => {
      const result = returnCalculationService.calculateAnnualizedReturns(
        mockTransactions,
        mockHistoricalData,
        mockSymbols
      )

      expect(result).toBeDefined()
      expect(result.periodYears).toBeGreaterThan(3.5) // Full period ~3.7 years
      expect(result.totalReturn).toBeCloseTo(19.93, 0) // ~20% total return

      // The key test: annualized return should be reasonable (10-20% range)
      // Not the naive calculation (20% / 3.7 years = 5.4%)
      // But accounting for when money was actually invested
      expect(result.timeWeightedReturn).toBeGreaterThan(10)
      expect(result.timeWeightedReturn).toBeLessThan(25)

      console.log('Realistic investment pattern results:', {
        totalReturn: result.totalReturn.toFixed(2) + '%',
        timeWeightedReturn: result.timeWeightedReturn.toFixed(2) + '%',
        moneyWeightedReturn: result.moneyWeightedReturn.toFixed(2) + '%',
        periodYears: result.periodYears.toFixed(2)
      })
    })

    it('should handle edge case: single large investment at start', () => {
      // Single investment scenario
      const singleInvestment: Transaction[] = [{
        id: 'tx-single',
        user_id: mockUserId,
        symbol: 'TEST.ETF',
        type: 'buy',
        quantity: 1000,
        price_per_unit: 100,
        fees: 0,
        date: '2022-01-01',
        notes: null,
        created_at: '2022-01-01T10:00:00Z',
        updated_at: '2022-01-01T10:00:00Z'
      }]

      const singleInvestmentData: HistoricalDataPoint[] = [
        {
          date: '2022-01-01',
          totalValue: 100000,
          costBasis: 100000,
          totalPnL: 0,
          totalPnLPercentage: 0,
          assetTypeAllocations: { stock: 100 },
          assetTypeValues: { stock: 100000 }
        },
        {
          date: '2025-09-20',
          totalValue: 120000, // 20% total return
          costBasis: 100000,
          totalPnL: 20000,
          totalPnLPercentage: 20,
          assetTypeAllocations: { stock: 100 },
          assetTypeValues: { stock: 120000 }
        }
      ]

      const result = returnCalculationService.calculateAnnualizedReturns(
        singleInvestment,
        singleInvestmentData,
        mockSymbols
      )

      // For single investment, should be simple annualized calculation
      const expectedAnnualized = Math.pow(1.20, 1 / 3.7) - 1 // ~5% annually
      expect(result.timeWeightedReturn).toBeCloseTo(expectedAnnualized * 100, 1)
    })

    it('should handle edge case: very recent investments only', () => {
      // Recent investments only (last 6 months)
      const recentInvestments: Transaction[] = [
        {
          id: 'tx-recent-1',
          user_id: mockUserId,
          symbol: 'TEST.ETF',
          type: 'buy',
          quantity: 100,
          price_per_unit: 120,
          fees: 1,
          date: '2025-03-01',
          notes: null,
          created_at: '2025-03-01T10:00:00Z',
          updated_at: '2025-03-01T10:00:00Z'
        },
        {
          id: 'tx-recent-2',
          user_id: mockUserId,
          symbol: 'TEST.ETF',
          type: 'buy',
          quantity: 100,
          price_per_unit: 125,
          fees: 1,
          date: '2025-06-01',
          notes: null,
          created_at: '2025-06-01T10:00:00Z',
          updated_at: '2025-06-01T10:00:00Z'
        }
      ]

      const recentData: HistoricalDataPoint[] = [
        {
          date: '2025-03-01',
          totalValue: 12001,
          costBasis: 12001,
          totalPnL: 0,
          totalPnLPercentage: 0,
          assetTypeAllocations: { stock: 100 },
          assetTypeValues: { stock: 12001 }
        },
        {
          date: '2025-09-20',
          totalValue: 27600, // 200 shares * 138 price
          costBasis: 24502, // (100*120+1) + (100*125+1)
          totalPnL: 3098,
          totalPnLPercentage: 12.64,
          assetTypeAllocations: { stock: 100 },
          assetTypeValues: { stock: 27600 }
        }
      ]

      const result = returnCalculationService.calculateAnnualizedReturns(
        recentInvestments,
        recentData,
        mockSymbols
      )

      // Should not extrapolate short-term gains to unrealistic annual numbers
      expect(result.timeWeightedReturn).toBeLessThan(100) // Cap at reasonable level
      expect(result.periodYears).toBeLessThan(1)
    })

    it('should return empty metrics for insufficient data', () => {
      const result = returnCalculationService.calculateAnnualizedReturns(
        [],
        [],
        mockSymbols
      )

      expect(result.timeWeightedReturn).toBe(0)
      expect(result.moneyWeightedReturn).toBe(0)
      expect(result.totalReturn).toBe(0)
      expect(result.periodYears).toBe(0)
    })

    it('should handle negative returns correctly', () => {
      const lossScenario: HistoricalDataPoint[] = [
        {
          date: '2024-01-01',
          totalValue: 100000,
          costBasis: 100000,
          totalPnL: 0,
          totalPnLPercentage: 0,
          assetTypeAllocations: { stock: 100 },
          assetTypeValues: { stock: 100000 }
        },
        {
          date: '2025-09-20',
          totalValue: 80000, // 20% loss
          costBasis: 100000,
          totalPnL: -20000,
          totalPnLPercentage: -20,
          assetTypeAllocations: { stock: 100 },
          assetTypeValues: { stock: 80000 }
        }
      ]

      const singleInvestment: Transaction[] = [{
        id: 'tx-loss',
        user_id: mockUserId,
        symbol: 'TEST.ETF',
        type: 'buy',
        quantity: 1000,
        price_per_unit: 100,
        fees: 0,
        date: '2024-01-01',
        notes: null,
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z'
      }]

      const result = returnCalculationService.calculateAnnualizedReturns(
        singleInvestment,
        lossScenario,
        mockSymbols
      )

      expect(result.timeWeightedReturn).toBeLessThan(0) // Negative return
      expect(result.timeWeightedReturn).toBeGreaterThan(-95) // Within bounds
      expect(result.totalReturn).toBeCloseTo(-20, 1)
    })
  })

  describe('Time-weighted return edge cases', () => {
    it('should calculate weighted average investment time correctly', () => {
      // Test the core logic: if you invest $1000 on day 1 and $9000 on day 300,
      // the weighted average should be closer to day 300
      const transactions: Transaction[] = [
        {
          id: 'tx-early',
          user_id: mockUserId,
          symbol: 'TEST.ETF',
          type: 'buy',
          quantity: 10, // Small early investment
          price_per_unit: 100,
          fees: 0,
          date: '2024-01-01',
          notes: null,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z'
        },
        {
          id: 'tx-late',
          user_id: mockUserId,
          symbol: 'TEST.ETF',
          type: 'buy',
          quantity: 90, // Large late investment
          price_per_unit: 100,
          fees: 0,
          date: '2024-10-27', // ~10 months later
          notes: null,
          created_at: '2024-10-27T10:00:00Z',
          updated_at: '2024-10-27T10:00:00Z'
        }
      ]

      const historicalData: HistoricalDataPoint[] = [
        {
          date: '2024-01-01',
          totalValue: 1000,
          totalInvested: 1000,
          totalPnL: 0,
          totalPnLPercentage: 0,
          assetTypeAllocations: { stock: 100 },
          assetTypeValues: { stock: 1000 }
        },
        {
          date: '2025-01-01', // 1 year from start, ~2 months from large investment
          totalValue: 12000, // 20% total return
          totalInvested: 10000,
          totalPnL: 2000,
          totalPnLPercentage: 20,
          assetTypeAllocations: { stock: 100 },
          assetTypeValues: { stock: 12000 }
        }
      ]

      const result = returnCalculationService.calculateAnnualizedReturns(
        transactions,
        historicalData,
        [createMockSymbol()]
      )

      // The weighted average time should be much less than 1 year
      // since 90% of money was invested only ~2 months before end
      // This should result in a high annualized return
      expect(result.timeWeightedReturn).toBeGreaterThan(50) // High because money was invested recently

      console.log('Weighted time test:', {
        totalReturn: result.totalReturn.toFixed(2) + '%',
        annualizedReturn: result.timeWeightedReturn.toFixed(2) + '%',
        periodYears: result.periodYears.toFixed(2)
      })
    })

    it('should match external portfolio tracker results for similar scenario', () => {
      // This test simulates a scenario that should produce ~15.77% annualized return
      // Based on heavily weighted recent investments
      const recentHeavyInvestments: Transaction[] = [
        // Small early investment
        {
          id: 'tx-early-small',
          user_id: mockUserId,
          symbol: 'TEST.ETF',
          type: 'buy',
          quantity: 50,
          price_per_unit: 100,
          fees: 1,
          date: '2023-01-01',
          notes: null,
          created_at: '2023-01-01T10:00:00Z',
          updated_at: '2023-01-01T10:00:00Z'
        },
        // Large recent investments (80% of total)
        {
          id: 'tx-recent-large-1',
          user_id: mockUserId,
          symbol: 'TEST.ETF',
          type: 'buy',
          quantity: 800,
          price_per_unit: 110,
          fees: 10,
          date: '2024-07-01',
          notes: null,
          created_at: '2024-07-01T10:00:00Z',
          updated_at: '2024-07-01T10:00:00Z'
        },
        {
          id: 'tx-recent-large-2',
          user_id: mockUserId,
          symbol: 'TEST.ETF',
          type: 'buy',
          quantity: 300,
          price_per_unit: 115,
          fees: 5,
          date: '2024-12-01',
          notes: null,
          created_at: '2024-12-01T10:00:00Z',
          updated_at: '2024-12-01T10:00:00Z'
        }
      ]

      const totalInvested = recentHeavyInvestments.reduce((sum, t) => sum + (t.quantity * t.price_per_unit + (t.fees || 0)), 0)
      const finalValue = totalInvested * 1.1993 // Same 19.93% total return

      const heavyRecentData: HistoricalDataPoint[] = [
        {
          date: '2023-01-01',
          totalValue: 5001,
          costBasis: 5001,
          totalPnL: 0,
          totalPnLPercentage: 0,
          assetTypeAllocations: { stock: 100 },
          assetTypeValues: { stock: 5001 }
        },
        {
          date: '2025-09-20',
          totalValue: finalValue,
          costBasis: totalInvested,
          totalPnL: finalValue - totalInvested,
          totalPnLPercentage: ((finalValue - totalInvested) / totalInvested) * 100,
          assetTypeAllocations: { stock: 100 },
          assetTypeValues: { stock: finalValue }
        }
      ]

      const result = returnCalculationService.calculateAnnualizedReturns(
        recentHeavyInvestments,
        heavyRecentData,
        [createMockSymbol()]
      )

      // Should be closer to 15.77% due to weighted average timing
      expect(result.timeWeightedReturn).toBeGreaterThan(14)
      expect(result.timeWeightedReturn).toBeLessThan(18)

      console.log('Heavy recent investment test (should be ~15.77%):', {
        totalReturn: result.totalReturn.toFixed(2) + '%',
        timeWeightedReturn: result.timeWeightedReturn.toFixed(2) + '%',
        moneyWeightedReturn: result.moneyWeightedReturn.toFixed(2) + '%',
        periodYears: result.periodYears.toFixed(2)
      })
    })
  })

  describe('formatReturnPercentage', () => {
    it('should format positive returns with + sign', () => {
      expect(returnCalculationService.formatReturnPercentage(15.77)).toBe('+15.77%')
      expect(returnCalculationService.formatReturnPercentage(5.03, 1)).toBe('+5.0%')
    })

    it('should format negative returns correctly', () => {
      expect(returnCalculationService.formatReturnPercentage(-10.5)).toBe('-10.50%')
    })

    it('should format zero returns', () => {
      expect(returnCalculationService.formatReturnPercentage(0)).toBe('+0.00%')
    })
  })

  describe('getReturnColorClass', () => {
    it('should return correct color classes', () => {
      expect(returnCalculationService.getReturnColorClass(10)).toBe('text-green-600 dark:text-green-400')
      expect(returnCalculationService.getReturnColorClass(-5)).toBe('text-red-600 dark:text-red-400')
      expect(returnCalculationService.getReturnColorClass(0)).toBe('text-gray-600 dark:text-gray-400')
    })
  })

  describe('calculateSimpleAnnualizedReturn', () => {
    it('should calculate simple annualized return correctly', () => {
      const result = returnCalculationService.calculateSimpleAnnualizedReturn(
        120000, // current value
        100000, // total invested
        '2022-01-01' // first transaction date
      )

      // Should be around 5% annually for 20% over ~3.7 years
      expect(result).toBeGreaterThan(4)
      expect(result).toBeLessThan(7)
    })

    it('should handle short periods correctly', () => {
      const result = returnCalculationService.calculateSimpleAnnualizedReturn(
        110000, // current value
        100000, // total invested
        '2024-07-01' // ~1.2 years ago
      )

      // 10% return over ~1.2 years should be ~8% annualized
      expect(result).toBeGreaterThan(7)
      expect(result).toBeLessThan(10)
    })
  })

  describe('calculateDetailedReturns', () => {
    const mockSymbols = [createMockSymbol()]

    describe('Portfolio with only capital gains (no sales, no dividends)', () => {
      it('should calculate detailed returns for buy-only portfolio', () => {
        const buyOnlyTransactions = createMockTransactions()
        const historicalData = createMockHistoricalData()

        const result: DetailedReturnMetrics = returnCalculationService.calculateDetailedReturns(
          buyOnlyTransactions,
          historicalData,
          mockSymbols
        )

        // Verify basic metrics are included
        expect(result.timeWeightedReturn).toBeDefined()
        expect(result.moneyWeightedReturn).toBeDefined()
        expect(result.totalReturn).toBeDefined()

        // Verify capital gains breakdown
        expect(result.capitalGains.realized).toBe(0) // No sales, so no realized gains
        expect(result.capitalGains.unrealized).toBeGreaterThan(0) // Should have unrealized gains
        expect(result.capitalGains.realizedPercentage).toBe(0)
        expect(result.capitalGains.unrealizedPercentage).toBeGreaterThan(0)

        // Verify dividend income
        expect(result.dividendIncome.total).toBe(0) // No dividend transactions
        expect(result.dividendIncome.percentage).toBe(0)
        expect(result.dividendIncome.annualizedYield).toBe(0)

        // Verify realized vs unrealized
        expect(result.realizedVsUnrealized.totalRealized).toBe(0) // No realized gains or dividends
        expect(result.realizedVsUnrealized.totalUnrealized).toBeGreaterThan(0)
        expect(result.realizedVsUnrealized.realizedPercentage).toBe(0)
        expect(result.realizedVsUnrealized.unrealizedPercentage).toBe(100) // All unrealized

        // Verify investment summary
        expect(result.investmentSummary.totalInvested).toBeGreaterThan(0)
        expect(result.investmentSummary.currentValue).toBeGreaterThan(result.investmentSummary.totalInvested)
        expect(result.investmentSummary.totalWithdrawn).toBe(0) // No sales
      })
    })

    describe('Portfolio with sales (FIFO realized gains)', () => {
      it('should calculate FIFO realized gains correctly', () => {
        // Create transactions with some sales
        const transactionsWithSales: Transaction[] = [
          ...createMockTransactions().slice(0, 10), // First 10 buy transactions
          {
            id: 'test-sell-001',
            user_id: mockUserId,
            symbol: 'TEST.ETF',
            type: 'sell',
            quantity: 50, // Sell 50 units
            price_per_unit: 130.00, // At higher price
            fees: 2.50,
            date: '2024-06-01',
            created_at: '2024-06-01T00:00:00Z',
            updated_at: '2024-06-01T00:00:00Z'
          }
        ]

        // Adjust historical data to include the sale period
        const historicalData = createMockHistoricalData()

        const result: DetailedReturnMetrics = returnCalculationService.calculateDetailedReturns(
          transactionsWithSales,
          historicalData,
          mockSymbols
        )

        // Should have realized gains from the sale
        expect(result.capitalGains.realized).toBeGreaterThan(0)
        expect(result.capitalGains.unrealized).toBeGreaterThan(0)
        expect(result.capitalGains.realizedPercentage).toBeGreaterThan(0)

        // Realized vs unrealized should both be > 0
        expect(result.realizedVsUnrealized.totalRealized).toBeGreaterThan(0)
        expect(result.realizedVsUnrealized.totalUnrealized).toBeGreaterThan(0)
        expect(result.realizedVsUnrealized.realizedPercentage).toBeGreaterThan(0)
        expect(result.realizedVsUnrealized.unrealizedPercentage).toBeLessThan(100)

        // Should have money withdrawn
        expect(result.investmentSummary.totalWithdrawn).toBeGreaterThan(0)
      })
    })

    describe('Portfolio with dividends', () => {
      it('should calculate dividend income correctly', () => {
        const transactionsWithDividends: Transaction[] = [
          ...createMockTransactions().slice(0, 10), // Buy transactions
          {
            id: 'test-div-001',
            user_id: mockUserId,
            symbol: 'TEST.ETF',
            type: 'dividend',
            quantity: 150, // €150 dividend
            price_per_unit: 1.00,
            fees: 0,
            date: '2023-06-15',
            created_at: '2023-06-15T00:00:00Z',
            updated_at: '2023-06-15T00:00:00Z'
          },
          {
            id: 'test-div-002',
            user_id: mockUserId,
            symbol: 'TEST.ETF',
            type: 'dividend',
            quantity: 200, // €200 dividend
            price_per_unit: 1.00,
            fees: 0,
            date: '2024-06-15',
            created_at: '2024-06-15T00:00:00Z',
            updated_at: '2024-06-15T00:00:00Z'
          }
        ]

        const historicalData = createMockHistoricalData()

        const result: DetailedReturnMetrics = returnCalculationService.calculateDetailedReturns(
          transactionsWithDividends,
          historicalData,
          mockSymbols
        )

        // Should have dividend income
        expect(result.dividendIncome.total).toBe(350) // €150 + €200
        expect(result.dividendIncome.percentage).toBeGreaterThan(0)
        expect(result.dividendIncome.annualizedYield).toBeGreaterThan(0)

        // Dividends should count as realized returns
        expect(result.realizedVsUnrealized.totalRealized).toBe(350)
        expect(result.realizedVsUnrealized.realizedPercentage).toBeGreaterThan(0)
      })

      it('should handle alternative dividend data structure (quantity=0, amount in price_per_unit)', () => {
        const transactionsWithAlternateDividends: Transaction[] = [
          ...createMockTransactions().slice(0, 5), // Buy transactions
          {
            id: 'test-div-alt-001',
            user_id: mockUserId,
            symbol: 'TEST.ETF',
            type: 'dividend',
            quantity: 0, // Dividend amount is in price_per_unit field
            price_per_unit: 319.70, // €319.70 dividend
            fees: 0,
            date: '2023-06-15',
            created_at: '2023-06-15T00:00:00Z',
            updated_at: '2023-06-15T00:00:00Z'
          },
          {
            id: 'test-div-alt-002',
            user_id: mockUserId,
            symbol: 'TEST.ETF',
            type: 'dividend',
            quantity: 0, // Dividend amount is in price_per_unit field
            price_per_unit: 349.86, // €349.86 dividend
            fees: 0,
            date: '2024-06-15',
            created_at: '2024-06-15T00:00:00Z',
            updated_at: '2024-06-15T00:00:00Z'
          }
        ]

        const historicalData = createMockHistoricalData()

        const result: DetailedReturnMetrics = returnCalculationService.calculateDetailedReturns(
          transactionsWithAlternateDividends,
          historicalData,
          mockSymbols
        )

        // Should correctly calculate dividend income with alternative structure
        expect(result.dividendIncome.total).toBeCloseTo(669.56, 2) // €319.70 + €349.86
        expect(result.dividendIncome.percentage).toBeGreaterThan(0)
        expect(result.dividendIncome.annualizedYield).toBeGreaterThan(0)

        // Dividends should count as realized returns
        expect(result.realizedVsUnrealized.totalRealized).toBeCloseTo(669.56, 2)
        expect(result.realizedVsUnrealized.realizedPercentage).toBeGreaterThan(0)
      })
    })

    describe('Complex portfolio with sales and dividends', () => {
      it('should handle complex scenarios with multiple transaction types', () => {
        const complexTransactions: Transaction[] = [
          // Buy transactions
          {
            id: 'test-buy-001',
            user_id: mockUserId,
            symbol: 'TEST.ETF',
            type: 'buy',
            quantity: 100,
            price_per_unit: 100.00,
            fees: 5.00,
            date: '2022-01-01',
            created_at: '2022-01-01T00:00:00Z',
            updated_at: '2022-01-01T00:00:00Z'
          },
          {
            id: 'test-buy-002',
            user_id: mockUserId,
            symbol: 'TEST.ETF',
            type: 'buy',
            quantity: 50,
            price_per_unit: 120.00,
            fees: 2.50,
            date: '2022-06-01',
            created_at: '2022-06-01T00:00:00Z',
            updated_at: '2022-06-01T00:00:00Z'
          },
          // Dividend
          {
            id: 'test-div-001',
            user_id: mockUserId,
            symbol: 'TEST.ETF',
            type: 'dividend',
            quantity: 100,
            price_per_unit: 1.00,
            fees: 0,
            date: '2023-01-01',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z'
          },
          // Sale (FIFO: should sell from first lot at 100.00)
          {
            id: 'test-sell-001',
            user_id: mockUserId,
            symbol: 'TEST.ETF',
            type: 'sell',
            quantity: 30,
            price_per_unit: 140.00,
            fees: 2.00,
            date: '2023-06-01',
            created_at: '2023-06-01T00:00:00Z',
            updated_at: '2023-06-01T00:00:00Z'
          }
        ]

        const simplifiedHistoricalData: HistoricalDataPoint[] = [
          {
            date: '2022-01-01',
            totalValue: 10000, // 100 * 100
            costBasis: 10005
          },
          {
            date: '2022-06-01',
            totalValue: 18002.50, // (100 * 120) + (50 * 120)
            costBasis: 16007.50
          },
          {
            date: '2024-12-31',
            totalValue: 16800, // 120 remaining units * 140
            costBasis: 14000
          }
        ]

        const result: DetailedReturnMetrics = returnCalculationService.calculateDetailedReturns(
          complexTransactions,
          simplifiedHistoricalData,
          mockSymbols
        )

        // Should have both realized and unrealized capital gains
        expect(result.capitalGains.realized).toBeGreaterThan(0) // From the sale
        expect(result.capitalGains.unrealized).toBeGreaterThan(0) // From remaining holdings

        // Should have dividend income
        expect(result.dividendIncome.total).toBe(100)

        // Should have both realized and unrealized components
        expect(result.realizedVsUnrealized.totalRealized).toBe(result.capitalGains.realized + result.dividendIncome.total)
        expect(result.realizedVsUnrealized.totalUnrealized).toBe(result.capitalGains.unrealized)

        // Investment summary should be correct
        expect(result.investmentSummary.totalInvested).toBe(16007.50) // 10005 + 6002.50
        expect(result.investmentSummary.totalWithdrawn).toBeGreaterThan(0) // From the sale
      })
    })

    describe('Edge cases and date filtering', () => {
      it('should handle date range filtering correctly', () => {
        const transactions = createMockTransactions()
        // Create historical data with more points to ensure filtering works
        const extendedHistoricalData: HistoricalDataPoint[] = [
          {
            date: '2022-01-18',
            totalValue: 10000,
            costBasis: 10000
          },
          {
            date: '2023-06-01',
            totalValue: 50000,
            costBasis: 45000
          },
          {
            date: '2024-06-01',
            totalValue: 80000,
            costBasis: 70000
          },
          {
            date: '2025-09-20',
            totalValue: 172000,
            costBasis: 144000
          }
        ]

        const result: DetailedReturnMetrics = returnCalculationService.calculateDetailedReturns(
          transactions,
          extendedHistoricalData,
          mockSymbols,
          {
            startDate: '2023-01-01',
            endDate: '2024-12-31'
          }
        )

        expect(result.startDate).toBe('2023-01-01')
        expect(result.endDate).toBe('2024-12-31')
        expect(result.periodYears).toBeGreaterThan(1)
        expect(result.periodYears).toBeLessThan(3)
      })

      it('should handle empty transactions gracefully', () => {
        const result: DetailedReturnMetrics = returnCalculationService.calculateDetailedReturns(
          [],
          [],
          mockSymbols
        )

        expect(result.capitalGains.realized).toBe(0)
        expect(result.capitalGains.unrealized).toBe(0)
        expect(result.dividendIncome.total).toBe(0)
        expect(result.realizedVsUnrealized.totalRealized).toBe(0)
        expect(result.realizedVsUnrealized.totalUnrealized).toBe(0)
        expect(result.investmentSummary.totalInvested).toBe(0)
        expect(result.investmentSummary.currentValue).toBe(0)
        expect(result.investmentSummary.totalWithdrawn).toBe(0)
      })

      it('should handle insufficient historical data', () => {
        const transactions = createMockTransactions()
        const insufficientData: HistoricalDataPoint[] = [
          {
            date: '2022-01-01',
            totalValue: 10000,
            costBasis: 10000
          }
        ]

        const result: DetailedReturnMetrics = returnCalculationService.calculateDetailedReturns(
          transactions,
          insufficientData,
          mockSymbols
        )

        // Should return empty metrics when insufficient data
        expect(result.investmentSummary.totalInvested).toBe(0)
        expect(result.capitalGains.realized).toBe(0)
      })
    })

    describe('FIFO calculation accuracy', () => {
      it('should calculate FIFO gains with correct cost basis', () => {
        const fifoTestTransactions: Transaction[] = [
          // Buy lot 1: 100 units at €90
          {
            id: 'buy-1',
            user_id: mockUserId,
            symbol: 'TEST.ETF',
            type: 'buy',
            quantity: 100,
            price_per_unit: 90.00,
            fees: 5.00,
            date: '2022-01-01',
            created_at: '2022-01-01T00:00:00Z',
            updated_at: '2022-01-01T00:00:00Z'
          },
          // Buy lot 2: 100 units at €110
          {
            id: 'buy-2',
            user_id: mockUserId,
            symbol: 'TEST.ETF',
            type: 'buy',
            quantity: 100,
            price_per_unit: 110.00,
            fees: 5.00,
            date: '2022-06-01',
            created_at: '2022-06-01T00:00:00Z',
            updated_at: '2022-06-01T00:00:00Z'
          },
          // Sell 150 units at €130 (should use FIFO: 100 from lot 1 + 50 from lot 2)
          {
            id: 'sell-1',
            user_id: mockUserId,
            symbol: 'TEST.ETF',
            type: 'sell',
            quantity: 150,
            price_per_unit: 130.00,
            fees: 7.50,
            date: '2023-01-01',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z'
          }
        ]

        const fifoHistoricalData: HistoricalDataPoint[] = [
          {
            date: '2022-01-01',
            totalValue: 9000, // 100 * 90
            costBasis: 9005
          },
          {
            date: '2022-06-01',
            totalValue: 20000, // 200 * 100 (average)
            costBasis: 20010
          },
          {
            date: '2023-12-31',
            totalValue: 6500, // 50 remaining * 130
            costBasis: 5505 // 50 * (110 + 0.05 fees)
          }
        ]

        const result: DetailedReturnMetrics = returnCalculationService.calculateDetailedReturns(
          fifoTestTransactions,
          fifoHistoricalData,
          mockSymbols
        )

        // Expected FIFO calculation:
        // Sell 100 units from lot 1 at cost €90.05 each, sale price €129.95 each (after fees)
        // Realized gain: 100 * (129.95 - 90.05) = €3,990
        // Sell 50 units from lot 2 at cost €110.05 each, sale price €129.95 each
        // Realized gain: 50 * (129.95 - 110.05) = €995
        // Total realized gain: €3,990 + €995 = €4,985

        expect(result.capitalGains.realized).toBeGreaterThan(4900)
        expect(result.capitalGains.realized).toBeLessThan(5100)
        expect(result.realizedVsUnrealized.totalRealized).toBeGreaterThan(4900)
      })
    })

    describe('Closed positions (fully sold)', () => {
      it('should correctly handle fully sold positions', () => {
        const closedPositionTransactions: Transaction[] = [
          // Buy transaction
          {
            id: 'buy-closed',
            user_id: mockUserId,
            symbol: 'TEST.ETF',
            type: 'buy',
            quantity: 1,
            price_per_unit: 14300.00,
            fees: 0,
            date: '2021-11-29',
            created_at: '2021-11-29T00:00:00Z',
            updated_at: '2021-11-29T00:00:00Z'
          },
          // Sell transaction (complete sale)
          {
            id: 'sell-closed',
            user_id: mockUserId,
            symbol: 'TEST.ETF',
            type: 'sell',
            quantity: 1,
            price_per_unit: 15786.07,
            fees: 0,
            date: '2025-04-30',
            created_at: '2025-04-30T00:00:00Z',
            updated_at: '2025-04-30T00:00:00Z'
          }
        ]

        const closedPositionHistoricalData: HistoricalDataPoint[] = [
          {
            date: '2021-11-29',
            totalValue: 14300, // Initial value
            costBasis: 14300
          },
          {
            date: '2025-04-30',
            totalValue: 15786.07, // Historical data might still show value but position is closed
            costBasis: 0
          }
        ]

        const result: DetailedReturnMetrics = returnCalculationService.calculateDetailedReturns(
          closedPositionTransactions,
          closedPositionHistoricalData,
          mockSymbols
        )

        // For a closed position, all gains should be realized
        const expectedRealizedGain = 15786.07 - 14300.00 // €1,486.07
        expect(result.capitalGains.realized).toBeCloseTo(expectedRealizedGain, 2)
        expect(result.capitalGains.unrealized).toBe(0) // No unrealized gains for closed position

        // Current value should be 0 for closed position
        expect(result.investmentSummary.currentValue).toBe(0)
        expect(result.investmentSummary.totalInvested).toBe(14300)
        expect(result.investmentSummary.totalWithdrawn).toBeCloseTo(15786.07, 2)

        // All returns should be realized (100%)
        expect(result.realizedVsUnrealized.totalRealized).toBeCloseTo(expectedRealizedGain, 2)
        expect(result.realizedVsUnrealized.totalUnrealized).toBe(0)
        expect(result.realizedVsUnrealized.realizedPercentage).toBe(100)
        expect(result.realizedVsUnrealized.unrealizedPercentage).toBe(0)
      })
    })
  })
})