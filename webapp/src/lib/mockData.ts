// Mock data for testing the application without Supabase connection
// This mirrors the data structure from our sample-data.sql

import type { Transaction, Symbol, AssetType, TransactionType } from './supabase/types'
import { MOCK_USER_ID, MOCK_USER_EMAIL } from './constants/mockConstants'

export const mockUser = {
  id: MOCK_USER_ID,
  email: MOCK_USER_EMAIL,
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
    currency: 'USD',
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
    currency: 'USD',
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
    currency: 'USD',
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
    currency: 'USD',
    last_price: 248.90,
    last_updated: new Date().toISOString(),
    is_custom: false,
    created_by_user_id: null,
    created_at: new Date().toISOString()
  },
  {
    symbol: 'VTI',
    name: 'Vanguard Total Stock Market ETF',
    asset_type: 'stock' as AssetType,
    currency: 'USD',
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
    currency: 'USD',
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
    currency: 'USD',
    last_price: 2650.00,
    last_updated: new Date().toISOString(),
    is_custom: false,
    created_by_user_id: null,
    created_at: new Date().toISOString()
  },
  // Currency pairs for FX tracking
  {
    symbol: 'EURUSD',
    name: 'Euro to US Dollar',
    asset_type: 'currency' as AssetType,
    currency: 'USD',
    last_price: 1.0856,
    last_updated: new Date().toISOString(),
    is_custom: false,
    created_by_user_id: null,
    created_at: new Date().toISOString()
  },
  {
    symbol: 'GBPUSD',
    name: 'British Pound to US Dollar',
    asset_type: 'currency' as AssetType,
    currency: 'USD',
    last_price: 1.2845,
    last_updated: new Date().toISOString(),
    is_custom: false,
    created_by_user_id: null,
    created_at: new Date().toISOString()
  },
  {
    symbol: 'USDJPY',
    name: 'US Dollar to Japanese Yen',
    asset_type: 'currency' as AssetType,
    currency: 'JPY',
    last_price: 149.85,
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
    currency: 'USD',
    last_price: 120000.00,
    last_updated: new Date().toISOString(),
    is_custom: true,
    created_by_user_id: MOCK_USER_ID,
    created_at: new Date().toISOString()
  },
  {
    symbol: 'VINTAGE_WATCH',
    name: 'Rolex Submariner Collection',
    asset_type: 'other' as AssetType,
    currency: 'USD',
    last_price: 12500.00,
    last_updated: new Date().toISOString(),
    is_custom: true,
    created_by_user_id: MOCK_USER_ID,
    created_at: new Date().toISOString()
  },
  {
    symbol: 'STARTUP_XYZ',
    name: 'Private Company XYZ Shares',
    asset_type: 'other' as AssetType,
    currency: 'USD',
    last_price: 50.00,
    last_updated: new Date().toISOString(),
    is_custom: true,
    created_by_user_id: MOCK_USER_ID,
    created_at: new Date().toISOString()
  },
  {
    symbol: 'USD_CASH',
    name: 'USD Cash Account',
    asset_type: 'cash' as AssetType,
    currency: 'USD',
    last_price: 1.00,
    last_updated: new Date().toISOString(),
    is_custom: true,
    created_by_user_id: MOCK_USER_ID,
    created_at: new Date().toISOString()
  }
]

