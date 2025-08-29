// Mock data for testing the application without Supabase connection
// This mirrors the data structure from our sample-data.sql

import type { Transaction, Symbol, PortfolioSnapshot, AssetType, TransactionType } from './supabase/database.types'

export const mockUser = {
  id: 'test-user-uuid',
  email: 'test@trackfolio.com',
  created_at: '2024-01-01T00:00:00Z',
  aud: 'authenticated',
  role: 'authenticated'
}

export const mockSymbols: Symbol[] = [
  // Public symbols
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    asset_type: 'stock' as AssetType,
    last_price: 185.50,
    last_updated: new Date().toISOString(),
    is_custom: false,
    created_by_user_id: null,
    created_at: new Date().toISOString()
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    asset_type: 'stock' as AssetType,
    last_price: 420.30,
    last_updated: new Date().toISOString(),
    is_custom: false,
    created_by_user_id: null,
    created_at: new Date().toISOString()
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    asset_type: 'stock' as AssetType,
    last_price: 142.80,
    last_updated: new Date().toISOString(),
    is_custom: false,
    created_by_user_id: null,
    created_at: new Date().toISOString()
  },
  {
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    asset_type: 'stock' as AssetType,
    last_price: 248.90,
    last_updated: new Date().toISOString(),
    is_custom: false,
    created_by_user_id: null,
    created_at: new Date().toISOString()
  },
  {
    symbol: 'VTI',
    name: 'Vanguard Total Stock Market ETF',
    asset_type: 'etf' as AssetType,
    last_price: 245.60,
    last_updated: new Date().toISOString(),
    is_custom: false,
    created_by_user_id: null,
    created_at: new Date().toISOString()
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    asset_type: 'crypto' as AssetType,
    last_price: 43500.00,
    last_updated: new Date().toISOString(),
    is_custom: false,
    created_by_user_id: null,
    created_at: new Date().toISOString()
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    asset_type: 'crypto' as AssetType,
    last_price: 2650.00,
    last_updated: new Date().toISOString(),
    is_custom: false,
    created_by_user_id: null,
    created_at: new Date().toISOString()
  },
  // Custom investments
  {
    symbol: 'MY_HOUSE',
    name: 'Primary Residence',
    asset_type: 'real_estate' as AssetType,
    last_price: 450000.00,
    last_updated: new Date().toISOString(),
    is_custom: true,
    created_by_user_id: 'test-user-uuid',
    created_at: new Date().toISOString()
  },
  {
    symbol: 'VINTAGE_WATCH',
    name: 'Rolex Submariner Collection',
    asset_type: 'other' as AssetType,
    last_price: 12500.00,
    last_updated: new Date().toISOString(),
    is_custom: true,
    created_by_user_id: 'test-user-uuid',
    created_at: new Date().toISOString()
  },
  {
    symbol: 'STARTUP_XYZ',
    name: 'Private Company XYZ Shares',
    asset_type: 'other' as AssetType,
    last_price: 50.00,
    last_updated: new Date().toISOString(),
    is_custom: true,
    created_by_user_id: 'test-user-uuid',
    created_at: new Date().toISOString()
  },
  {
    symbol: 'CASH',
    name: 'Cash USD',
    asset_type: 'cash' as AssetType,
    last_price: 1.00,
    last_updated: new Date().toISOString(),
    is_custom: false,
    created_by_user_id: null,
    created_at: new Date().toISOString()
  }
]

