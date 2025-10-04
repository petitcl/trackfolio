import { unifiedCalculationService } from '../unified-calculation.service'
import { historicalPriceService } from '../historical-price.service'
import { currencyService } from '../currency.service'
import type { Transaction, Symbol } from '@/lib/supabase/types'
import type { AuthUser } from '@/lib/auth/client.auth.service'

// Mock the dependencies
jest.mock('../historical-price.service')
jest.mock('../currency.service')

const mockHistoricalPriceService = jest.mocked(historicalPriceService)
const mockCurrencyService = jest.mocked(currencyService)

describe('UnifiedCalculationService', () => {
  const mockUser: AuthUser = {
    id: 'test-user',
    email: 'test@example.com',
    created_at: '2021-01-01T00:00:00Z',
    aud: 'authenticated',
    role: 'authenticated'
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('calculateCurrentPositions', () => {
    it('should calculate current positions with unified logic', async () => {
      const symbols: Symbol[] = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc',
          asset_type: 'stock',
          currency: 'USD',
          last_price: 155.00,
          last_updated: '2023-01-01T00:00:00Z',
          is_custom: false,
          created_by_user_id: null,
          created_at: '2023-01-01T00:00:00Z'
        }
      ]

      const transactions: Transaction[] = [
        {
          id: '1',
          user_id: 'test-user',
          date: '2023-01-01',
          symbol: 'AAPL',
          type: 'buy',
          quantity: 100,
          price_per_unit: 140.00,
          amount: null,
          currency: 'USD',
          fees: 10,
          notes: null,
          broker: null,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ]

      // Mock historical price service
      mockHistoricalPriceService.getHistoricalPriceForDate.mockResolvedValue(155.00)

      const positions = await unifiedCalculationService.calculateCurrentPositions(
        transactions,
        symbols,
        mockUser,
        'USD'
      )

      expect(positions).toHaveLength(1)
      expect(positions[0]).toEqual({
        symbol: 'AAPL',
        quantity: 100,
        avgCost: 140.00,
        currentPrice: 155.00,
        value: 15500, // 100 * 155.00 (no dividends included)
        unrealizedPnL: 1500, // 15500 - (100 * 140.00)
        isCustom: false,
        dividendIncome: 0,
        realizedCostBasis: 0,
        realizedPnL: 0
      })
    })

    it('should handle dividends correctly (tracked separately from value)', async () => {
      const symbols: Symbol[] = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc',
          asset_type: 'stock',
          currency: 'USD',
          last_price: 155.00,
          last_updated: '2023-01-01T00:00:00Z',
          is_custom: false,
          created_by_user_id: null,
          created_at: '2023-01-01T00:00:00Z'
        }
      ]

      const transactions: Transaction[] = [
        {
          id: '1',
          user_id: 'test-user',
          date: '2023-01-01',
          symbol: 'AAPL',
          type: 'buy',
          quantity: 100,
          price_per_unit: 140.00,
          amount: null,
          currency: 'USD',
          fees: 0,
          notes: null,
          broker: null,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        },
        {
          id: '2',
          user_id: 'test-user',
          date: '2023-06-01',
          symbol: 'AAPL',
          type: 'dividend',
          quantity: 0,
          price_per_unit: 0,
          amount: 250, // $2.50 per share * 100 shares = $250 cash dividend
          currency: 'USD',
          fees: 0,
          notes: null,
          broker: null,
          created_at: '2023-06-01T00:00:00Z',
          updated_at: '2023-06-01T00:00:00Z'
        }
      ]

      mockHistoricalPriceService.getHistoricalPriceForDate.mockResolvedValue(155.00)

      const positions = await unifiedCalculationService.calculateCurrentPositions(
        transactions,
        symbols,
        mockUser,
        'USD'
      )

      expect(positions).toHaveLength(1)
      expect(positions[0]).toEqual({
        symbol: 'AAPL',
        quantity: 100,
        avgCost: 140.00,
        currentPrice: 155.00,
        value: 15500, // 100 * 155.00 (dividends NOT included in value)
        unrealizedPnL: 1500, // 15500 - (100 * 140.00)
        isCustom: false,
        dividendIncome: 250, // 100 * 2.50 (tracked separately)
        realizedCostBasis: 0,
        realizedPnL: 0
      })
    })

    it('should handle currency conversion correctly', async () => {
      const symbols: Symbol[] = [
        {
          symbol: 'EUR_STOCK',
          name: 'European Stock',
          asset_type: 'stock',
          currency: 'EUR',
          last_price: 95.00,
          last_updated: '2023-01-01T00:00:00Z',
          is_custom: false,
          created_by_user_id: null,
          created_at: '2023-01-01T00:00:00Z'
        }
      ]

      const transactions: Transaction[] = [
        {
          id: '1',
          user_id: 'test-user',
          date: '2023-01-01',
          symbol: 'EUR_STOCK',
          type: 'buy',
          quantity: 10,
          price_per_unit: 90.00,
          amount: null,
          currency: 'EUR',
          fees: 0,
          notes: null,
          broker: null,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ]

      // Mock historical price service to return EUR price
      mockHistoricalPriceService.getHistoricalPriceForDate.mockResolvedValue(95.00)

      // Mock currency service to convert EUR to USD (1 EUR = 1.1 USD)
      mockCurrencyService.getExchangeRate.mockResolvedValue(1.1)

      const positions = await unifiedCalculationService.calculateCurrentPositions(
        transactions,
        symbols,
        mockUser,
        'USD' // Target currency is USD
      )

      expect(positions).toHaveLength(1)
      expect(positions[0].symbol).toBe('EUR_STOCK')
      expect(positions[0].quantity).toBe(10)
      expect(positions[0].avgCost).toBe(90.00)
      expect(positions[0].currentPrice).toBeCloseTo(104.5, 1) // 95.00 EUR * 1.1 = 104.5 USD
      expect(positions[0].value).toBeCloseTo(1045, 1) // 10 * 104.5 USD
      expect(positions[0].unrealizedPnL).toBeCloseTo(145, 1) // 1045 - (10 * 90.00)
      expect(positions[0].isCustom).toBe(false)
      expect(positions[0].dividendIncome).toBe(0)
      expect(positions[0].realizedCostBasis).toBe(0)
      expect(positions[0].realizedPnL).toBe(0)

      expect(mockCurrencyService.getExchangeRate).toHaveBeenCalledWith(
        'EUR',
        'USD',
        mockUser,
        symbols,
        expect.any(String)
      )
    })

    it('should handle empty transactions', async () => {
      const positions = await unifiedCalculationService.calculateCurrentPositions(
        [],
        [],
        mockUser,
        'USD'
      )

      expect(positions).toEqual([])
    })

    it('should handle stock dividend (reinvested shares)', async () => {
      const symbols: Symbol[] = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc',
          asset_type: 'stock',
          currency: 'USD',
          last_price: 155.00,
          last_updated: '2023-01-01T00:00:00Z',
          is_custom: false,
          created_by_user_id: null,
          created_at: '2023-01-01T00:00:00Z'
        }
      ]

      const transactions: Transaction[] = [
        {
          id: '1',
          user_id: 'test-user',
          date: '2023-01-01',
          symbol: 'AAPL',
          type: 'buy',
          quantity: 100,
          price_per_unit: 140.00,
          amount: null,
          currency: 'USD',
          fees: 0,
          notes: null,
          broker: null,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        },
        {
          id: '2',
          user_id: 'test-user',
          date: '2023-06-01',
          symbol: 'AAPL',
          type: 'dividend',
          quantity: 5, // 5 additional shares
          price_per_unit: 0, // Stock dividend (no cash value)
          amount: null,
          currency: 'USD',
          fees: 0,
          notes: null,
          broker: null,
          created_at: '2023-06-01T00:00:00Z',
          updated_at: '2023-06-01T00:00:00Z'
        }
      ]

      mockHistoricalPriceService.getHistoricalPriceForDate.mockResolvedValue(155.00)

      const positions = await unifiedCalculationService.calculateCurrentPositions(
        transactions,
        symbols,
        mockUser,
        'USD'
      )

      expect(positions).toHaveLength(1)
      expect(positions[0].symbol).toBe('AAPL')
      expect(positions[0].quantity).toBe(105) // 100 + 5 stock dividend shares
      expect(positions[0].avgCost).toBeCloseTo(133.33, 2) // 14000 / 105 (cost spread over all shares)
      expect(positions[0].currentPrice).toBe(155.00)
      expect(positions[0].value).toBeCloseTo(16275, 1) // 105 * 155.00
      expect(positions[0].unrealizedPnL).toBeCloseTo(2275, 1) // 16275 - 14000
      expect(positions[0].isCustom).toBe(false)
      expect(positions[0].dividendIncome).toBe(0) // No cash dividend income
      expect(positions[0].realizedCostBasis).toBe(0)
      expect(positions[0].realizedPnL).toBe(0)
    })

    it('should handle bonus shares correctly', async () => {
      const symbols: Symbol[] = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc',
          asset_type: 'stock',
          currency: 'USD',
          last_price: 155.00,
          last_updated: '2023-01-01T00:00:00Z',
          is_custom: false,
          created_by_user_id: null,
          created_at: '2023-01-01T00:00:00Z'
        }
      ]

      const transactions: Transaction[] = [
        {
          id: '1',
          user_id: 'test-user',
          date: '2023-01-01',
          symbol: 'AAPL',
          type: 'buy',
          quantity: 100,
          price_per_unit: 140.00,
          amount: null,
          currency: 'USD',
          fees: 0,
          notes: null,
          broker: null,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        },
        {
          id: '2',
          user_id: 'test-user',
          date: '2023-06-01',
          symbol: 'AAPL',
          type: 'bonus',
          quantity: 10,
          price_per_unit: 0, // Bonus shares (free)
          amount: null,
          currency: 'USD',
          fees: 0,
          notes: null,
          broker: null,
          created_at: '2023-06-01T00:00:00Z',
          updated_at: '2023-06-01T00:00:00Z'
        }
      ]

      mockHistoricalPriceService.getHistoricalPriceForDate.mockResolvedValue(155.00)

      const positions = await unifiedCalculationService.calculateCurrentPositions(
        transactions,
        symbols,
        mockUser,
        'USD'
      )

      expect(positions).toHaveLength(1)
      expect(positions[0]).toEqual({
        symbol: 'AAPL',
        quantity: 110, // 100 + 10 bonus shares
        avgCost: 127.27272727272727, // 14000 / 110 (cost spread over all shares)
        currentPrice: 155.00,
        value: 17050, // 110 * 155.00
        unrealizedPnL: 3050, // 17050 - 14000
        isCustom: false,
        dividendIncome: 0,
        realizedCostBasis: 0,
        realizedPnL: 0
      })
    })
  })

  describe('calculateUnifiedHistoricalData', () => {
    it('should calculate historical data for portfolio', async () => {
      const symbols: Symbol[] = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc',
          asset_type: 'stock',
          currency: 'USD',
          last_price: 155.00,
          last_updated: '2023-01-01T00:00:00Z',
          is_custom: false,
          created_by_user_id: null,
          created_at: '2023-01-01T00:00:00Z'
        }
      ]

      const transactions: Transaction[] = [
        {
          id: '1',
          user_id: 'test-user',
          date: '2023-01-01',
          symbol: 'AAPL',
          type: 'buy',
          quantity: 100,
          price_per_unit: 140.00,
          amount: null,
          currency: 'USD',
          fees: 0,
          notes: null,
          broker: null,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ]

      // Mock price fetching
      mockHistoricalPriceService.fetchHistoricalPrices.mockResolvedValue(
        new Map([
          ['2023-01-01', 140.00],
          ['2023-01-02', 145.00]
        ])
      )

      const historicalData = await unifiedCalculationService.calculateUnifiedHistoricalData(
        mockUser,
        transactions,
        symbols,
        { targetCurrency: 'USD' }
      )

      expect(historicalData.length).toBeGreaterThan(0)
      expect(historicalData[0]).toHaveProperty('date')
      expect(historicalData[0]).toHaveProperty('totalValue')
      expect(historicalData[0]).toHaveProperty('assetTypeAllocations')
      expect(historicalData[0]).toHaveProperty('assetTypeValues')
      expect(historicalData[0]).toHaveProperty('costBasis')
    })

    it('should calculate historical data for individual holding', async () => {
      const symbols: Symbol[] = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc',
          asset_type: 'stock',
          currency: 'USD',
          last_price: 155.00,
          last_updated: '2023-01-01T00:00:00Z',
          is_custom: false,
          created_by_user_id: null,
          created_at: '2023-01-01T00:00:00Z'
        }
      ]

      const transactions: Transaction[] = [
        {
          id: '1',
          user_id: 'test-user',
          date: '2023-01-01',
          symbol: 'AAPL',
          type: 'buy',
          quantity: 100,
          price_per_unit: 140.00,
          amount: null,
          currency: 'USD',
          fees: 0,
          notes: null,
          broker: null,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ]

      // Mock price fetching
      mockHistoricalPriceService.fetchHistoricalPrices.mockResolvedValue(
        new Map([
          ['2023-01-01', 140.00],
          ['2023-01-02', 145.00]
        ])
      )

      const historicalData = await unifiedCalculationService.calculateUnifiedHistoricalData(
        mockUser,
        transactions,
        symbols,
        {
          targetSymbol: 'AAPL',
          targetCurrency: 'USD'
        }
      )

      expect(historicalData.length).toBeGreaterThan(0)

      // For individual holdings, allocations should be 100% for that asset type
      expect(historicalData[0].assetTypeAllocations.stock).toBe(100)
      expect(historicalData[0].assetTypeAllocations.crypto).toBe(0)
    })

    it('should continue generating historical data after position liquidation for single holdings', async () => {
      const symbols: Symbol[] = [
        {
          symbol: 'CT.YOMONI',
          name: 'YOMONI',
          asset_type: 'stock',
          currency: 'EUR',
          last_price: 15786.07,
          last_updated: '2025-04-30T00:00:00Z',
          is_custom: true,
          created_by_user_id: 'test-user',
          created_at: '2021-11-29T00:00:00Z'
        }
      ]

      // Scenario: Buy then fully liquidate
      const transactions: Transaction[] = [
        {
          id: '1',
          user_id: 'test-user',
          date: '2021-11-29',
          symbol: 'CT.YOMONI',
          type: 'buy',
          quantity: 1,
          price_per_unit: 14300.00,
          amount: null,
          currency: 'EUR',
          fees: 0,
          notes: null,
          broker: null,
          created_at: '2021-11-29T00:00:00Z',
          updated_at: '2021-11-29T00:00:00Z'
        },
        {
          id: '2',
          user_id: 'test-user',
          date: '2025-04-30',
          symbol: 'CT.YOMONI',
          type: 'sell',
          quantity: 1,
          price_per_unit: 15786.07,
          amount: null,
          currency: 'EUR',
          fees: 0,
          notes: null,
          broker: null,
          created_at: '2025-04-30T00:00:00Z',
          updated_at: '2025-04-30T00:00:00Z'
        }
      ]

      // Mock price data including after liquidation
      mockHistoricalPriceService.fetchHistoricalPrices.mockResolvedValue(
        new Map([
          ['2021-11-29', 14300.00],
          ['2025-03-29', 17124.52],
          ['2025-04-30', 15786.07], // Liquidation date
          ['2025-05-01', 16000.00]  // After liquidation
        ])
      )

      const historicalData = await unifiedCalculationService.calculateUnifiedHistoricalData(
        mockUser,
        transactions,
        symbols,
        {
          targetSymbol: 'CT.YOMONI',
          targetCurrency: 'EUR'
        }
      )

      expect(historicalData.length).toBeGreaterThan(0)

      // Find data points before, during, and after liquidation
      const beforeLiquidation = historicalData.find(d => d.date === '2025-03-29')
      const liquidationDate = historicalData.find(d => d.date === '2025-04-30')
      const afterLiquidation = historicalData.find(d => d.date === '2025-05-01')

      // Before liquidation: should have position
      expect(beforeLiquidation).toBeDefined()
      if (beforeLiquidation) {
        expect(beforeLiquidation.assetTypeValues.stock).toBeGreaterThan(0)
      }

      // On liquidation date: should still have data point
      expect(liquidationDate).toBeDefined()

      // After liquidation: should still generate data points (this was the bug)
      expect(afterLiquidation).toBeDefined()
      if (afterLiquidation) {
        // After liquidation, value should be 0 but data point should exist
        expect(afterLiquidation.assetTypeValues.stock).toBe(0)
      }

      // Verify the last data point exists (should not stop at March 29)
      const lastDataPoint = historicalData[historicalData.length - 1]
      expect(new Date(lastDataPoint.date).getTime()).toBeGreaterThanOrEqual(new Date('2025-04-30').getTime())
    })

    it('should not generate data after liquidation for portfolio calculations', async () => {
      const symbols: Symbol[] = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc',
          asset_type: 'stock',
          currency: 'USD',
          last_price: 155.00,
          last_updated: '2025-04-30T00:00:00Z',
          is_custom: false,
          created_by_user_id: null,
          created_at: '2023-01-01T00:00:00Z'
        }
      ]

      // Portfolio with complete liquidation
      const transactions: Transaction[] = [
        {
          id: '1',
          user_id: 'test-user',
          date: '2023-01-01',
          symbol: 'AAPL',
          type: 'buy',
          quantity: 10,
          price_per_unit: 140.00,
          amount: null,
          currency: 'USD',
          fees: 0,
          notes: null,
          broker: null,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        },
        {
          id: '2',
          user_id: 'test-user',
          date: '2023-01-05',
          symbol: 'AAPL',
          type: 'sell',
          quantity: 10,
          price_per_unit: 155.00,
          amount: null,
          currency: 'USD',
          fees: 0,
          notes: null,
          broker: null,
          created_at: '2023-01-05T00:00:00Z',
          updated_at: '2023-01-05T00:00:00Z'
        }
      ]

      mockHistoricalPriceService.fetchHistoricalPrices.mockResolvedValue(
        new Map([
          ['2023-01-01', 140.00],
          ['2023-01-02', 145.00],
          ['2023-01-05', 155.00],
          ['2023-01-06', 160.00]  // After liquidation
        ])
      )

      // Portfolio calculation (no targetSymbol)
      const historicalData = await unifiedCalculationService.calculateUnifiedHistoricalData(
        mockUser,
        transactions,
        symbols
      )

      // For portfolio calculations, should stop generating data after complete liquidation
      const afterLiquidation = historicalData.find(d => d.date === '2023-01-06')
      expect(afterLiquidation).toBeUndefined()

      // Last data point should be on or before liquidation date
      const lastDataPoint = historicalData[historicalData.length - 1]
      expect(new Date(lastDataPoint.date).getTime()).toBeLessThanOrEqual(new Date('2023-01-05').getTime())
    })
  })
})