export const mockTransactions: Transaction[] = [
  // Initial funding
  {
    id: '1',
    user_id: MOCK_USER_ID,
    date: '2024-03-01',
    symbol: 'USD_CASH',
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
    user_id: MOCK_USER_ID,
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
    user_id: MOCK_USER_ID,
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
    user_id: MOCK_USER_ID,
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
    user_id: MOCK_USER_ID,
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
    user_id: MOCK_USER_ID,
    date: '2024-01-15',
    symbol: 'MY_HOUSE',
    type: 'buy' as TransactionType,
    quantity: 1.00,
    price_per_unit: 110000.00,
    currency: 'USD',
    fees: 25000.00,
    notes: 'House purchase - down payment and fees',
    broker: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '7',
    user_id: MOCK_USER_ID,
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
    user_id: MOCK_USER_ID,
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
    user_id: MOCK_USER_ID,
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
    user_id: MOCK_USER_ID,
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
    user_id: MOCK_USER_ID,
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
    user_id: MOCK_USER_ID,
    date: '2024-11-01',
    symbol: 'USD_CASH',
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
    user_id: MOCK_USER_ID,
    date: '2024-11-15',
    symbol: 'USD_CASH',
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
    user_id: MOCK_USER_ID,
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
    user_id: MOCK_USER_ID,
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

// Historical data for charts
export interface HistoricalDataPoint {
  date: string
  totalValue: number
  // percentage allocation by asset type
  assetTypeAllocations: Record<string, number>
  // absolute dollar values by asset type
  assetTypeValues: Record<string, number>
  // cumulative invested amount (optional for backward compatibility)
  costBasis?: number
}

// Mock symbol price history data that mirrors the supabase symbol_price_history table
export interface MockSymbolPriceHistory {
  symbol: string
  date: string
  close_price: number
  data_source: string
}

export const mockSymbolPriceHistory: MockSymbolPriceHistory[] = [
  // AAPL price data covering the transaction period (March to December 2024)
  { symbol: 'AAPL', date: '2024-01-01', close_price: 185.64, data_source: 'manual' },
  { symbol: 'AAPL', date: '2024-02-01', close_price: 175.20, data_source: 'manual' },
  { symbol: 'AAPL', date: '2024-03-01', close_price: 175.20, data_source: 'manual' },
  { symbol: 'AAPL', date: '2024-03-05', close_price: 175.20, data_source: 'manual' },
  { symbol: 'AAPL', date: '2024-04-01', close_price: 178.50, data_source: 'manual' },
  { symbol: 'AAPL', date: '2024-05-01', close_price: 182.40, data_source: 'manual' },
  { symbol: 'AAPL', date: '2024-05-20', close_price: 182.40, data_source: 'manual' },
  { symbol: 'AAPL', date: '2024-06-01', close_price: 185.20, data_source: 'manual' },
  { symbol: 'AAPL', date: '2024-07-01', close_price: 183.75, data_source: 'manual' },
  { symbol: 'AAPL', date: '2024-08-01', close_price: 180.50, data_source: 'manual' },
  { symbol: 'AAPL', date: '2024-08-05', close_price: 180.50, data_source: 'manual' },
  { symbol: 'AAPL', date: '2024-08-15', close_price: 180.50, data_source: 'manual' },
  { symbol: 'AAPL', date: '2024-09-01', close_price: 181.90, data_source: 'manual' },
  { symbol: 'AAPL', date: '2024-10-01', close_price: 184.30, data_source: 'manual' },
  { symbol: 'AAPL', date: '2024-11-01', close_price: 180.90, data_source: 'manual' },
  { symbol: 'AAPL', date: '2024-12-01', close_price: 185.50, data_source: 'manual' },
  { symbol: 'AAPL', date: '2024-12-15', close_price: 185.50, data_source: 'manual' },
  { symbol: 'AAPL', date: '2024-12-20', close_price: 185.50, data_source: 'manual' },

  // MSFT price data
  { symbol: 'MSFT', date: '2024-01-01', close_price: 415.20, data_source: 'manual' },
  { symbol: 'MSFT', date: '2024-03-01', close_price: 395.80, data_source: 'manual' },
  { symbol: 'MSFT', date: '2024-03-10', close_price: 395.80, data_source: 'manual' },
  { symbol: 'MSFT', date: '2024-04-01', close_price: 405.60, data_source: 'manual' },
  { symbol: 'MSFT', date: '2024-05-01', close_price: 410.25, data_source: 'manual' },
  { symbol: 'MSFT', date: '2024-06-01', close_price: 415.80, data_source: 'manual' },
  { symbol: 'MSFT', date: '2024-07-01', close_price: 418.90, data_source: 'manual' },
  { symbol: 'MSFT', date: '2024-08-01', close_price: 420.30, data_source: 'manual' },
  { symbol: 'MSFT', date: '2024-08-30', close_price: 420.30, data_source: 'manual' },
  { symbol: 'MSFT', date: '2024-09-01', close_price: 422.50, data_source: 'manual' },
  { symbol: 'MSFT', date: '2024-10-01', close_price: 418.75, data_source: 'manual' },
  { symbol: 'MSFT', date: '2024-11-01', close_price: 420.30, data_source: 'manual' },
  { symbol: 'MSFT', date: '2024-12-01', close_price: 420.30, data_source: 'manual' },

  // VTI price data  
  { symbol: 'VTI', date: '2024-01-01', close_price: 230.40, data_source: 'manual' },
  { symbol: 'VTI', date: '2024-03-01', close_price: 235.40, data_source: 'manual' },
  { symbol: 'VTI', date: '2024-03-15', close_price: 235.40, data_source: 'manual' },
  { symbol: 'VTI', date: '2024-04-01', close_price: 238.60, data_source: 'manual' },
  { symbol: 'VTI', date: '2024-05-01', close_price: 240.85, data_source: 'manual' },
  { symbol: 'VTI', date: '2024-06-01', close_price: 242.30, data_source: 'manual' },
  { symbol: 'VTI', date: '2024-07-01', close_price: 243.75, data_source: 'manual' },
  { symbol: 'VTI', date: '2024-08-01', close_price: 241.20, data_source: 'manual' },
  { symbol: 'VTI', date: '2024-08-20', close_price: 241.20, data_source: 'manual' },
  { symbol: 'VTI', date: '2024-09-01', close_price: 244.80, data_source: 'manual' },
  { symbol: 'VTI', date: '2024-09-15', close_price: 244.80, data_source: 'manual' },
  { symbol: 'VTI', date: '2024-10-01', close_price: 246.20, data_source: 'manual' },
  { symbol: 'VTI', date: '2024-11-01', close_price: 245.60, data_source: 'manual' },
  { symbol: 'VTI', date: '2024-12-01', close_price: 245.60, data_source: 'manual' },

  // GOOGL price data
  { symbol: 'GOOGL', date: '2024-01-01', close_price: 140.20, data_source: 'manual' },
  { symbol: 'GOOGL', date: '2024-04-01', close_price: 138.50, data_source: 'manual' },
  { symbol: 'GOOGL', date: '2024-04-12', close_price: 138.50, data_source: 'manual' },
  { symbol: 'GOOGL', date: '2024-05-01', close_price: 141.20, data_source: 'manual' },
  { symbol: 'GOOGL', date: '2024-06-01', close_price: 142.80, data_source: 'manual' },
  { symbol: 'GOOGL', date: '2024-07-01', close_price: 145.30, data_source: 'manual' },
  { symbol: 'GOOGL', date: '2024-08-01', close_price: 143.75, data_source: 'manual' },
  { symbol: 'GOOGL', date: '2024-09-01', close_price: 142.80, data_source: 'manual' },
  { symbol: 'GOOGL', date: '2024-10-01', close_price: 144.90, data_source: 'manual' },
  { symbol: 'GOOGL', date: '2024-11-01', close_price: 142.80, data_source: 'manual' },
  { symbol: 'GOOGL', date: '2024-12-01', close_price: 142.80, data_source: 'manual' },

  // TSLA price data
  { symbol: 'TSLA', date: '2024-01-01', close_price: 220.50, data_source: 'manual' },
  { symbol: 'TSLA', date: '2024-06-01', close_price: 195.30, data_source: 'manual' },
  { symbol: 'TSLA', date: '2024-06-15', close_price: 195.30, data_source: 'manual' },
  { symbol: 'TSLA', date: '2024-07-01', close_price: 210.80, data_source: 'manual' },
  { symbol: 'TSLA', date: '2024-08-01', close_price: 225.80, data_source: 'manual' },
  { symbol: 'TSLA', date: '2024-08-05', close_price: 225.80, data_source: 'manual' },
  { symbol: 'TSLA', date: '2024-09-01', close_price: 235.60, data_source: 'manual' },
  { symbol: 'TSLA', date: '2024-10-01', close_price: 248.90, data_source: 'manual' },
  { symbol: 'TSLA', date: '2024-11-01', close_price: 248.90, data_source: 'manual' },
  { symbol: 'TSLA', date: '2024-12-01', close_price: 248.90, data_source: 'manual' },

  // BTC price data (crypto)
  { symbol: 'BTC', date: '2024-01-01', close_price: 42000.00, data_source: 'manual' },
  { symbol: 'BTC', date: '2024-07-01', close_price: 58000.00, data_source: 'manual' },
  { symbol: 'BTC', date: '2024-07-10', close_price: 58000.00, data_source: 'manual' },
  { symbol: 'BTC', date: '2024-08-01', close_price: 55000.00, data_source: 'manual' },
  { symbol: 'BTC', date: '2024-09-01', close_price: 52000.00, data_source: 'manual' },
  { symbol: 'BTC', date: '2024-10-01', close_price: 48000.00, data_source: 'manual' },
  { symbol: 'BTC', date: '2024-11-01', close_price: 42000.00, data_source: 'manual' },
  { symbol: 'BTC', date: '2024-11-15', close_price: 42000.00, data_source: 'manual' },
  { symbol: 'BTC', date: '2024-12-01', close_price: 43500.00, data_source: 'manual' },

  // ETH price data (crypto)
  { symbol: 'ETH', date: '2024-01-01', close_price: 2800.00, data_source: 'manual' },
  { symbol: 'ETH', date: '2024-07-01', close_price: 3200.00, data_source: 'manual' },
  { symbol: 'ETH', date: '2024-07-12', close_price: 3200.00, data_source: 'manual' },
  { symbol: 'ETH', date: '2024-08-01', close_price: 3100.00, data_source: 'manual' },
  { symbol: 'ETH', date: '2024-09-01', close_price: 2950.00, data_source: 'manual' },
  { symbol: 'ETH', date: '2024-10-01', close_price: 2750.00, data_source: 'manual' },
  { symbol: 'ETH', date: '2024-11-01', close_price: 2600.00, data_source: 'manual' },
  { symbol: 'ETH', date: '2024-12-01', close_price: 2800.00, data_source: 'manual' },

  // CASH always has price 1.00
  { symbol: 'USD_CASH', date: '2024-01-01', close_price: 1.00, data_source: 'manual' },
  { symbol: 'USD_CASH', date: '2024-03-01', close_price: 1.00, data_source: 'manual' },
  { symbol: 'USD_CASH', date: '2024-06-01', close_price: 1.00, data_source: 'manual' },
  { symbol: 'USD_CASH', date: '2024-09-01', close_price: 1.00, data_source: 'manual' },
  { symbol: 'USD_CASH', date: '2024-12-01', close_price: 1.00, data_source: 'manual' },
  { symbol: 'USD_CASH', date: '2024-12-20', close_price: 1.00, data_source: 'manual' },
  { symbol: 'USD_CASH', date: '2024-12-22', close_price: 1.00, data_source: 'manual' }
]