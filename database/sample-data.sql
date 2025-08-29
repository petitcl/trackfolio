-- Sample Data for Testing
-- Run this after setting up tables and RLS policies
-- Note: Replace 'TEST_USER_UUID' with actual user UUID from auth.users

-- First, insert popular public symbols into the symbols cache
INSERT INTO symbols (symbol, name, asset_type, last_price, last_updated, is_custom, created_by_user_id) VALUES
    ('AAPL', 'Apple Inc.', 'stock', 185.50, NOW(), FALSE, NULL),
    ('MSFT', 'Microsoft Corporation', 'stock', 420.30, NOW(), FALSE, NULL),
    ('GOOGL', 'Alphabet Inc.', 'stock', 142.80, NOW(), FALSE, NULL),
    ('TSLA', 'Tesla Inc.', 'stock', 248.90, NOW(), FALSE, NULL),
    ('VTI', 'Vanguard Total Stock Market ETF', 'etf', 245.60, NOW(), FALSE, NULL),
    ('BTC', 'Bitcoin', 'crypto', 43500.00, NOW(), FALSE, NULL),
    ('ETH', 'Ethereum', 'crypto', 2650.00, NOW(), FALSE, NULL),
    ('CASH', 'Cash USD', 'cash', 1.00, NOW(), FALSE, NULL);

-- Add some custom user investments
INSERT INTO symbols (symbol, name, asset_type, last_price, last_updated, is_custom, created_by_user_id) VALUES
    ('MY_HOUSE', 'Primary Residence', 'real_estate', 450000.00, NOW(), TRUE, '49c7a133-05b8-4175-927c-a406fcd78ff1'),
    ('VINTAGE_WATCH', 'Rolex Submariner Collection', 'other', 12500.00, NOW(), TRUE, '49c7a133-05b8-4175-927c-a406fcd78ff1'),
    ('STARTUP_XYZ', 'Private Company XYZ Shares', 'other', 50.00, NOW(), TRUE, '49c7a133-05b8-4175-927c-a406fcd78ff1');

-- Sample transactions for a test user
-- Replace '49c7a133-05b8-4175-927c-a406fcd78ff1' with the actual UUID from your Supabase auth.users table
-- You can get this by creating a user in Supabase Auth and checking the Users tab

-- Example transactions showing a realistic portfolio building over time:
-- Starting with initial deposit
INSERT INTO transactions (user_id, date, symbol, type, quantity, price_per_unit, currency, fees, notes) VALUES
    -- Initial cash deposit - March 2024
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-03-01', 'CASH', 'deposit', 10000.00, 1.00, 'USD', 0, 'Initial portfolio funding'),
    
    -- First stock purchases - March 2024
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-03-05', 'AAPL', 'buy', 50.00, 175.20, 'USD', 4.99, 'First Apple purchase'),
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-03-10', 'MSFT', 'buy', 25.00, 395.80, 'USD', 4.99, 'Microsoft position'),
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-03-15', 'VTI', 'buy', 20.00, 235.40, 'USD', 0, 'ETF diversification'),
    
    -- Additional purchases through the year
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-04-12', 'GOOGL', 'buy', 15.00, 138.50, 'USD', 4.99, 'Google buy on dip'),
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-05-20', 'AAPL', 'buy', 30.00, 182.40, 'USD', 4.99, 'Adding to Apple position'),
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-06-15', 'TSLA', 'buy', 40.00, 195.30, 'USD', 4.99, 'Tesla investment'),
    
    -- Crypto purchases - July 2024
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-07-10', 'BTC', 'buy', 0.15000000, 58000.00, 'USD', 25.00, 'Bitcoin allocation'),
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-07-12', 'ETH', 'buy', 2.50000000, 3200.00, 'USD', 15.00, 'Ethereum purchase'),
    
    -- Some selling activity - August 2024
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-08-05', 'TSLA', 'sell', 15.00, 225.80, 'USD', 4.99, 'Partial TSLA sale'),
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-08-20', 'VTI', 'buy', 15.00, 241.20, 'USD', 0, 'VTI dollar cost average'),
    
    -- Dividend payments - Quarterly
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-08-15', 'AAPL', 'dividend', 80.00, 0.25, 'USD', 0, 'Q3 2024 dividend'),
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-08-30', 'MSFT', 'dividend', 25.00, 0.83, 'USD', 0, 'Q3 2024 dividend'),
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-09-15', 'VTI', 'dividend', 35.00, 0.95, 'USD', 0, 'Q3 2024 dividend'),
    
    -- Recent activity - November 2024
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-11-01', 'AAPL', 'buy', 25.00, 180.90, 'USD', 4.99, 'November purchase'),
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-11-15', 'BTC', 'buy', 0.05000000, 42000.00, 'USD', 15.00, 'Bitcoin DCA'),
    
    -- Bonus shares example - December 2024
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-12-01', 'GOOGL', 'bonus', 1.00, 0.00, 'USD', 0, 'Stock bonus from broker promotion'),
    
    -- Recent dividend - December 2024
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-12-15', 'AAPL', 'dividend', 105.00, 0.25, 'USD', 0, 'Q4 2024 dividend'),
    
    -- Cash management
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-12-20', 'CASH', 'deposit', 2000.00, 1.00, 'USD', 0, 'Additional funding for 2025'),
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-12-22', 'CASH', 'withdrawal', 500.00, 1.00, 'USD', 0, 'Holiday expenses'),
    
    -- Custom investment transactions
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-01-15', 'MY_HOUSE', 'buy', 1.00, 420000.00, 'USD', 25000.00, 'House purchase - down payment and fees'),
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-06-10', 'VINTAGE_WATCH', 'buy', 1.00, 11800.00, 'USD', 200.00, 'Rolex Submariner - investment piece'),
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-09-05', 'STARTUP_XYZ', 'buy', 500.00, 45.00, 'USD', 50.00, 'Series A investment in startup'),
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-11-20', 'STARTUP_XYZ', 'buy', 200.00, 55.00, 'USD', 25.00, 'Series B follow-on investment');

