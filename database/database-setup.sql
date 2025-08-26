-- Portfolio Tracker Database Schema
-- Run this in Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE transaction_type AS ENUM ('buy', 'sell', 'dividend', 'bonus', 'deposit', 'withdrawal');
CREATE TYPE asset_type AS ENUM ('stock', 'etf', 'crypto', 'cash', 'real_estate', 'other');

-- Transactions table
CREATE TABLE transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    symbol TEXT NOT NULL,
    type transaction_type NOT NULL,
    quantity DECIMAL(20,8) NOT NULL,
    price_per_unit DECIMAL(20,8) NOT NULL,
    currency TEXT DEFAULT 'USD' NOT NULL,
    fees DECIMAL(20,8) DEFAULT 0,
    notes TEXT,
    broker TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Symbols cache (public symbols + user custom investments)
CREATE TABLE symbols (
    symbol TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    asset_type asset_type DEFAULT 'stock' NOT NULL,
    last_price DECIMAL(20,8),
    last_updated TIMESTAMPTZ,
    is_custom BOOLEAN DEFAULT FALSE NOT NULL,
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure custom symbols have a creator
    CONSTRAINT custom_symbol_has_creator 
        CHECK ((is_custom = TRUE AND created_by_user_id IS NOT NULL) OR 
               (is_custom = FALSE AND created_by_user_id IS NULL))
);

-- User-specific manual price overrides for any symbol
CREATE TABLE user_symbol_prices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    symbol TEXT NOT NULL,
    manual_price DECIMAL(20,8) NOT NULL,
    price_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- One manual price per user per symbol per date
    UNIQUE(user_id, symbol, price_date),
    
    -- Foreign key to symbols table
    FOREIGN KEY (symbol) REFERENCES symbols(symbol) ON DELETE CASCADE
);

-- Portfolio snapshots for historical tracking
CREATE TABLE portfolio_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    snapshot_date DATE NOT NULL,
    total_value DECIMAL(20,8) NOT NULL,
    cash_balance DECIMAL(20,8) DEFAULT 0 NOT NULL,
    positions JSONB, -- Store position details as JSON
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, snapshot_date)
);

-- Create indexes for better performance
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_user_symbol ON transactions(user_id, symbol);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_portfolio_snapshots_user_date ON portfolio_snapshots(user_id, snapshot_date);
CREATE INDEX idx_symbols_is_custom ON symbols(is_custom);
CREATE INDEX idx_symbols_created_by ON symbols(created_by_user_id) WHERE is_custom = TRUE;
CREATE INDEX idx_user_symbol_prices_user_symbol ON user_symbol_prices(user_id, symbol);
CREATE INDEX idx_user_symbol_prices_date ON user_symbol_prices(price_date);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to transactions table
CREATE TRIGGER update_transactions_updated_at 
    BEFORE UPDATE ON transactions 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_updated_at_column();

-- Apply updated_at trigger to user_symbol_prices table
CREATE TRIGGER update_user_symbol_prices_updated_at 
    BEFORE UPDATE ON user_symbol_prices 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_updated_at_column();