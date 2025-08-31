// Helper types for the application
// This file provides convenient type aliases that reference the generated database types
// It's separate from database.types.ts so it won't be overwritten when regenerating types

import type { Database, Tables } from './database.types'

// Table types
export type Transaction = Tables<'transactions'>
export type Symbol = Tables<'symbols'>
export type UserSymbolPrice = Tables<'user_symbol_prices'>
export type SymbolPriceHistory = Tables<'symbol_price_history'>

// Enum types
export type TransactionType = Database['public']['Enums']['transaction_type']
export type AssetType = Database['public']['Enums']['asset_type']

// Re-export the Database type for convenience
export type { Database } from './database.types'