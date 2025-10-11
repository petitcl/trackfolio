-- Portfolio Tracker Database Schema
-- Run this in Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE transaction_type AS ENUM ('buy', 'sell', 'dividend', 'bonus', 'deposit', 'withdrawal');
CREATE TYPE asset_type AS ENUM ('stock', 'crypto', 'currency', 'cash', 'real_estate', 'other');

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
    amount DECIMAL(20,8),
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
    currency TEXT NOT NULL,
    last_price DECIMAL(20,8),
    last_updated TIMESTAMPTZ,
    is_custom BOOLEAN DEFAULT FALSE NOT NULL,
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    holding_type TEXT DEFAULT 'standard' NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
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

CREATE TABLE symbol_price_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    symbol TEXT NOT NULL,
    date DATE NOT NULL,
    open_price DECIMAL(20,8),
    high_price DECIMAL(20,8),
    low_price DECIMAL(20,8),
    close_price DECIMAL(20,8) NOT NULL,
    volume BIGINT,
    adjusted_close DECIMAL(20,8),
    data_source TEXT DEFAULT 'manual', -- 'manual', 'yahoo', 'alpha_vantage', etc.
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- One price record per symbol per date
    UNIQUE(symbol, date),

    -- Foreign key to symbols table
    FOREIGN KEY (symbol) REFERENCES symbols(symbol) ON DELETE CASCADE
);

-- Positions table - tracks which symbols a user is tracking/holding
CREATE TABLE positions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    symbol TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- One position per user per symbol
    UNIQUE(user_id, symbol),

    -- Foreign key to symbols table
    FOREIGN KEY (symbol) REFERENCES symbols(symbol) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_user_symbol ON transactions(user_id, symbol);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_symbols_is_custom ON symbols(is_custom);
CREATE INDEX idx_symbols_created_by ON symbols(created_by_user_id) WHERE is_custom = TRUE;
CREATE INDEX idx_user_symbol_prices_user_symbol ON user_symbol_prices(user_id, symbol);
CREATE INDEX idx_user_symbol_prices_date ON user_symbol_prices(price_date);
CREATE INDEX idx_symbol_price_history_symbol_date ON symbol_price_history(symbol, date);
CREATE INDEX idx_symbol_price_history_date ON symbol_price_history(date);
CREATE INDEX idx_symbol_price_history_symbol ON symbol_price_history(symbol);
CREATE INDEX idx_positions_user_id ON positions(user_id);
CREATE INDEX idx_positions_user_symbol ON positions(user_id, symbol);

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

-- Row Level Security Policies
-- Run this after creating tables

-- Enable RLS on all tables
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE symbols ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_symbol_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE symbol_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;


-- Transactions policies - users can only access their own transactions
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON transactions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON transactions
    FOR DELETE USING (auth.uid() = user_id);

-- Symbols policies - complex rules for public vs custom symbols
CREATE POLICY "All users can view public symbols" ON symbols
    FOR SELECT USING (is_custom = FALSE);

CREATE POLICY "Users can view their own custom symbols" ON symbols
    FOR SELECT USING (is_custom = TRUE AND created_by_user_id = auth.uid());

CREATE POLICY "Users can create custom symbols" ON symbols
    FOR INSERT WITH CHECK (is_custom = TRUE AND created_by_user_id = auth.uid());

CREATE POLICY "Users can update their own custom symbols" ON symbols
    FOR UPDATE USING (is_custom = TRUE AND created_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own custom symbols" ON symbols
    FOR DELETE USING (is_custom = TRUE AND created_by_user_id = auth.uid());

CREATE POLICY "Service role can manage public symbols" ON symbols
    FOR ALL USING (auth.role() = 'service_role');

-- User symbol prices policies - users can only manage their own manual prices
CREATE POLICY "Users can view own manual prices" ON user_symbol_prices
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own manual prices" ON user_symbol_prices
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own manual prices" ON user_symbol_prices
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own manual prices" ON user_symbol_prices
    FOR DELETE USING (auth.uid() = user_id);

-- symbol price history
CREATE POLICY "Historical prices are readable if authenticated" ON symbol_price_history
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS Policy: Only service role can insert/update historical prices (for API imports)
CREATE POLICY "Only service role can modify historical prices" ON symbol_price_history
    FOR ALL USING (auth.role() = 'service_role');

GRANT SELECT ON symbol_price_history TO authenticated;
GRANT ALL ON symbol_price_history TO service_role;

-- Positions policies - users can only access their own positions
CREATE POLICY "Users can view own positions" ON positions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own positions" ON positions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own positions" ON positions
    FOR DELETE USING (auth.uid() = user_id);