export const mockTransactions: Transaction[] = [
  // Initial funding
  {
    id: '1',
    user_id: 'test-user-uuid',
    date: '2024-03-01',
    symbol: 'CASH',
    type: 'deposit' as TransactionType,
    quantity: 10000.00,
    price_per_unit: 1.00,
    currency: 'USD',
    fees: 0,
    notes: 'Initial portfolio funding',
    broker: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  // Stock purchases
  {
    id: '2',
    user_id: 'test-user-uuid',
    date: '2024-03-05',
    symbol: 'AAPL',
    type: 'buy' as TransactionType,
    quantity: 50.00,
    price_per_unit: 175.20,
    currency: 'USD',
    fees: 4.99,
    notes: 'First Apple purchase',
    broker: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '3',
    user_id: 'test-user-uuid',
    date: '2024-03-10',
    symbol: 'MSFT',
    type: 'buy' as TransactionType,
    quantity: 25.00,
    price_per_unit: 395.80,
    currency: 'USD',
    fees: 4.99,
    notes: 'Microsoft position',
    broker: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '4',
    user_id: 'test-user-uuid',
    date: '2024-05-20',
    symbol: 'AAPL',
    type: 'buy' as TransactionType,
    quantity: 30.00,
    price_per_unit: 182.40,
    currency: 'USD',
    fees: 4.99,
    notes: 'Adding to Apple position',
    broker: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  // Crypto purchases
  {
    id: '5',
    user_id: 'test-user-uuid',
    date: '2024-07-10',
    symbol: 'BTC',
    type: 'buy' as TransactionType,
    quantity: 0.15000000,
    price_per_unit: 58000.00,
    currency: 'USD',
    fees: 25.00,
    notes: 'Bitcoin allocation',
    broker: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  // Custom investments
  {
    id: '6',
    user_id: 'test-user-uuid',
    date: '2024-01-15',
    symbol: 'MY_HOUSE',
    type: 'buy' as TransactionType,
    quantity: 1.00,
    price_per_unit: 420000.00,
    currency: 'USD',
    fees: 25000.00,
    notes: 'House purchase - down payment and fees',
    broker: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '7',
    user_id: 'test-user-uuid',
    date: '2024-06-10',
    symbol: 'VINTAGE_WATCH',
    type: 'buy' as TransactionType,
    quantity: 1.00,
    price_per_unit: 11800.00,
    currency: 'USD',
    fees: 200.00,
    notes: 'Rolex Submariner - investment piece',
    broker: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  // Selling activity
  {
    id: '8',
    user_id: 'test-user-uuid',
    date: '2024-08-05',
    symbol: 'AAPL',
    type: 'sell' as TransactionType,
    quantity: 10.00,
    price_per_unit: 180.50,
    currency: 'USD',
    fees: 4.99,
    notes: 'Partial AAPL sale for rebalancing',
    broker: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  // Dividends
  {
    id: '9',
    user_id: 'test-user-uuid',
    date: '2024-08-15',
    symbol: 'AAPL',
    type: 'dividend' as TransactionType,
    quantity: 70.00,
    price_per_unit: 0.25,
    currency: 'USD',
    fees: 0,
    notes: 'Q3 2024 dividend (adjusted for 70 shares)',
    broker: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '10',
    user_id: 'test-user-uuid',
    date: '2024-08-30',
    symbol: 'MSFT',
    type: 'dividend' as TransactionType,
    quantity: 25.00,
    price_per_unit: 0.83,
    currency: 'USD',
    fees: 0,
    notes: 'Q3 2024 dividend',
    broker: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  // Bonus shares
  {
    id: '11',
    user_id: 'test-user-uuid',
    date: '2024-09-15',
    symbol: 'MSFT',
    type: 'bonus' as TransactionType,
    quantity: 2.00,
    price_per_unit: 0.00,
    currency: 'USD',
    fees: 0,
    notes: 'Bonus shares from broker promotion',
    broker: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  // Additional cash transactions
  {
    id: '12',
    user_id: 'test-user-uuid',
    date: '2024-11-01',
    symbol: 'CASH',
    type: 'deposit' as TransactionType,
    quantity: 2000.00,
    price_per_unit: 1.00,
    currency: 'USD',
    fees: 0,
    notes: 'Additional funding for portfolio',
    broker: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '13',
    user_id: 'test-user-uuid',
    date: '2024-11-15',
    symbol: 'CASH',
    type: 'withdrawal' as TransactionType,
    quantity: 1000.00,
    price_per_unit: 1.00,
    currency: 'USD',
    fees: 0,
    notes: 'Holiday expenses withdrawal',
    broker: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  // More recent activities
  {
    id: '14',
    user_id: 'test-user-uuid',
    date: '2024-12-01',
    symbol: 'BTC',
    type: 'buy' as TransactionType,
    quantity: 0.05000000,
    price_per_unit: 42000.00,
    currency: 'USD',
    fees: 15.00,
    notes: 'Bitcoin DCA purchase',
    broker: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '15',
    user_id: 'test-user-uuid',
    date: '2024-12-15',
    symbol: 'AAPL',
    type: 'dividend' as TransactionType,
    quantity: 70.00,
    price_per_unit: 0.25,
    currency: 'USD',
    fees: 0,
    notes: 'Q4 2024 dividend',
    broker: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

// Calculated portfolio data
export const mockPortfolioData = {
  totalValue: 548950.25,
  cashBalance: 2895.25, // Adjusted for additional deposit/withdrawal/dividend transactions
  positions: [
    {
      symbol: 'AAPL',
      quantity: 70, // 50 + 30 - 10 (bought 50, bought 30, sold 10)
      avgCost: 177.89, // Recalculated weighted average after sell
      currentPrice: 185.50,
      value: 12985.00,
      unrealizedPnL: 533.00,
      isCustom: false
    },
    {
      symbol: 'MSFT',
      quantity: 27, // 25 + 2 bonus shares
      avgCost: 366.56, // Cost basis remains the same, bonus shares at $0
      currentPrice: 420.30,
      value: 11348.10,
      unrealizedPnL: 1448.88,
      isCustom: false
    },
    {
      symbol: 'BTC',
      quantity: 0.20, // 0.15 + 0.05 from additional purchase
      avgCost: 54000.00, // Weighted average: (0.15*58000 + 0.05*42000)/0.20
      currentPrice: 43500.00,
      value: 8700.00,
      unrealizedPnL: -2100.00,
      isCustom: false
    },
    {
      symbol: 'MY_HOUSE',
      quantity: 1,
      avgCost: 445000.00,
      currentPrice: 465000.00,
      value: 465000.00,
      unrealizedPnL: 20000.00,
      isCustom: true
    },
    {
      symbol: 'VINTAGE_WATCH',
      quantity: 1,
      avgCost: 12000.00,
      currentPrice: 13200.00,
      value: 13200.00,
      unrealizedPnL: 1200.00,
      isCustom: true
    }
  ],
  dailyChange: {
    value: 2840.50,
    percentage: 0.52
  },
  totalPnL: {
    realized: 25.01, // Realized from AAPL sell (10 * (180.50 - 177.89) - 4.99)
    unrealized: 21281.88, // Updated unrealized P&L
    total: 21306.89
  }
}

// Historical data for charts
export interface HistoricalDataPoint {
  date: string
  totalValue: number
  assetTypeAllocations: Record<string, number> // percentage allocation by asset type
  assetTypeReturns: Record<string, number> // returns by asset type
}

export const generateMockHistoricalData = (): HistoricalDataPoint[] => {
  const data: HistoricalDataPoint[] = []
  const startDate = new Date('2024-01-01')
  const endDate = new Date()
  
  // Base values for realistic progression
  let currentValue = 500000
  const assetTypes = ['stock', 'etf', 'crypto', 'real_estate', 'other']
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    // Create some realistic market volatility
    const dailyChange = (Math.random() - 0.5) * 0.02 // ±1% daily volatility
    currentValue *= (1 + dailyChange)
    
    // Generate asset type allocations (should add up to ~100%)
    const allocations: Record<string, number> = {
      stock: 25 + Math.random() * 10, // 25-35%
      etf: 15 + Math.random() * 5,   // 15-20%
      crypto: 5 + Math.random() * 10, // 5-15%
      real_estate: 45 + Math.random() * 10, // 45-55%
      other: 8 + Math.random() * 5    // 8-13%
    }
    
    // Normalize to 100%
    const total = Object.values(allocations).reduce((sum, val) => sum + val, 0)
    Object.keys(allocations).forEach(key => {
      allocations[key] = (allocations[key] / total) * 100
    })
    
    // Generate returns (cumulative from start)
    const daysSinceStart = Math.floor((d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const returns: Record<string, number> = {
      stock: (Math.sin(daysSinceStart / 50) * 0.15 + 0.08) * (daysSinceStart / 365), // ~8% annual + volatility
      etf: (Math.sin(daysSinceStart / 40) * 0.10 + 0.06) * (daysSinceStart / 365), // ~6% annual + volatility
      crypto: (Math.sin(daysSinceStart / 20) * 0.50 + 0.20) * (daysSinceStart / 365), // Very volatile
      real_estate: 0.05 * (daysSinceStart / 365), // Steady 5% annual
      other: (Math.sin(daysSinceStart / 60) * 0.12 + 0.10) * (daysSinceStart / 365) // ~10% annual + volatility
    }
    
    data.push({
      date: d.toISOString().split('T')[0],
      totalValue: currentValue,
      assetTypeAllocations: allocations,
      assetTypeReturns: returns
    })
  }
  
  return data
}

export const mockHistoricalData = generateMockHistoricalData()