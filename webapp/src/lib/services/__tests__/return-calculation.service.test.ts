import { returnCalculationService } from '../return-calculation.service'
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

  // Test helper functions
  const createTestTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
    id: 'test-tx-1',
    user_id: mockUserId,
    symbol: 'TEST',
    type: 'buy',
    quantity: 100,
    price_per_unit: 10,
    fees: 0,
    date: '2024-01-01',
    notes: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides
  })

  const createTestHistoricalData = (overrides: Array<Partial<HistoricalDataPoint>> = []): HistoricalDataPoint[] => {
    const defaults: HistoricalDataPoint[] = [
      {
        date: '2024-01-01',
        totalValue: 1000,
        costBasis: 1000,
        totalPnL: 0,
        totalPnLPercentage: 0,
        assetTypeAllocations: { stock: 100 },
        assetTypeValues: { stock: 1000 }
      },
      {
        date: '2024-12-31',
        totalValue: 1200,
        costBasis: 1000,
        totalPnL: 200,
        totalPnLPercentage: 20,
        assetTypeAllocations: { stock: 100 },
        assetTypeValues: { stock: 1200 }
      }
    ]

    return defaults.map((defaultData, index) => ({
      ...defaultData,
      ...(overrides[index] || {})
    }))
  }

  describe('Single Symbol - Capital Appreciation Scenarios', () => {
    it('✅ Capital Appreciating: Single buy, price goes up 20%', () => {
      // SCENARIO: Buy 100 shares at $10, price appreciates to $12
      const transactions = [
        createTestTransaction({
          symbol: 'AAPL',
          type: 'buy',
          quantity: 100,
          price_per_unit: 10,
          fees: 1,
          date: '2024-01-01'
        })
      ]

      const historicalData = createTestHistoricalData([
        {
          date: '2024-01-01',
          totalValue: 1001, // 100 * 10 + 1 fee
          assetTypeValues: { stock: 1001 }
        },
        {
          date: '2024-12-31',
          totalValue: 1200, // 100 * 12 (20% appreciation)
          assetTypeValues: { stock: 1200 }
        }
      ])

      const result = returnCalculationService.calculatePortfolioReturnMetrics(
        transactions,
        historicalData,
        [createMockSymbol()],
        { startDate: '2024-01-01', endDate: '2024-12-31' }
      )

      expect(result.totalInvested).toBe(1001) // 100 * 10 + 1 fee
      expect(result.costBasis).toBe(1001) // Same as invested for open position
      expect(result.realizedPnL).toBe(0) // No sales
      expect(result.unrealizedPnL).toBe(199) // 1200 - 1001
      expect(result.capitalGains).toBe(199) // Same as unrealized when no sales
      expect(result.dividends).toBe(0) // No dividend transactions
      expect(result.totalPnL).toBe(199) // capitalGains + dividends
    })

    it('❌ Capital Depreciating: Single buy, price drops 15%', () => {
      // SCENARIO: Buy 100 shares at $10, price drops to $8.50
      const transactions = [
        createTestTransaction({
          symbol: 'TECH',
          type: 'buy',
          quantity: 100,
          price_per_unit: 10,
          fees: 2,
          date: '2024-01-01'
        })
      ]

      const historicalData = createTestHistoricalData([
        {
          date: '2024-01-01',
          totalValue: 1002, // 100 * 10 + 2 fee
          assetTypeValues: { stock: 1002 }
        },
        {
          date: '2024-12-31',
          totalValue: 850, // 100 * 8.50 (15% decline)
          assetTypeValues: { stock: 850 }
        }
      ])

      const result = returnCalculationService.calculatePortfolioReturnMetrics(
        transactions,
        historicalData,
        [createMockSymbol()],
        { startDate: '2024-01-01', endDate: '2024-12-31' }
      )

      expect(result.totalInvested).toBe(1002) // 100 * 10 + 2 fee
      expect(result.costBasis).toBe(1002) // Same as invested for open position
      expect(result.realizedPnL).toBe(0) // No sales
      expect(result.unrealizedPnL).toBe(-152) // 850 - 1002
      expect(result.capitalGains).toBe(-152) // Same as unrealized when no sales
      expect(result.dividends).toBe(0) // No dividend transactions
      expect(result.totalPnL).toBe(-152) // capitalGains + dividends
    })
  })

  describe('Single Symbol - Dividend Scenarios', () => {
    it('💰 Flat Price + Dividends: Stock price flat, earns dividends', () => {
      // SCENARIO: Stock price stays flat at $10, but earns $50 in dividends
      const transactions = [
        createTestTransaction({
          symbol: 'REIT',
          type: 'buy',
          quantity: 100,
          price_per_unit: 10,
          fees: 0,
          date: '2024-01-01'
        }),
        createTestTransaction({
          symbol: 'REIT',
          type: 'dividend',
          quantity: 0, // Dividends don't affect quantity
          price_per_unit: 0,
          amount: 50, // Total dividend amount
          fees: 0,
          date: '2024-06-15'
        })
      ]

      const historicalData = createTestHistoricalData([
        {
          date: '2024-01-01',
          totalValue: 1000, // 100 * 10
          assetTypeValues: { stock: 1000 }
        },
        {
          date: '2024-12-31',
          totalValue: 1000, // Still 100 * 10 (flat price)
          assetTypeValues: { stock: 1000 }
        }
      ])

      const result = returnCalculationService.calculatePortfolioReturnMetrics(
        transactions,
        historicalData,
        [createMockSymbol()],
        { startDate: '2024-01-01', endDate: '2024-12-31' }
      )

      expect(result.totalInvested).toBe(1000) // Only the initial purchase
      expect(result.costBasis).toBe(1000) // Same as invested
      expect(result.realizedPnL).toBe(0) // No sales
      expect(result.unrealizedPnL).toBe(0) // 1000 - 1000 (flat price)
      expect(result.capitalGains).toBe(0) // No price appreciation
      expect(result.dividends).toBe(50) // The dividend payment
      expect(result.totalPnL).toBe(50) // All return from dividends
    })

    it('🎁 Bonus Shares: Stock gets bonus shares instead of dividends', () => {
      // SCENARIO: Stock grants 10 bonus shares (1:10 bonus)
      const transactions = [
        createTestTransaction({
          symbol: 'BONUS',
          type: 'buy',
          quantity: 100,
          price_per_unit: 10,
          fees: 0,
          date: '2024-01-01'
        }),
        createTestTransaction({
          symbol: 'BONUS',
          type: 'bonus',
          quantity: 10, // Bonus shares received
          price_per_unit: 0, // Bonus shares have zero cost
          fees: 0,
          date: '2024-06-15'
        })
      ]

      const historicalData = createTestHistoricalData([
        {
          date: '2024-01-01',
          totalValue: 1000, // 100 * 10
          assetTypeValues: { stock: 1000 }
        },
        {
          date: '2024-12-31',
          totalValue: 1100, // 110 * 10 (same price, more shares)
          assetTypeValues: { stock: 1100 }
        }
      ])

      const result = returnCalculationService.calculatePortfolioReturnMetrics(
        transactions,
        historicalData,
        [createMockSymbol()],
        { startDate: '2024-01-01', endDate: '2024-12-31' }
      )

      expect(result.totalInvested).toBe(1000) // Only the initial purchase
      expect(result.costBasis).toBe(1000) // Original purchase cost
      expect(result.realizedPnL).toBe(0) // No sales
      expect(result.unrealizedPnL).toBe(100) // 1100 - 1000 (value of bonus shares)
      expect(result.capitalGains).toBe(100) // Gain from bonus shares
      expect(result.dividends).toBe(0) // No cash dividends
      expect(result.totalPnL).toBe(100) // All return from bonus shares
    })
  })

  describe('Single Symbol - Closed Position Scenarios', () => {
    it('📈 Profitable Closed Position: Buy low, sell high', () => {
      // SCENARIO: Buy 100 shares at $10, sell all at $15 (50% profit)
      const transactions = [
        createTestTransaction({
          symbol: 'WINNER',
          type: 'buy',
          quantity: 100,
          price_per_unit: 10,
          fees: 1,
          date: '2024-01-01'
        }),
        createTestTransaction({
          symbol: 'WINNER',
          type: 'sell',
          quantity: 100,
          price_per_unit: 15,
          fees: 1,
          date: '2024-06-15'
        })
      ]

      const historicalData = createTestHistoricalData([
        {
          date: '2024-01-01',
          totalValue: 1001, // 100 * 10 + 1 fee
          assetTypeValues: { stock: 1001 }
        },
        {
          date: '2024-12-31',
          totalValue: 0, // Position fully closed
          assetTypeValues: { stock: 0 }
        }
      ])

      const result = returnCalculationService.calculatePortfolioReturnMetrics(
        transactions,
        historicalData,
        [createMockSymbol()],
        { startDate: '2024-01-01', endDate: '2024-12-31' }
      )

      expect(result.totalInvested).toBe(1001) // 100 * 10 + 1 fee
      expect(result.costBasis).toBe(0) // No remaining position
      expect(result.realizedPnL).toBeCloseTo(498, 0) // (15 - 0.01 sell fee - 10.01) * 100 = 498
      expect(result.unrealizedPnL).toBe(0) // No remaining position
      expect(result.capitalGains).toBeCloseTo(498, 0) // All gains are realized
      expect(result.dividends).toBe(0) // No dividends
      expect(result.totalPnL).toBeCloseTo(498, 0) // All from realized gains
    })

    it('📉 Loss-Making Closed Position: Buy high, sell low', () => {
      // SCENARIO: Buy 100 shares at $20, sell all at $12 (40% loss)
      const transactions = [
        createTestTransaction({
          symbol: 'LOSER',
          type: 'buy',
          quantity: 100,
          price_per_unit: 20,
          fees: 2,
          date: '2024-01-01'
        }),
        createTestTransaction({
          symbol: 'LOSER',
          type: 'sell',
          quantity: 100,
          price_per_unit: 12,
          fees: 2,
          date: '2024-06-15'
        })
      ]

      const historicalData = createTestHistoricalData([
        {
          date: '2024-01-01',
          totalValue: 2002, // 100 * 20 + 2 fee
          assetTypeValues: { stock: 2002 }
        },
        {
          date: '2024-12-31',
          totalValue: 0, // Position fully closed
          assetTypeValues: { stock: 0 }
        }
      ])

      const result = returnCalculationService.calculatePortfolioReturnMetrics(
        transactions,
        historicalData,
        [createMockSymbol()],
        { startDate: '2024-01-01', endDate: '2024-12-31' }
      )

      expect(result.totalInvested).toBe(2002) // 100 * 20 + 2 fee
      expect(result.costBasis).toBe(0) // No remaining position
      expect(result.realizedPnL).toBeCloseTo(-804, 0) // (12 - 0.02 sell fee - 20.02) * 100 = -804
      expect(result.unrealizedPnL).toBe(0) // No remaining position
      expect(result.capitalGains).toBeCloseTo(-804, 0) // All losses are realized
      expect(result.dividends).toBe(0) // No dividends
      expect(result.totalPnL).toBeCloseTo(-804, 0) // All from realized losses
    })

    it('🔄 Complex Closed Position: Multiple buys at different prices, then sell all', () => {
      // SCENARIO: FIFO cost basis calculation with multiple purchases
      const transactions = [
        // First purchase: 50 shares at $10
        createTestTransaction({
          symbol: 'FIFO',
          type: 'buy',
          quantity: 50,
          price_per_unit: 10,
          fees: 1,
          date: '2024-01-01'
        }),
        // Second purchase: 50 shares at $20
        createTestTransaction({
          symbol: 'FIFO',
          type: 'buy',
          quantity: 50,
          price_per_unit: 20,
          fees: 1,
          date: '2024-02-01'
        }),
        // Sell all 100 shares at $15 (FIFO: first 50 at profit, next 50 at loss)
        createTestTransaction({
          symbol: 'FIFO',
          type: 'sell',
          quantity: 100,
          price_per_unit: 15,
          fees: 2,
          date: '2024-06-15'
        })
      ]

      const historicalData = createTestHistoricalData([
        {
          date: '2024-01-01',
          totalValue: 501, // 50 * 10 + 1 fee
          assetTypeValues: { stock: 501 }
        },
        {
          date: '2024-12-31',
          totalValue: 0, // Position fully closed
          assetTypeValues: { stock: 0 }
        }
      ])

      const result = returnCalculationService.calculatePortfolioReturnMetrics(
        transactions,
        historicalData,
        [createMockSymbol()],
        { startDate: '2024-01-01', endDate: '2024-12-31' }
      )

      expect(result.totalInvested).toBe(1502) // (50*10+1) + (50*20+1) = 1502
      expect(result.costBasis).toBe(0) // No remaining position

      // FIFO calculation:
      // First 50 shares: (15 - 10.02) * 50 = 249
      // Next 50 shares: (15 - 20.02) * 50 = -251
      // Total realized: 249 - 251 = -2 (plus sell fees = -4)
      expect(result.realizedPnL).toBeCloseTo(-4, 0)
      expect(result.unrealizedPnL).toBe(0) // No remaining position
      expect(result.capitalGains).toBeCloseTo(-4, 0) // Loss due to fees
      expect(result.dividends).toBe(0)
      expect(result.totalPnL).toBeCloseTo(-4, 0)
    })
  })

  describe('Edge Cases and Boundary Conditions', () => {
    it('⚪ Empty Portfolio: No transactions', () => {
      const transactions: Transaction[] = []
      const historicalData = createTestHistoricalData([
        { totalValue: 0, assetTypeValues: { stock: 0 } },
        { totalValue: 0, assetTypeValues: { stock: 0 } }
      ])

      const result = returnCalculationService.calculatePortfolioReturnMetrics(
        transactions,
        historicalData,
        [createMockSymbol()],
        { startDate: '2024-01-01', endDate: '2024-12-31' }
      )

      expect(result.totalInvested).toBe(0)
      expect(result.costBasis).toBe(0)
      expect(result.realizedPnL).toBe(0)
      expect(result.unrealizedPnL).toBe(0)
      expect(result.capitalGains).toBe(0)
      expect(result.dividends).toBe(0)
      expect(result.totalPnL).toBe(0)
    })

    it('🎯 Zero Fees: Clean calculation without transaction costs', () => {
      const transactions = [
        createTestTransaction({
          symbol: 'ZERO',
          type: 'buy',
          quantity: 100,
          price_per_unit: 10,
          fees: 0, // No fees
          date: '2024-01-01'
        })
      ]

      const historicalData = createTestHistoricalData([
        {
          date: '2024-01-01',
          totalValue: 1000, // Exactly 100 * 10
          assetTypeValues: { stock: 1000 }
        },
        {
          date: '2024-12-31',
          totalValue: 1100, // 10% appreciation
          assetTypeValues: { stock: 1100 }
        }
      ])

      const result = returnCalculationService.calculatePortfolioReturnMetrics(
        transactions,
        historicalData,
        [createMockSymbol()],
        { startDate: '2024-01-01', endDate: '2024-12-31' }
      )

      expect(result.totalInvested).toBe(1000) // Clean $1000
      expect(result.costBasis).toBe(1000) // Same as invested
      expect(result.unrealizedPnL).toBe(100) // Clean $100 gain
      expect(result.totalPnL).toBe(100) // 10% exactly
    })

    it('🔀 Mixed Transactions: Combination of all transaction types', () => {
      // SCENARIO: Complex portfolio with buys, sells, dividends, and bonuses
      const transactions = [
        // Initial purchase
        createTestTransaction({
          symbol: 'MIXED',
          type: 'buy',
          quantity: 100,
          price_per_unit: 10,
          fees: 1,
          date: '2024-01-01'
        }),
        // Dividend payment
        createTestTransaction({
          symbol: 'MIXED',
          type: 'dividend',
          quantity: 0,
          price_per_unit: 0,
          amount: 25,
          fees: 0,
          date: '2024-03-15'
        }),
        // Bonus shares
        createTestTransaction({
          symbol: 'MIXED',
          type: 'bonus',
          quantity: 5,
          price_per_unit: 0,
          fees: 0,
          date: '2024-06-15'
        }),
        // Partial sale
        createTestTransaction({
          symbol: 'MIXED',
          type: 'sell',
          quantity: 50,
          price_per_unit: 12,
          fees: 1,
          date: '2024-09-15'
        })
      ]

      const historicalData = createTestHistoricalData([
        {
          date: '2024-01-01',
          totalValue: 1001, // 100 * 10 + 1 fee
          assetTypeValues: { stock: 1001 }
        },
        {
          date: '2024-12-31',
          totalValue: 660, // Remaining 55 shares * $12
          assetTypeValues: { stock: 660 }
        }
      ])

      const result = returnCalculationService.calculatePortfolioReturnMetrics(
        transactions,
        historicalData,
        [createMockSymbol()],
        { startDate: '2024-01-01', endDate: '2024-12-31' }
      )

      expect(result.totalInvested).toBe(1001) // Initial purchase only
      expect(result.costBasis).toBe(500.5) // Remaining 55 shares at avg cost ~$10.01
      expect(result.dividends).toBe(25) // Dividend payment
      expect(result.realizedPnL).toBeCloseTo(98.5, 0) // Profit from sale (approximately)
      expect(result.unrealizedPnL).toBeCloseTo(159.5, 1) // Remaining position gain
      expect(result.totalPnL).toBeCloseTo(283, 0) // Total of all components
    })
  })

})