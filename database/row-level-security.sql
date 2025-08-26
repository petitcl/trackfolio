-- Row Level Security Policies
-- Run this after creating tables

-- Enable RLS on all tables
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE symbols ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_symbol_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;

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

-- Portfolio snapshots policies - users can only access their own snapshots
CREATE POLICY "Users can view own portfolio snapshots" ON portfolio_snapshots
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own portfolio snapshots" ON portfolio_snapshots
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own portfolio snapshots" ON portfolio_snapshots
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own portfolio snapshots" ON portfolio_snapshots
    FOR DELETE USING (auth.uid() = user_id);

-- User symbol prices policies - users can only manage their own manual prices
CREATE POLICY "Users can view own manual prices" ON user_symbol_prices
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own manual prices" ON user_symbol_prices
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own manual prices" ON user_symbol_prices
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own manual prices" ON user_symbol_prices
    FOR DELETE USING (auth.uid() = user_id);