-- Add manual price overrides for some investments
INSERT INTO user_symbol_prices (user_id, symbol, manual_price, price_date, notes) VALUES
    -- User thinks their house has appreciated
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', 'MY_HOUSE', 465000.00, '2024-12-23', 'Recent neighborhood comps suggest higher value'),
    -- Manual price update for watch after appraisal
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', 'VINTAGE_WATCH', 13200.00, '2024-12-15', 'Professional appraisal - condition excellent'),
    -- Updated startup valuation from recent funding
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', 'STARTUP_XYZ', 60.00, '2024-12-20', 'Series B funding round increased valuation'),
    -- User manual override for Bitcoin (maybe they disagree with current market price)
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', 'BTC', 45000.00, '2024-12-23', 'Personal valuation based on technical analysis');

-- Create a sample portfolio snapshot (what the portfolio looked like on a specific date)
INSERT INTO portfolio_snapshots (user_id, snapshot_date, total_value, cash_balance, positions) VALUES
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-12-23', 547820.25, 1875.25, 
     '[
        {"symbol": "AAPL", "quantity": 105, "avg_cost": 178.45, "current_price": 185.50, "value": 19477.50, "is_custom": false},
        {"symbol": "MSFT", "quantity": 25, "avg_cost": 395.80, "current_price": 420.30, "value": 10507.50, "is_custom": false},
        {"symbol": "GOOGL", "quantity": 16, "avg_cost": 138.19, "current_price": 142.80, "value": 2284.80, "is_custom": false},
        {"symbol": "TSLA", "quantity": 25, "avg_cost": 195.30, "current_price": 248.90, "value": 6222.50, "is_custom": false},
        {"symbol": "VTI", "quantity": 35, "avg_cost": 237.71, "current_price": 245.60, "value": 8596.00, "is_custom": false},
        {"symbol": "BTC", "quantity": 0.2, "avg_cost": 54000.00, "current_price": 45000.00, "value": 9000.00, "is_custom": false, "manual_price": true},
        {"symbol": "ETH", "quantity": 2.5, "avg_cost": 3200.00, "current_price": 2650.00, "value": 6625.00, "is_custom": false},
        {"symbol": "MY_HOUSE", "quantity": 1, "avg_cost": 445000.00, "current_price": 465000.00, "value": 465000.00, "is_custom": true, "manual_price": true},
        {"symbol": "VINTAGE_WATCH", "quantity": 1, "avg_cost": 12000.00, "current_price": 13200.00, "value": 13200.00, "is_custom": true, "manual_price": true},
        {"symbol": "STARTUP_XYZ", "quantity": 700, "avg_cost": 47.86, "current_price": 60.00, "value": 42000.00, "is_custom": true, "manual_price": true}
     ]'::jsonb
    );

-- You'll need to replace '49c7a133-05b8-4175-927c-a406fcd78ff1' with actual user UUID
-- To get the user UUID:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Create a test user or use existing user
-- 3. Copy the UUID from the user table
-- 4. Replace all instances of '49c7a133-05b8-4175-927c-a406fcd78ff1' with the actual UUID