-- Sample Data for Testing
-- Run this after setting up tables and RLS policies
-- Note: Replace 'TEST_USER_UUID' with actual user UUID from auth.users

-- First, insert popular public symbols into the symbols cache
INSERT INTO symbols (symbol, name, asset_type, currency, last_price, last_updated, is_custom, created_by_user_id) VALUES
    ('AAPL', 'Apple Inc.', 'stock', 'USD', 185.50, NOW(), FALSE, NULL),
    ('MSFT', 'Microsoft Corporation', 'stock', 'USD', 420.30, NOW(), FALSE, NULL),
    ('GOOGL', 'Alphabet Inc.', 'stock', 'USD', 142.80, NOW(), FALSE, NULL),
    ('TSLA', 'Tesla Inc.', 'stock', 'USD', 248.90, NOW(), FALSE, NULL),
    ('VTI', 'Vanguard Total Stock Market ETF', 'etf', 'USD', 245.60, NOW(), FALSE, NULL),
    ('BTC', 'Bitcoin', 'crypto', 'USD', 43500.00, NOW(), FALSE, NULL),
    ('ETH', 'Ethereum', 'crypto', 'USD', 2650.00, NOW(), FALSE, NULL),
    -- Major currency pairs
    ('EURUSD', 'Euro/US Dollar', 'currency', 'USD', 1.0850, NOW(), FALSE, NULL),
    ('GBPUSD', 'British Pound/US Dollar', 'currency', 'USD', 1.2650, NOW(), FALSE, NULL),
    ('EURGBP', 'Euro/British Pound', 'currency', 'EUR', 0.8580, NOW(), FALSE, NULL)
ON CONFLICT (symbol) DO NOTHING;

-- Add some custom user investments
INSERT INTO symbols (symbol, name, asset_type, currency, last_price, last_updated, is_custom, created_by_user_id) VALUES
    ('MY_CASH', 'Cash Account', 'cash', 'USD', 120000.00, NOW(), TRUE, '49c7a133-05b8-4175-927c-a406fcd78ff1'),
    ('MY_HOUSE', 'Primary Residence', 'real_estate', 'USD', 120000.00, NOW(), TRUE, '49c7a133-05b8-4175-927c-a406fcd78ff1'),
    ('VINTAGE_WATCH', 'Rolex Submariner Collection', 'other', 'USD', 12500.00, NOW(), TRUE, '49c7a133-05b8-4175-927c-a406fcd78ff1'),
    ('STARTUP_XYZ', 'Private Company XYZ Shares', 'other', 'USD', 50.00, NOW(), TRUE, '49c7a133-05b8-4175-927c-a406fcd78ff1');

-- Sample transactions for a test user
-- Replace '49c7a133-05b8-4175-927c-a406fcd78ff1' with the actual UUID from your Supabase auth.users table
-- You can get this by creating a user in Supabase Auth and checking the Users tab

-- Example transactions showing a realistic portfolio building over time:
-- Starting with initial deposit
INSERT INTO transactions (user_id, date, symbol, type, quantity, price_per_unit, currency, fees, notes) VALUES
    -- Initial cash deposit - March 2024
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-03-01', 'MY_CASH', 'deposit', 10000.00, 1.00, 'USD', 0, 'Initial portfolio funding'),
    
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
    
    -- Currency trading examples
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-10-05', 'EURUSD', 'buy', 10000.00, 1.0920, 'USD', 5.00, 'Euro long position - expecting rate cut'),
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-10-15', 'GBPUSD', 'buy', 5000.00, 1.2800, 'USD', 3.50, 'GBP position on Brexit news'),
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-11-10', 'USDJPY', 'buy', 15000.00, 148.50, 'USD', 7.50, 'USD/JPY carry trade'),
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-11-25', 'EURUSD', 'sell', 5000.00, 1.0880, 'USD', 2.50, 'Partial profit taking on EUR'),
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-12-05', 'AUDUSD', 'buy', 8000.00, 0.6620, 'USD', 4.00, 'AUD commodity play'),
    
    -- Cash management
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-12-20', 'MY_CASH', 'deposit', 2000.00, 1.00, 'USD', 0, 'Additional funding for 2025'),
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-12-22', 'MY_CASH', 'withdrawal', 500.00, 1.00, 'USD', 0, 'Holiday expenses'),
    
    -- Custom investment transactions
    ('49c7a133-05b8-4175-927c-a406fcd78ff1', '2024-01-15', 'MY_HOUSE', 'buy', 1.00, 110000.00, 'USD', 25000.00, 'House purchase - down payment and fees'),
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

