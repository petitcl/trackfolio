import { describe, it, expect, beforeEach } from '@jest/globals';
import { portfolioCalculationService, type PortfolioPosition } from '../portfolio-calculation.service';
import { historicalPriceService } from '../historical-price.service';
import type { Transaction, Symbol } from '@/lib/supabase/types';
import type { AuthUser } from '@/lib/auth/client.auth.service';

describe('PortfolioCalculationService', () => {
  const service = portfolioCalculationService;

  // Test data scenarios
  const mockSymbols: Symbol[] = [
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      asset_type: 'stock',
      currency: 'USD',
      last_price: 150.00,
      last_updated: '2024-01-15T00:00:00Z',
      is_custom: false,
      created_by_user_id: null,
      created_at: '2024-01-01T00:00:00Z'
    },
    {
      symbol: 'TSLA',
      name: 'Tesla Inc.',
      asset_type: 'stock',
      currency: 'USD',
      last_price: 200.00,
      last_updated: '2024-01-15T00:00:00Z',
      is_custom: false,
      created_by_user_id: null,
      created_at: '2024-01-01T00:00:00Z'
    },
    {
      symbol: 'BTC',
      name: 'Bitcoin',
      asset_type: 'crypto',
      currency: 'USD',
      last_price: 50000.00,
      last_updated: '2024-01-15T00:00:00Z',
      is_custom: false,
      created_by_user_id: null,
      created_at: '2024-01-01T00:00:00Z'
    },
    {
      symbol: 'HOUSE_123',
      name: 'Main Street Property',
      asset_type: 'real_estate',
      currency: 'USD',
      last_price: 500000.00,
      last_updated: '2024-01-15T00:00:00Z',
      is_custom: true,
      created_by_user_id: 'user-123',
      created_at: '2024-01-01T00:00:00Z'
    },
    {
      symbol: 'USD',
      name: 'US Dollar',
      asset_type: 'cash',
      currency: 'USD',
      last_price: 1.00,
      last_updated: '2024-01-15T00:00:00Z',
      is_custom: false,
      created_by_user_id: null,
      created_at: '2024-01-01T00:00:00Z'
    }
  ];

  beforeEach(() => {
    // Service is now the singleton unifiedCalculationService
  });

  describe('calculatePositionsFromTransactions', () => {
    it('should handle simple buy transactions', async () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          user_id: 'user-123',
          symbol: 'AAPL',
          type: 'buy',
          quantity: 10,
          price_per_unit: 100.00,
          fees: 5.00,
          date: '2024-01-01',
          created_at: '2024-01-01T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        }
      ];

      const mockUser: AuthUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2021-01-01T00:00:00Z',
        aud: 'authenticated',
        role: 'authenticated'
      }

      const positions = await service.calculateCurrentPositions(transactions, mockSymbols, mockUser);

      expect(positions).toHaveLength(1);
      expect(positions[0]).toEqual({
        symbol: 'AAPL',
        quantity: 10,
        avgCost: 100.00,
        currentPrice: 150.00,
        value: 1500.00,
        isCustom: false,
        dividendIncome: 0,
      });
    });

    it('should calculate average cost correctly for multiple buy transactions', async () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          user_id: 'user-123',
          symbol: 'AAPL',
          type: 'buy',
          quantity: 10,
          price_per_unit: 100.00,
          fees: null,
          date: '2024-01-01',
          created_at: '2024-01-01T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        },
        {
          id: 'tx2',
          user_id: 'user-123',
          symbol: 'AAPL',
          type: 'buy',
          quantity: 20,
          price_per_unit: 120.00,
          fees: null,
          date: '2024-01-02',
          created_at: '2024-01-02T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        }
      ];

      const mockUser: AuthUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2021-01-01T00:00:00Z',
        aud: 'authenticated',
        role: 'authenticated'
      }

      const positions = await service.calculateCurrentPositions(transactions, mockSymbols, mockUser);

      expect(positions).toHaveLength(1);
      expect(positions[0].quantity).toBe(30);
      // Average cost: (10 * 100 + 20 * 120) / 30 = 3400 / 30 = 113.33
      expect(positions[0].avgCost).toBeCloseTo(113.33, 2);
      expect(positions[0].currentPrice).toBe(150.00);
      expect(positions[0].value).toBe(4500.00); // 30 * 150
    });

    it('should handle sell transactions correctly', async () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          user_id: 'user-123',
          symbol: 'AAPL',
          type: 'buy',
          quantity: 20,
          price_per_unit: 100.00,
          fees: null,
          date: '2024-01-01',
          created_at: '2024-01-01T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        },
        {
          id: 'tx2',
          user_id: 'user-123',
          symbol: 'AAPL',
          type: 'sell',
          quantity: 5,
          price_per_unit: 120.00,
          fees: null,
          date: '2024-01-02',
          created_at: '2024-01-02T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        }
      ];

      const mockUser: AuthUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2021-01-01T00:00:00Z',
        aud: 'authenticated',
        role: 'authenticated'
      }

      const positions = await service.calculateCurrentPositions(transactions, mockSymbols, mockUser);

      expect(positions).toHaveLength(1);
      expect(positions[0].quantity).toBe(15);
      expect(positions[0].avgCost).toBe(100.00); // Original cost basis remains
      expect(positions[0].value).toBe(2250.00); // 15 * 150
    });

    it('should remove position when completely sold', async () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          user_id: 'user-123',
          symbol: 'AAPL',
          type: 'buy',
          quantity: 10,
          price_per_unit: 100.00,
          fees: null,
          date: '2024-01-01',
          created_at: '2024-01-01T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        },
        {
          id: 'tx2',
          user_id: 'user-123',
          symbol: 'AAPL',
          type: 'sell',
          quantity: 10,
          price_per_unit: 120.00,
          fees: null,
          date: '2024-01-02',
          created_at: '2024-01-02T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        }
      ];

      const mockUser: AuthUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2021-01-01T00:00:00Z',
        aud: 'authenticated',
        role: 'authenticated'
      }

      const positions = await service.calculateCurrentPositions(transactions, mockSymbols, mockUser);

      expect(positions).toHaveLength(0);
    });

    it('should handle dividend transactions without changing cost basis', async () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          user_id: 'user-123',
          symbol: 'AAPL',
          type: 'buy',
          quantity: 10,
          price_per_unit: 100.00,
          fees: null,
          date: '2024-01-01',
          created_at: '2024-01-01T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        },
        {
          id: 'tx2',
          user_id: 'user-123',
          symbol: 'AAPL',
          type: 'dividend',
          quantity: 2,
          price_per_unit: 0.00,
          fees: null,
          date: '2024-01-02',
          created_at: '2024-01-02T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        }
      ];

      const mockUser: AuthUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2021-01-01T00:00:00Z',
        aud: 'authenticated',
        role: 'authenticated'
      }

      const positions = await service.calculateCurrentPositions(transactions, mockSymbols, mockUser);

      expect(positions).toHaveLength(1);
      expect(positions[0].quantity).toBe(12);
      expect(positions[0].avgCost).toBeCloseTo(83.33, 2); // Cost basis spread across all shares: $1000/12
      expect(positions[0].value).toBe(1800.00); // 12 * 150
      // P&L calculation: 1800 - (12 * 100) = 1800 - 1200 = 600
      // But since 2 shares were free (dividends), actual cost was only 10 * 100 = 1000
      // So unrealized P&L should be 1800 - 1000 = 800
    });

    it('should handle bonus shares without changing cost basis', async () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          user_id: 'user-123',
          symbol: 'AAPL',
          type: 'buy',
          quantity: 10,
          price_per_unit: 100.00,
          fees: null,
          date: '2024-01-01',
          created_at: '2024-01-01T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        },
        {
          id: 'tx2',
          user_id: 'user-123',
          symbol: 'AAPL',
          type: 'bonus',
          quantity: 5,
          price_per_unit: 0.00,
          fees: null,
          date: '2024-01-02',
          created_at: '2024-01-02T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        }
      ];

      const mockUser: AuthUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2021-01-01T00:00:00Z',
        aud: 'authenticated',
        role: 'authenticated'
      }

      const positions = await service.calculateCurrentPositions(transactions, mockSymbols, mockUser);

      expect(positions).toHaveLength(1);
      expect(positions[0].quantity).toBe(15);
      expect(positions[0].avgCost).toBeCloseTo(66.67, 2); // $1000/15 shares = $66.67
      expect(positions[0].value).toBe(2250.00); // 15 * 150
    });

    it('should handle dividend-only positions (no initial purchase)', async () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          user_id: 'user-123',
          symbol: 'AAPL',
          type: 'dividend',
          quantity: 5,
          price_per_unit: 0.00,
          fees: null,
          date: '2024-01-01',
          created_at: '2024-01-01T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        }
      ];

      const mockUser: AuthUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2021-01-01T00:00:00Z',
        aud: 'authenticated',
        role: 'authenticated'
      }

      const positions = await service.calculateCurrentPositions(transactions, mockSymbols, mockUser);

      expect(positions).toHaveLength(1);
      expect(positions[0].quantity).toBe(5);
      expect(positions[0].avgCost).toBe(0.00); // No cost for dividend shares
      expect(positions[0].value).toBe(750.00); // 5 * 150
    });

    it('should handle deposit transactions (cash)', async () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          user_id: 'user-123',
          symbol: 'USD',
          type: 'deposit',
          quantity: 1000,
          price_per_unit: 1.00,
          fees: null,
          date: '2024-01-01',
          created_at: '2024-01-01T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        }
      ];

      const mockUser: AuthUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2021-01-01T00:00:00Z',
        aud: 'authenticated',
        role: 'authenticated'
      }

      const positions = await service.calculateCurrentPositions(transactions, mockSymbols, mockUser);

      expect(positions).toHaveLength(1);
      expect(positions[0].quantity).toBe(1000);
      expect(positions[0].avgCost).toBe(1.00);
      expect(positions[0].value).toBe(1000.00); // 1000 * 1
    });

    it('should handle withdrawal transactions (cash)', async () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          user_id: 'user-123',
          symbol: 'USD',
          type: 'deposit',
          quantity: 1000,
          price_per_unit: 1.00,
          fees: null,
          date: '2024-01-01',
          created_at: '2024-01-01T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        },
        {
          id: 'tx2',
          user_id: 'user-123',
          symbol: 'USD',
          type: 'withdrawal',
          quantity: 300,
          price_per_unit: 1.00,
          fees: null,
          date: '2024-01-02',
          created_at: '2024-01-02T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        }
      ];

      const mockUser: AuthUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2021-01-01T00:00:00Z',
        aud: 'authenticated',
        role: 'authenticated'
      }

      const positions = await service.calculateCurrentPositions(transactions, mockSymbols, mockUser);

      expect(positions).toHaveLength(1);
      expect(positions[0].quantity).toBe(700);
      expect(positions[0].avgCost).toBe(1.00);
      expect(positions[0].value).toBe(700.00);
    });

    it('should handle custom assets correctly', async () => {
      // Mock historical price service to return expected custom price
      jest.spyOn(historicalPriceService, 'getHistoricalPriceForDate').mockResolvedValue(500000.00);

      const transactions: Transaction[] = [
        {
          id: 'tx1',
          user_id: 'user-123',
          symbol: 'HOUSE_123',
          type: 'buy',
          quantity: 1,
          price_per_unit: 400000.00,
          fees: 5000.00,
          date: '2024-01-01',
          created_at: '2024-01-01T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        }
      ];

      const mockUser: AuthUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2021-01-01T00:00:00Z',
        aud: 'authenticated',
        role: 'authenticated'
      }

      const positions = await service.calculateCurrentPositions(transactions, mockSymbols, mockUser);

      expect(positions).toHaveLength(1);
      expect(positions[0].symbol).toBe('HOUSE_123');
      expect(positions[0].quantity).toBe(1);
      expect(positions[0].avgCost).toBe(400000.00);
      expect(positions[0].currentPrice).toBe(500000.00);
      expect(positions[0].value).toBe(500000.00);
      expect(positions[0].isCustom).toBe(true);

      // Clean up mock
      jest.restoreAllMocks();
    });

    it('should handle mixed asset types in portfolio', async () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          user_id: 'user-123',
          symbol: 'AAPL',
          type: 'buy',
          quantity: 10,
          price_per_unit: 100.00,
          fees: null,
          date: '2024-01-01',
          created_at: '2024-01-01T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        },
        {
          id: 'tx2',
          user_id: 'user-123',
          symbol: 'BTC',
          type: 'buy',
          quantity: 0.5,
          price_per_unit: 40000.00,
          fees: null,
          date: '2024-01-01',
          created_at: '2024-01-01T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        },
        {
          id: 'tx3',
          user_id: 'user-123',
          symbol: 'USD',
          type: 'deposit',
          quantity: 5000,
          price_per_unit: 1.00,
          fees: null,
          date: '2024-01-01',
          created_at: '2024-01-01T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        }
      ];

      const mockUser: AuthUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2021-01-01T00:00:00Z',
        aud: 'authenticated',
        role: 'authenticated'
      }

      const positions = await service.calculateCurrentPositions(transactions, mockSymbols, mockUser);

      expect(positions).toHaveLength(3);

      const applePosition = positions.find(p => p.symbol === 'AAPL');
      expect(applePosition?.quantity).toBe(10);
      expect(applePosition?.value).toBe(1500.00);
      expect(applePosition?.isCustom).toBe(false);

      const btcPosition = positions.find(p => p.symbol === 'BTC');
      expect(btcPosition?.quantity).toBe(0.5);
      expect(btcPosition?.value).toBe(25000.00); // 0.5 * 50000

      const cashPosition = positions.find(p => p.symbol === 'USD');
      expect(cashPosition?.quantity).toBe(5000);
      expect(cashPosition?.value).toBe(5000.00);
    });

    it('should handle complex transaction history with multiple operations', async () => {
      const transactions: Transaction[] = [
        // Initial AAPL purchase
        {
          id: 'tx1',
          user_id: 'user-123',
          symbol: 'AAPL',
          type: 'buy',
          quantity: 20,
          price_per_unit: 90.00,
          fees: 10.00,
          date: '2024-01-01',
          created_at: '2024-01-01T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        },
        // Additional AAPL purchase at higher price
        {
          id: 'tx2',
          user_id: 'user-123',
          symbol: 'AAPL',
          type: 'buy',
          quantity: 10,
          price_per_unit: 110.00,
          fees: 5.00,
          date: '2024-01-05',
          created_at: '2024-01-05T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        },
        // Sell some shares
        {
          id: 'tx3',
          user_id: 'user-123',
          symbol: 'AAPL',
          type: 'sell',
          quantity: 8,
          price_per_unit: 125.00,
          fees: 8.00,
          date: '2024-01-10',
          created_at: '2024-01-10T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        },
        // Receive dividend shares
        {
          id: 'tx4',
          user_id: 'user-123',
          symbol: 'AAPL',
          type: 'dividend',
          quantity: 2,
          price_per_unit: 0.00,
          fees: null,
          date: '2024-01-15',
          created_at: '2024-01-15T00:00:00Z',
          notes: null,
          amount: null,
          broker: null,
          currency: 'USD'
        }
      ];

      const mockUser: AuthUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2021-01-01T00:00:00Z',
        aud: 'authenticated',
        role: 'authenticated'
      }

      const positions = await service.calculateCurrentPositions(transactions, mockSymbols, mockUser);

      expect(positions).toHaveLength(1);
      const position = positions[0];

      expect(position.symbol).toBe('AAPL');
      expect(position.quantity).toBe(24); // 20 + 10 - 8 + 2

      // Average cost calculation with UnifiedCalculationService:
      // Buy 1: 20 @ $90 = $1800, Buy 2: 10 @ $110 = $1100, Total: 30 shares @ $96.67 avg
      // Sell 8: remaining 22 shares, cost = 22 * $96.67 = $2126.67
      // Dividend +2: 24 shares, $2126.67 cost, avgCost = $88.61
      expect(position.avgCost).toBeCloseTo(88.61, 2);
      expect(position.currentPrice).toBe(150.00);
      expect(position.value).toBe(3600.00); // 24 * 150
    });
  });

  describe('Currency Conversion and Current Price Bug Fixes', () => {
    it('should calculate correct position values for EUR custom asset scenario', async () => {
      // Mock historical price service to return expected custom price
      jest.spyOn(historicalPriceService, 'getHistoricalPriceForDate').mockResolvedValue(1024.885);

      // Test data based on a real bug where EUR custom asset showed incorrect values
      const symbols: Symbol[] = [
        {
          symbol: 'CUSTOM_EUR_ASSET',
          name: 'Custom European Asset',
          asset_type: 'other',
          currency: 'EUR',
          last_price: 1024.885, // Divided by 10 from original 10248.85
          last_updated: '2025-08-29T00:00:00Z',
          is_custom: true,
          created_by_user_id: 'test-user',
          created_at: '2021-01-01T00:00:00Z'
        }
      ]

      const transactions: Transaction[] = [
        {
          id: '1',
          user_id: 'test-user',
          date: '2021-01-01',
          symbol: 'CUSTOM_EUR_ASSET',
          type: 'buy',
          quantity: 1,
          price_per_unit: 870.40, // Divided by 10 from original 8704.00
          currency: 'EUR',
          fees: 0,
          notes: 'Initial purchase',
          broker: null,
          created_at: '2021-01-01T00:00:00Z',
          updated_at: '2021-01-01T00:00:00Z',
          amount: null
        }
      ]

      // Calculate positions
      const mockUser: AuthUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2021-01-01T00:00:00Z',
        aud: 'authenticated',
        role: 'authenticated'
      }
      const positions = await service.calculateCurrentPositions(transactions, symbols, mockUser, 'EUR')
      const position = positions.find(p => p.symbol === 'CUSTOM_EUR_ASSET')

      expect(position).toBeDefined()

      if (position) {
        // Expected values based on the test data:
        // - Quantity: 1 (from the buy transaction)
        // - Average cost: €870.40 (from the buy transaction)
        // - Current price: €1024.885 (from the symbol's last_price)
        // - Current value: 1 × €1024.885 = €1024.885
        // - Cost basis: 1 × €870.40 = €870.40
        // - Unrealized P&L: €1024.885 - €870.40 = €154.485

        expect(position.quantity).toBe(1)
        expect(position.avgCost).toBe(870.40)
        expect(position.currentPrice).toBe(1024.885)
        expect(position.value).toBe(1024.885) // Should NOT be 741.059 (the bug value)
        expect(position.quantity * position.avgCost).toBe(870.40) // Cost basis should NOT be 741.059

        // This test should fail if the bug is present, showing where the 741.059 comes from
        expect(position.value).not.toBe(741.059) // Anonymized version of 7410.59
        expect(position.quantity * position.avgCost).not.toBe(741.059)
      }

      // Clean up mock
      jest.restoreAllMocks();
    })

    it('should handle currency conversion correctly', async () => {
      // Mock historical price service to return expected custom price
      jest.spyOn(historicalPriceService, 'getHistoricalPriceForDate').mockResolvedValue(1024.885);

      // Test if the issue might be related to currency conversion
      // The user is viewing in EUR, symbol is in EUR, so no conversion should occur

      const symbols: Symbol[] = [
        {
          symbol: 'CUSTOM_EUR_ASSET',
          name: 'Custom European Asset',
          asset_type: 'other',
          currency: 'EUR', // Same as viewing currency
          last_price: 1024.885,
          last_updated: '2025-08-29T00:00:00Z',
          is_custom: true,
          created_by_user_id: 'test-user',
          created_at: '2021-01-01T00:00:00Z'
        }
      ]

      const transactions: Transaction[] = [
        {
          id: '1',
          user_id: 'test-user',
          date: '2021-01-01',
          symbol: 'CUSTOM_EUR_ASSET',
          type: 'buy',
          quantity: 1,
          price_per_unit: 870.40,
          currency: 'EUR', // Same as viewing currency
          fees: 0,
          notes: 'Initial purchase',
          broker: null,
          created_at: '2021-01-01T00:00:00Z',
          updated_at: '2021-01-01T00:00:00Z',
          amount: null
        }
      ]

      const mockUser: AuthUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2021-01-01T00:00:00Z',
        aud: 'authenticated',
        role: 'authenticated'
      }
      const positions = await service.calculateCurrentPositions(transactions, symbols, mockUser, 'EUR')
      const position = positions.find(p => p.symbol === 'CUSTOM_EUR_ASSET')

      expect(position).toBeDefined()

      if (position) {
        // With no currency conversion needed, values should be exact
        expect(position.value).toBe(1024.885)
        expect(position.avgCost).toBe(870.40)

        // Check if somehow 741.059 could be a conversion result
        // 741.059 / 870.40 ≈ 0.8513 (potential EUR/USD rate?)
        // 741.059 / 1024.885 ≈ 0.7230 (potential conversion factor?)
        const potentialRate1 = 741.059 / 870.40 // ≈ 0.8513
        const potentialRate2 = 741.059 / 1024.885 // ≈ 0.7230

        console.log('Potential conversion rates:', {
          rate1: potentialRate1,
          rate2: potentialRate2,
          reversedFromCost: 870.40 * potentialRate1,
          reversedFromValue: 1024.885 * potentialRate2
        })

        // BUG IDENTIFIED: The portfolio service assumes all positions are in USD
        // and converts them to target currency. But this asset is already in EUR!
        // So it's incorrectly converting EUR -> EUR using USD as intermediary:
        // EUR value * (1/EURUSD_rate) ≈ EUR_value * 0.85 ≈ 741.059
      }

      // Clean up mock
      jest.restoreAllMocks();
    })

    it('should handle multiple transactions correctly', async () => {
      // Mock historical price service to return expected custom price
      jest.spyOn(historicalPriceService, 'getHistoricalPriceForDate').mockResolvedValue(1024.885);

      // Test edge case: multiple transactions that might cause averaging issues
      const symbols: Symbol[] = [
        {
          symbol: 'CUSTOM_EUR_ASSET',
          name: 'Custom European Asset',
          asset_type: 'other',
          currency: 'EUR',
          last_price: 1024.885,
          last_updated: '2025-08-29T00:00:00Z',
          is_custom: true,
          created_by_user_id: 'test-user',
          created_at: '2021-01-01T00:00:00Z'
        }
      ]

      // Test with transactions that could produce 741.059 if there's a calculation error
      const transactions: Transaction[] = [
        {
          id: '1',
          user_id: 'test-user',
          date: '2021-01-01',
          symbol: 'CUSTOM_EUR_ASSET',
          type: 'buy',
          quantity: 1,
          price_per_unit: 870.40,
          currency: 'EUR',
          fees: 0,
          notes: 'Initial purchase',
          broker: null,
          created_at: '2021-01-01T00:00:00Z',
          updated_at: '2021-01-01T00:00:00Z',
          amount: null
        },
        // Add a hypothetical transaction that might cause the issue
        {
          id: '2',
          user_id: 'test-user',
          date: '2022-01-01',
          symbol: 'CUSTOM_EUR_ASSET',
          type: 'sell',
          quantity: 0.15, // Partial sale that might mess up the calculation
          price_per_unit: 860.00,
          currency: 'EUR',
          fees: 0,
          notes: 'Partial sale',
          broker: null,
          created_at: '2022-01-01T00:00:00Z',
          updated_at: '2022-01-01T00:00:00Z',
          amount: null
        }
      ]

      const mockUser: AuthUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2021-01-01T00:00:00Z',
        aud: 'authenticated',
        role: 'authenticated'
      }
      const positions = await service.calculateCurrentPositions(transactions, symbols, mockUser, 'EUR')
      const position = positions.find(p => p.symbol === 'CUSTOM_EUR_ASSET')

      expect(position).toBeDefined()

      if (position) {
        // After selling 0.15, should have 0.85 quantity remaining
        expect(position.quantity).toBe(0.85)
        // Average cost should remain 870.40 (FIFO)
        expect(position.avgCost).toBe(870.40)
        // Current value: 0.85 × 1024.885 = 871.15225
        expect(position.value).toBeCloseTo(871.15, 2)

        // Check if this could somehow produce 741.059
        console.log('With partial sale - position:', {
          quantity: position.quantity,
          avgCost: position.avgCost,
          currentPrice: position.currentPrice,
          value: position.value,
          costBasis: position.quantity * position.avgCost
        })
      }
    })

    it('shoulduse current prices from user symbol prices for custom symbols (async version)', async () => {
      // Test the new async method that properly handles current prices
      const mockUser: AuthUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2021-01-01T00:00:00Z',
        aud: 'authenticated',
        role: 'authenticated'
      }

      const symbols: Symbol[] = [
        {
          symbol: 'CUSTOM_EUR_ASSET',
          name: 'Custom European Asset',
          asset_type: 'other',
          currency: 'EUR',
          last_price: 870.40, // Old/stale price (same as cost)
          last_updated: '2021-01-01T00:00:00Z',
          is_custom: true,
          created_by_user_id: 'test-user',
          created_at: '2021-01-01T00:00:00Z'
        }
      ]

      const transactions: Transaction[] = [
        {
          id: '1',
          user_id: 'test-user',
          date: '2021-01-01',
          symbol: 'CUSTOM_EUR_ASSET',
          type: 'buy',
          quantity: 1,
          price_per_unit: 870.40,
          currency: 'EUR',
          fees: 0,
          notes: 'Initial purchase',
          broker: null,
          created_at: '2021-01-01T00:00:00Z',
          updated_at: '2021-01-01T00:00:00Z',
          amount: null
        }
      ]

      // Mock the historical price service to return the current price
      const originalGetHistoricalPrice = historicalPriceService.getHistoricalPriceForDate
      historicalPriceService.getHistoricalPriceForDate = jest.fn().mockResolvedValue(1024.885)

      try {
        // Test the new async method with EUR target currency to match symbol currency
        const positions = await service.calculateCurrentPositions(
          transactions,
          symbols,
          mockUser,
          'EUR'
        )

        const position = positions.find(p => p.symbol === 'CUSTOM_EUR_ASSET')

        expect(position).toBeDefined()

        if (position) {
          // Should use the current price from user symbol prices (1024.885)
          // NOT the stale last_price from symbol (870.40)
          expect(position.currentPrice).toBe(1024.885)
          expect(position.value).toBe(1024.885) // 1 × 1024.885
          expect(position.avgCost).toBe(870.40)

          console.log('Async method test - position:', {
            symbol: position.symbol,
            currentPrice: position.currentPrice,
            value: position.value,
            avgCost: position.avgCost,
          })

          // Verify the historical price service was called
          expect(historicalPriceService.getHistoricalPriceForDate).toHaveBeenCalledWith(
            'CUSTOM_EUR_ASSET',
            expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), // Current date
            mockUser,
            symbols[0]
          )
        }
      } finally {
        // Restore original method
        historicalPriceService.getHistoricalPriceForDate = originalGetHistoricalPrice
      }

      // Clean up mock
      jest.restoreAllMocks();
    })

    it('shouldreproduce dividend handling discrepancy between position value and historical chart value', async () => {
      // BUG REPRODUCTION: Position value differs from chart value due to dividend handling
      // This test reproduces the scenario where position calculation and
      // historical data calculation produce different values for the same holding

      const mockUser: AuthUser = {
        id: 'test-user-dividend-bug',
        email: 'test@trackfolio.com',
        created_at: '2022-01-01T00:00:00Z',
        aud: 'authenticated',
        role: 'authenticated'
      }

      const symbols: Symbol[] = [
        {
          symbol: 'TEST_ETF',
          name: 'Test Global ETF',
          asset_type: 'etf',
          currency: 'USD',
          last_price: 85.00, // Current price
          last_updated: '2025-09-19T00:00:00Z',
          is_custom: false,
          created_by_user_id: null,
          created_at: '2022-01-01T00:00:00Z'
        }
      ]

      // Test transactions with dividend payments (1,000 shares total)
      const transactions: Transaction[] = [
        {
          id: 'etf-1',
          user_id: 'test-user-dividend-bug',
          date: '2022-01-18',
          symbol: 'TEST_ETF',
          type: 'buy',
          quantity: 500, // Half the total quantity
          price_per_unit: 70.00,
          currency: 'USD',
          fees: 1.00,
          notes: 'Initial purchase',
          broker: null,
          created_at: '2022-01-18T00:00:00Z',
          updated_at: '2022-01-18T00:00:00Z',
          amount: null
        },
        {
          id: 'etf-2',
          user_id: 'test-user-dividend-bug',
          date: '2023-06-15',
          symbol: 'TEST_ETF',
          type: 'buy',
          quantity: 500, // Other half
          price_per_unit: 90.00,
          currency: 'USD',
          fees: 1.00,
          notes: 'Second purchase',
          broker: null,
          created_at: '2023-06-15T00:00:00Z',
          updated_at: '2023-06-15T00:00:00Z',
          amount: null
        },
        {
          id: 'etf-dividend-1',
          user_id: 'test-user-dividend-bug',
          date: '2024-03-15',
          symbol: 'TEST_ETF',
          type: 'dividend',
          quantity: 0, // Cash dividend (no shares)
          price_per_unit: 0,
          currency: 'USD',
          fees: 0,
          notes: 'Annual dividend payment',
          broker: null,
          created_at: '2024-03-15T00:00:00Z',
          updated_at: '2024-03-15T00:00:00Z',
          amount: 5000.00
        },
        {
          id: 'etf-dividend-2',
          user_id: 'test-user-dividend-bug',
          date: '2025-03-15',
          symbol: 'TEST_ETF',
          type: 'dividend',
          quantity: 0, // Cash dividend (no shares)
          price_per_unit: 0,
          currency: 'USD',
          fees: 0,
          notes: 'Annual dividend payment',
          broker: null,
          created_at: '2025-03-15T00:00:00Z',
          updated_at: '2025-03-15T00:00:00Z',
          amount: 7500.00
        }
      ]

      // Mock the historical price service to return current price
      const originalGetHistoricalPrice = historicalPriceService.getHistoricalPriceForDate
      historicalPriceService.getHistoricalPriceForDate = jest.fn().mockResolvedValue(85.00)

      try {
        // Calculate position using portfolio calculation service (what feeds "Current Position" card)
        const positions = await service.calculateCurrentPositions(
          transactions,
          symbols,
          mockUser
        )

        const position = positions.find(p => p.symbol === 'TEST_ETF')
        expect(position).toBeDefined()

        if (position) {
          // AFTER FIX: Position value should NOT include dividends (tracked separately)
          const expectedShares = 1000
          const expectedCurrentPrice = 85.00
          const expectedSharesValue = expectedShares * expectedCurrentPrice // $85,000
          const expectedDividendIncome = 5000 + 7500 // $12,500 total dividends
          const expectedAvgCost = ((500 * 70.00) + (500 * 90.00)) / 1000 // $80.00 avg

          expect(position.quantity).toBe(expectedShares)
          expect(position.currentPrice).toBe(expectedCurrentPrice)
          expect(position.dividendIncome).toBe(expectedDividendIncome)
          expect(position.value).toBeCloseTo(expectedSharesValue, 2) // $85,000 (shares only)

          console.log('Portfolio calculation result (AFTER FIX):', {
            quantity: position.quantity,
            currentPrice: position.currentPrice,
            sharesValue: position.quantity * position.currentPrice,
            dividendIncome: position.dividendIncome,
            totalValue: position.value,
            avgCost: position.avgCost
          })

          // BUG FIX VERIFICATION:
          // Both position calculation and historical data should now match

          console.log('Fix verification:', {
            positionValue: position.value,
            dividendIncome: position.dividendIncome,
            totalValue: position.value + position.dividendIncome,
            expectedSharesValue: 85000,
            expectedDividendIncome: 12500,
            expectedTotalValue: 97500
          })

          // After fix: Current position shows shares value only, dividends tracked separately
          // Historical chart includes dividends in total value
          const totalValueWithDividends = position.value + position.dividendIncome
          expect(totalValueWithDividends).toBeCloseTo(97500, 0)
        }
      } finally {
        // Restore original method
        historicalPriceService.getHistoricalPriceForDate = originalGetHistoricalPrice
      }
    })
  })

  describe('Current Position vs Historical Data Price Consistency', () => {
    // These tests ensure that current position calculation and historical data calculation
    // use the same price sources to prevent value discrepancies

    it('shoulduse symbol.last_price for market symbols in current position calculation', async () => {
      const mockUser: AuthUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2022-01-01T00:00:00Z',
        aud: 'authenticated',
        role: 'authenticated'
      }

      const symbols: Symbol[] = [
        {
          symbol: 'VWCE.DE',
          name: 'Vanguard FTSE All-World ETF',
          asset_type: 'etf',
          currency: 'EUR',
          last_price: 139.04, // Current market price
          last_updated: '2025-09-19T00:00:00Z',
          is_custom: false,
          created_by_user_id: null,
          created_at: '2022-01-01T00:00:00Z'
        }
      ]

      const transactions: Transaction[] = [
        {
          id: 'vwce-1',
          user_id: 'test-user',
          date: '2022-01-18',
          symbol: 'VWCE.DE',
          type: 'buy',
          quantity: 1242,
          price_per_unit: 115.94,
          currency: 'EUR',
          fees: 1.00,
          notes: 'Initial purchase',
          broker: null,
          created_at: '2022-01-18T00:00:00Z',
          updated_at: '2022-01-18T00:00:00Z',
          amount: null
        }
      ]

      // Mock historical price service to return outdated price (simulating the bug scenario)
      const originalGetHistoricalPrice = historicalPriceService.getHistoricalPriceForDate
      historicalPriceService.getHistoricalPriceForDate = jest.fn().mockResolvedValue(121.54) // Outdated price

      try {
        const positions = await service.calculateCurrentPositions(
          transactions,
          symbols,
          mockUser,
          'EUR'
        )

        const position = positions.find(p => p.symbol === 'VWCE.DE')
        expect(position).toBeDefined()

        if (position) {
          // AFTER FIX: Should use symbol.last_price (139.04) for market symbols
          // NOT the outdated historical price (121.54)
          expect(position.currentPrice).toBe(139.04)
          expect(position.value).toBeCloseTo(1242 * 139.04, 2) // €172,691.68
          expect(position.avgCost).toBeCloseTo(115.94, 2)

          // This would fail before the fix (position.currentPrice would be 121.54)
          expect(position.currentPrice).not.toBe(121.54)
          expect(position.value).not.toBeCloseTo(1242 * 121.54, 2) // Should NOT be €150,952.68

          console.log('Market symbol test result:', {
            symbol: position.symbol,
            currentPrice: position.currentPrice,
            expectedPrice: 139.04,
            value: position.value,
            expectedValue: 1242 * 139.04,
            historicalPriceWouldGive: 1242 * 121.54
          })
        }
      } finally {
        historicalPriceService.getHistoricalPriceForDate = originalGetHistoricalPrice
      }
    })

    it('shoulduse historical price service for custom symbols in current position calculation', async () => {
      const mockUser: AuthUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2021-01-01T00:00:00Z',
        aud: 'authenticated',
        role: 'authenticated'
      }

      const symbols: Symbol[] = [
        {
          symbol: 'PERCO.BNP',
          name: 'Perco BNP',
          asset_type: 'stock',
          currency: 'EUR',
          last_price: 8704.00, // This is the original purchase price, NOT current price
          last_updated: '2025-09-20T10:12:30.4+00:00',
          is_custom: true,
          created_by_user_id: 'test-user',
          created_at: '2021-01-01T00:00:00Z'
        }
      ]

      const transactions: Transaction[] = [
        {
          id: 'perco-1',
          user_id: 'test-user',
          date: '2021-01-01',
          symbol: 'PERCO.BNP',
          type: 'buy',
          quantity: 1,
          price_per_unit: 8704.00,
          currency: 'EUR',
          fees: 0,
          notes: 'Initial purchase',
          broker: null,
          created_at: '2021-01-01T00:00:00Z',
          updated_at: '2021-01-01T00:00:00Z',
          amount: null
        }
      ]

      // Mock historical price service to return current manual price
      const originalGetHistoricalPrice = historicalPriceService.getHistoricalPriceForDate
      historicalPriceService.getHistoricalPriceForDate = jest.fn().mockResolvedValue(10248.85) // Current manual price

      try {
        const positions = await service.calculateCurrentPositions(
          transactions,
          symbols,
          mockUser,
          'EUR'
        )

        const position = positions.find(p => p.symbol === 'PERCO.BNP')
        expect(position).toBeDefined()

        if (position) {
          // AFTER FIX: Should use historical price service (10248.85) for custom symbols
          // NOT the symbol.last_price (8704.00)
          expect(position.currentPrice).toBe(10248.85)
          expect(position.value).toBeCloseTo(1 * 10248.85, 2) // €10,248.85
          expect(position.avgCost).toBe(8704.00)

          // This would fail before the fix (position.currentPrice would be 8704.00)
          expect(position.currentPrice).not.toBe(8704.00)
          expect(position.value).not.toBe(8704.00) // Should NOT equal cost basis

          // Verify historical price service was called for custom symbol
          expect(historicalPriceService.getHistoricalPriceForDate).toHaveBeenCalledWith(
            'PERCO.BNP',
            expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            mockUser,
            symbols[0]
          )

          console.log('Custom symbol test result:', {
            symbol: position.symbol,
            currentPrice: position.currentPrice,
            expectedPrice: 10248.85,
            value: position.value,
            costBasis: position.quantity * position.avgCost,
            symbolLastPrice: symbols[0].last_price,
            isCustom: position.isCustom
          })
        }
      } finally {
        historicalPriceService.getHistoricalPriceForDate = originalGetHistoricalPrice
      }
    })

    it('should handle mixed portfolio with both market and custom symbols correctly', async () => {
      const mockUser: AuthUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2021-01-01T00:00:00Z',
        aud: 'authenticated',
        role: 'authenticated'
      }

      const symbols: Symbol[] = [
        {
          symbol: 'VWCE.DE',
          name: 'Vanguard FTSE All-World ETF',
          asset_type: 'etf',
          currency: 'EUR',
          last_price: 139.04, // Current market price
          last_updated: '2025-09-19T00:00:00Z',
          is_custom: false,
          created_by_user_id: null,
          created_at: '2022-01-01T00:00:00Z'
        },
        {
          symbol: 'PERCO.BNP',
          name: 'Perco BNP',
          asset_type: 'stock',
          currency: 'EUR',
          last_price: 8704.00, // Original purchase price
          last_updated: '2025-09-20T10:12:30.4+00:00',
          is_custom: true,
          created_by_user_id: 'test-user',
          created_at: '2021-01-01T00:00:00Z'
        }
      ]

      const transactions: Transaction[] = [
        {
          id: 'vwce-1',
          user_id: 'test-user',
          date: '2022-01-18',
          symbol: 'VWCE.DE',
          type: 'buy',
          quantity: 1242,
          price_per_unit: 115.94,
          currency: 'EUR',
          fees: 1.00,
          notes: 'ETF purchase',
          broker: null,
          created_at: '2022-01-18T00:00:00Z',
          updated_at: '2022-01-18T00:00:00Z',
          amount: null
        },
        {
          id: 'perco-1',
          user_id: 'test-user',
          date: '2021-01-01',
          symbol: 'PERCO.BNP',
          type: 'buy',
          quantity: 1,
          price_per_unit: 8704.00,
          currency: 'EUR',
          fees: 0,
          notes: 'Custom asset purchase',
          broker: null,
          created_at: '2021-01-01T00:00:00Z',
          updated_at: '2021-01-01T00:00:00Z',
          amount: null
        }
      ]

      // Mock historical price service to return different prices based on symbol type
      const originalGetHistoricalPrice = historicalPriceService.getHistoricalPriceForDate
      historicalPriceService.getHistoricalPriceForDate = jest.fn().mockImplementation((symbol) => {
        if (symbol === 'VWCE.DE') {
          return Promise.resolve(121.54) // Outdated price for market symbol (should be ignored)
        } else if (symbol === 'PERCO.BNP') {
          return Promise.resolve(10248.85) // Current manual price for custom symbol (should be used)
        }
        return Promise.resolve(null)
      })

      try {
        const positions = await service.calculateCurrentPositions(
          transactions,
          symbols,
          mockUser,
          'EUR'
        )

        expect(positions).toHaveLength(2)

        // Market symbol should use symbol.last_price
        const vwcePosition = positions.find(p => p.symbol === 'VWCE.DE')
        expect(vwcePosition).toBeDefined()
        if (vwcePosition) {
          expect(vwcePosition.currentPrice).toBe(139.04) // From symbol.last_price
          expect(vwcePosition.value).toBeCloseTo(1242 * 139.04, 2)
          expect(vwcePosition.isCustom).toBe(false)
        }

        // Custom symbol should use historical price service
        const percoPosition = positions.find(p => p.symbol === 'PERCO.BNP')
        expect(percoPosition).toBeDefined()
        if (percoPosition) {
          expect(percoPosition.currentPrice).toBe(10248.85) // From historical price service
          expect(percoPosition.value).toBeCloseTo(1 * 10248.85, 2)
          expect(percoPosition.isCustom).toBe(true)
        }

        // Verify correct methods were called
        expect(historicalPriceService.getHistoricalPriceForDate).toHaveBeenCalledWith(
          'PERCO.BNP',
          expect.any(String),
          mockUser,
          expect.objectContaining({ is_custom: true })
        )

        console.log('Mixed portfolio test results:', {
          vwce: {
            currentPrice: vwcePosition?.currentPrice,
            value: vwcePosition?.value,
            isCustom: vwcePosition?.isCustom
          },
          perco: {
            currentPrice: percoPosition?.currentPrice,
            value: percoPosition?.value,
            isCustom: percoPosition?.isCustom
          }
        })
      } finally {
        historicalPriceService.getHistoricalPriceForDate = originalGetHistoricalPrice
      }
    })

    it('should handle fallback scenarios correctly', async () => {
      const mockUser: AuthUser = {
        id: 'test-user',
        email: 'test@example.com',
        created_at: '2021-01-01T00:00:00Z',
        aud: 'authenticated',
        role: 'authenticated'
      }

      const symbols: Symbol[] = [
        {
          symbol: 'NO_PRICE_MARKET',
          name: 'Market Symbol Without Price',
          asset_type: 'stock',
          currency: 'USD',
          last_price: 0, // No current price available
          last_updated: '2025-09-20T00:00:00Z',
          is_custom: false,
          created_by_user_id: null,
          created_at: '2022-01-01T00:00:00Z'
        },
        {
          symbol: 'NO_PRICE_CUSTOM',
          name: 'Custom Symbol Without Price',
          asset_type: 'other',
          currency: 'USD',
          last_price: 100.00, // Irrelevant for custom symbols
          last_updated: '2025-09-20T00:00:00Z',
          is_custom: true,
          created_by_user_id: 'test-user',
          created_at: '2021-01-01T00:00:00Z'
        }
      ]

      const transactions: Transaction[] = [
        {
          id: 'market-1',
          user_id: 'test-user',
          date: '2022-01-01',
          symbol: 'NO_PRICE_MARKET',
          type: 'buy',
          quantity: 10,
          price_per_unit: 50.00,
          currency: 'USD',
          fees: 0,
          notes: 'Market symbol without current price',
          broker: null,
          created_at: '2022-01-01T00:00:00Z',
          updated_at: '2022-01-01T00:00:00Z',
          amount: null
        },
        {
          id: 'custom-1',
          user_id: 'test-user',
          date: '2021-01-01',
          symbol: 'NO_PRICE_CUSTOM',
          type: 'buy',
          quantity: 5,
          price_per_unit: 200.00,
          currency: 'USD',
          fees: 0,
          notes: 'Custom symbol without manual price',
          broker: null,
          created_at: '2021-01-01T00:00:00Z',
          updated_at: '2021-01-01T00:00:00Z',
          amount: null
        }
      ]

      // Mock historical price service to return null (no historical data)
      const originalGetHistoricalPrice = historicalPriceService.getHistoricalPriceForDate
      historicalPriceService.getHistoricalPriceForDate = jest.fn().mockImplementation((symbol) => {
        if (symbol === 'NO_PRICE_MARKET') {
          return Promise.resolve(45.00) // Historical fallback for market symbol
        } else if (symbol === 'NO_PRICE_CUSTOM') {
          return Promise.resolve(null) // No manual price available for custom symbol
        }
        return Promise.resolve(null)
      })

      try {
        const positions = await service.calculateCurrentPositions(
          transactions,
          symbols,
          mockUser,
          'USD'
        )

        expect(positions).toHaveLength(2)

        // Market symbol should fall back to historical price when no last_price
        const marketPosition = positions.find(p => p.symbol === 'NO_PRICE_MARKET')
        expect(marketPosition).toBeDefined()
        if (marketPosition) {
          expect(marketPosition.currentPrice).toBe(45.00) // From historical fallback
          expect(marketPosition.value).toBe(10 * 45.00)
        }

        // Custom symbol should fall back to avg cost when no historical price
        const customPosition = positions.find(p => p.symbol === 'NO_PRICE_CUSTOM')
        expect(customPosition).toBeDefined()
        if (customPosition) {
          expect(customPosition.currentPrice).toBe(200.00) // From avgCost fallback
          expect(customPosition.value).toBe(5 * 200.00)
        }

        console.log('Fallback test results:', {
          market: {
            currentPrice: marketPosition?.currentPrice,
            fallbackUsed: 'historical',
            value: marketPosition?.value
          },
          custom: {
            currentPrice: customPosition?.currentPrice,
            fallbackUsed: 'avgCost',
            value: customPosition?.value
          }
        })
      } finally {
        historicalPriceService.getHistoricalPriceForDate = originalGetHistoricalPrice
      }
    })
  })

  describe('Return Percentage Consistency', () => {
    it('should have matching totalReturnPercentage and unrealizedPnlPercentage when no realized PnL or dividends', async () => {
      // This test verifies the bug fix for totalReturnPercentage calculation
      // When there are no realized gains or dividends, the total return %
      // should equal the unrealized PnL %

      const mockUser: AuthUser = {
        id: 'test-user-returns',
        email: 'test@example.com',
      }

      const symbols: Symbol[] = [
        {
          symbol: 'VWCE.DE',
          name: 'Vanguard FTSE All-World UCITS ETF',
          asset_type: 'stock',
          currency: 'EUR',
          last_price: 110.0,
          last_updated: '2025-10-11T00:00:00Z',
          is_custom: false,
          created_by_user_id: null,
          created_at: '2022-01-01T00:00:00Z'
        }
      ]

      // Transactions that result in a simple buy-and-hold scenario
      const transactions: Transaction[] = [
        {
          id: '1',
          user_id: mockUser.id,
          symbol: 'VWCE.DE',
          type: 'buy',
          date: '2022-01-18',
          quantity: 100,
          price_per_unit: 100.0,
          fees: 10.0,
          created_at: '2022-01-18T00:00:00Z'
        },
        {
          id: '2',
          user_id: mockUser.id,
          symbol: 'VWCE.DE',
          type: 'buy',
          date: '2023-06-15',
          quantity: 500,
          price_per_unit: 102.0,
          fees: 20.0,
          created_at: '2023-06-15T00:00:00Z'
        }
      ]

      // Mock historical prices
      const originalFetch = historicalPriceService.fetchHistoricalPrices
      historicalPriceService.fetchHistoricalPrices = async (symbol: string) => {
        const priceMap = new Map<string, number>()
        // Set consistent prices for the holding period
        priceMap.set('2022-01-18', 100.0)
        priceMap.set('2023-06-15', 102.0)
        priceMap.set('2025-10-11', 110.0)
        return priceMap
      }

      try {
        const historicalData = await service.calculateHistoricalData(
          mockUser,
          transactions,
          symbols,
          'EUR',
          { targetSymbol: 'VWCE.DE' }
        )

        const metrics = service.calculatePortfolioReturnMetrics(
          transactions,
          historicalData,
          symbols
        )

        console.log('Return metrics:', {
          totalPnL: metrics.totalPnL,
          realizedPnL: metrics.realizedPnL,
          unrealizedPnL: metrics.unrealizedPnL,
          dividends: metrics.dividends,
          costBasis: metrics.costBasis,
          totalValue: metrics.totalValue,
          totalReturnPercentage: metrics.totalReturnPercentage,
          unrealizedPnlPercentage: metrics.unrealizedPnlPercentage
        })

        // Verify no realized PnL or dividends
        expect(metrics.realizedPnL).toBe(0)
        expect(metrics.dividends).toBe(0)

        // When there are no realized gains or dividends:
        // - totalPnL should equal unrealizedPnL
        expect(metrics.totalPnL).toBeCloseTo(metrics.unrealizedPnL, 2)

        // - totalReturnPercentage should equal unrealizedPnlPercentage
        // This is the main assertion for the bug fix
        expect(metrics.totalReturnPercentage).toBeCloseTo(metrics.unrealizedPnlPercentage, 2)

        // Both percentages should be calculated as: gain / cost_basis * 100
        const expectedPercentage = (metrics.unrealizedPnL / metrics.costBasis) * 100
        expect(metrics.totalReturnPercentage).toBeCloseTo(expectedPercentage, 2)
        expect(metrics.unrealizedPnlPercentage).toBeCloseTo(expectedPercentage, 2)
      } finally {
        historicalPriceService.fetchHistoricalPrices = originalFetch
      }
    })
  })

  describe('Historical Data Dividend Filtering', () => {
    it('should only include dividends from target symbol when generating single holding historical data', async () => {
      // This test verifies that when calculating historical data for a single holding,
      // only dividends from that specific holding are included in cumulativeDividends,
      // not dividends from other holdings in the portfolio

      const mockUser: AuthUser = {
        id: 'test-user-dividend-filter',
        email: 'test@example.com',
      }

      const symbols: Symbol[] = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          asset_type: 'stock',
          currency: 'USD',
          last_price: 150.0,
          last_updated: '2025-10-11T00:00:00Z',
          is_custom: false,
          created_by_user_id: null,
          created_at: '2022-01-01T00:00:00Z'
        },
        {
          symbol: 'BINANCE_ACCOUNT',
          name: 'Binance Trading Account',
          asset_type: 'other',
          currency: 'USD',
          last_price: null,
          last_updated: null,
          is_custom: true,
          created_by_user_id: mockUser.id,
          holding_type: 'account',
          created_at: '2022-01-01T00:00:00Z'
        }
      ]

      // Transactions: AAPL has dividends, Binance account has none
      const transactions: Transaction[] = [
        // AAPL buy
        {
          id: '1',
          user_id: mockUser.id,
          symbol: 'AAPL',
          type: 'buy',
          date: '2022-01-01',
          quantity: 100,
          price_per_unit: 100.0,
          fees: 10.0,
          created_at: '2022-01-01T00:00:00Z'
        },
        // AAPL dividend
        {
          id: '2',
          user_id: mockUser.id,
          symbol: 'AAPL',
          type: 'dividend',
          date: '2022-06-01',
          quantity: 0,
          price_per_unit: 0,
          amount: 500.0, // $500 dividend from AAPL
          fees: 0,
          created_at: '2022-06-01T00:00:00Z'
        },
        // Binance account deposit
        {
          id: '3',
          user_id: mockUser.id,
          symbol: 'BINANCE_ACCOUNT',
          type: 'deposit',
          date: '2022-01-01',
          quantity: 0,
          price_per_unit: 0,
          amount: 5000.0,
          fees: 0,
          created_at: '2022-01-01T00:00:00Z'
        }
      ]

      // Mock historical prices
      const originalFetch = historicalPriceService.fetchHistoricalPrices
      historicalPriceService.fetchHistoricalPrices = async (symbol: string) => {
        const priceMap = new Map<string, number>()
        if (symbol === 'AAPL') {
          priceMap.set('2022-01-01', 100.0)
          priceMap.set('2022-06-01', 150.0)
          priceMap.set('2025-10-11', 150.0)
        } else if (symbol === 'BINANCE_ACCOUNT') {
          // Account balance remains at 5000 (no gains)
          priceMap.set('2022-01-01', 5000.0)
          priceMap.set('2022-06-01', 5000.0)
          priceMap.set('2025-10-11', 5000.0)
        }
        return priceMap
      }

      try {
        // Calculate historical data for Binance account only
        const binanceHistoricalData = await service.calculateHistoricalData(
          mockUser,
          transactions,
          symbols,
          'USD',
          { targetSymbol: 'BINANCE_ACCOUNT' }
        )

        // Find a data point after the AAPL dividend was paid (2022-06-01)
        const dataPointAfterDividend = binanceHistoricalData.find(
          point => point.date >= '2022-06-02'
        )

        expect(dataPointAfterDividend).toBeDefined()

        if (dataPointAfterDividend) {
          console.log('Binance account historical data point:', {
            date: dataPointAfterDividend.date,
            totalValue: dataPointAfterDividend.totalValue,
            costBasis: dataPointAfterDividend.costBasis,
            cumulativeDividends: dataPointAfterDividend.cumulativeDividends
          })

          // CRITICAL ASSERTION: Binance account should have ZERO cumulative dividends
          // even though the portfolio contains AAPL with $500 in dividends
          expect(dataPointAfterDividend.cumulativeDividends).toBe(0)

          // Additional checks
          expect(dataPointAfterDividend.totalValue).toBe(5000) // Account balance
          expect(dataPointAfterDividend.costBasis).toBe(5000) // Total deposits
        }

        // Also verify AAPL historical data includes its dividends
        const aaplHistoricalData = await service.calculateHistoricalData(
          mockUser,
          transactions,
          symbols,
          'USD',
          { targetSymbol: 'AAPL' }
        )

        const aaplDataPointAfterDividend = aaplHistoricalData.find(
          point => point.date >= '2022-06-02'
        )

        expect(aaplDataPointAfterDividend).toBeDefined()

        if (aaplDataPointAfterDividend) {
          console.log('AAPL historical data point:', {
            date: aaplDataPointAfterDividend.date,
            totalValue: aaplDataPointAfterDividend.totalValue,
            costBasis: aaplDataPointAfterDividend.costBasis,
            cumulativeDividends: aaplDataPointAfterDividend.cumulativeDividends
          })

          // AAPL should have $500 in cumulative dividends
          expect(aaplDataPointAfterDividend.cumulativeDividends).toBe(500)
        }
      } finally {
        historicalPriceService.fetchHistoricalPrices = originalFetch
      }
    })
  })

});