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
        dividendIncome: 0
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
          quantity: 100,
          price_per_unit: 2.50, // $2.50 per share
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
        dividendIncome: 250 // 100 * 2.50 (tracked separately)
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
        dividendIncome: 0
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
  })
})