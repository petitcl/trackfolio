-- Wipe Portfolio Tracker schema (data, tables, indexes, types, triggers, functions)

-- Drop triggers
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
DROP TRIGGER IF EXISTS update_user_symbol_prices_updated_at ON user_symbol_prices;

-- Drop trigger function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop indexes
DROP INDEX IF EXISTS idx_transactions_user_id;
DROP INDEX IF EXISTS idx_transactions_user_symbol;
DROP INDEX IF EXISTS idx_transactions_date;
DROP INDEX IF EXISTS idx_portfolio_snapshots_user_date;
DROP INDEX IF EXISTS idx_symbols_is_custom;
DROP INDEX IF EXISTS idx_symbols_created_by;
DROP INDEX IF EXISTS idx_user_symbol_prices_user_symbol;
DROP INDEX IF EXISTS idx_user_symbol_prices_date;

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS portfolio_snapshots CASCADE;
DROP TABLE IF EXISTS user_symbol_prices CASCADE;
DROP TABLE IF EXISTS symbols CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS symbol_price_history CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS transaction_type;
DROP TYPE IF EXISTS asset_type;
