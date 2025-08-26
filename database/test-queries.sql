-- Test Queries for Portfolio Tracker
-- Use these to verify data and test portfolio calculations

-- 1. View all transactions for a user (replace TEST_USER_UUID)
SELECT 
    date,
    symbol,
    type,
    quantity,
    price_per_unit,
    (quantity * price_per_unit) as total_value,
    fees,
    notes
FROM transactions 
WHERE user_id = 'TEST_USER_UUID'
ORDER BY date DESC, created_at DESC;

-- 2. Calculate current holdings by symbol (this is core portfolio logic)
WITH position_changes AS (
    SELECT 
        symbol,
        CASE 
            WHEN type IN ('buy', 'dividend', 'bonus') THEN quantity
            WHEN type = 'sell' THEN -quantity
            ELSE 0
        END as quantity_change,
        CASE 
            WHEN type IN ('buy', 'sell') THEN quantity * price_per_unit + fees
            WHEN type = 'dividend' THEN -quantity * price_per_unit  -- dividends are cash received
            ELSE 0
        END as cost_change
    FROM transactions 
    WHERE user_id = 'TEST_USER_UUID' 
    AND symbol != 'CASH'  -- Handle cash separately
)
SELECT 
    symbol,
    SUM(quantity_change) as current_quantity,
    CASE 
        WHEN SUM(quantity_change) > 0 
        THEN SUM(cost_change) / SUM(quantity_change)
        ELSE 0 
    END as avg_cost_per_share,
    SUM(cost_change) as total_cost_basis
FROM position_changes
GROUP BY symbol
HAVING SUM(quantity_change) > 0  -- Only show positions we still hold
ORDER BY symbol;

-- 3. Calculate cash balance
WITH cash_flows AS (
    SELECT 
        CASE 
            WHEN symbol = 'CASH' AND type = 'deposit' THEN quantity
            WHEN symbol = 'CASH' AND type = 'withdrawal' THEN -quantity
            WHEN symbol != 'CASH' AND type = 'buy' THEN -(quantity * price_per_unit + fees)
            WHEN symbol != 'CASH' AND type = 'sell' THEN (quantity * price_per_unit - fees)
            WHEN type = 'dividend' THEN quantity * price_per_unit
            ELSE 0
        END as cash_change
    FROM transactions 
    WHERE user_id = 'TEST_USER_UUID'
)
SELECT SUM(cash_change) as current_cash_balance
FROM cash_flows;

-- 4. Portfolio value with current prices (including manual price overrides)
WITH current_positions AS (
    SELECT 
        t.symbol,
        SUM(CASE 
            WHEN t.type IN ('buy', 'dividend', 'bonus') THEN t.quantity
            WHEN t.type = 'sell' THEN -t.quantity
            ELSE 0
        END) as quantity
    FROM transactions t
    WHERE t.user_id = 'TEST_USER_UUID' 
    AND t.symbol != 'CASH'
    GROUP BY t.symbol
    HAVING SUM(CASE 
        WHEN t.type IN ('buy', 'dividend', 'bonus') THEN t.quantity
        WHEN t.type = 'sell' THEN -t.quantity
        ELSE 0
    END) > 0
),
effective_prices AS (
    -- Get the effective price for each symbol (manual override or market price)
    SELECT 
        cp.symbol,
        cp.quantity,
        COALESCE(usp.manual_price, s.last_price, 0) as effective_price,
        CASE WHEN usp.manual_price IS NOT NULL THEN TRUE ELSE FALSE END as has_manual_price
    FROM current_positions cp
    LEFT JOIN symbols s ON cp.symbol = s.symbol
    LEFT JOIN user_symbol_prices usp ON (cp.symbol = usp.symbol AND usp.user_id = 'TEST_USER_UUID' AND usp.price_date = CURRENT_DATE)
),
cash_balance AS (
    SELECT SUM(
        CASE 
            WHEN symbol = 'CASH' AND type = 'deposit' THEN quantity
            WHEN symbol = 'CASH' AND type = 'withdrawal' THEN -quantity
            WHEN symbol != 'CASH' AND type = 'buy' THEN -(quantity * price_per_unit + fees)
            WHEN symbol != 'CASH' AND type = 'sell' THEN (quantity * price_per_unit - fees)
            WHEN type = 'dividend' THEN quantity * price_per_unit
            ELSE 0
        END
    ) as cash
    FROM transactions 
    WHERE user_id = 'TEST_USER_UUID'
)
SELECT 
    'Holdings' as item,
    COALESCE(SUM(ep.quantity * ep.effective_price), 0) as value
FROM effective_prices ep

UNION ALL

SELECT 
    'Cash' as item,
    cb.cash as value
FROM cash_balance cb

UNION ALL

SELECT 
    'Total Portfolio' as item,
    COALESCE(SUM(ep.quantity * ep.effective_price), 0) + cb.cash as value
FROM effective_prices ep
CROSS JOIN cash_balance cb;

-- 5. Transaction summary by type
SELECT 
    type,
    COUNT(*) as transaction_count,
    SUM(quantity * price_per_unit + fees) as total_amount
FROM transactions 
WHERE user_id = 'TEST_USER_UUID'
GROUP BY type
ORDER BY type;

-- 6. Holdings with P/L calculation
WITH current_positions AS (
    SELECT 
        t.symbol,
        SUM(CASE 
            WHEN t.type IN ('buy', 'dividend', 'bonus') THEN t.quantity
            WHEN t.type = 'sell' THEN -t.quantity
            ELSE 0
        END) as quantity,
        SUM(CASE 
            WHEN t.type IN ('buy', 'sell') THEN t.quantity * t.price_per_unit + t.fees
            WHEN t.type = 'dividend' THEN -t.quantity * t.price_per_unit
            ELSE 0
        END) as cost_basis
    FROM transactions t
    WHERE t.user_id = 'TEST_USER_UUID' 
    AND t.symbol != 'CASH'
    GROUP BY t.symbol
    HAVING SUM(CASE 
        WHEN t.type IN ('buy', 'dividend', 'bonus') THEN t.quantity
        WHEN t.type = 'sell' THEN -t.quantity
        ELSE 0
    END) > 0
)
SELECT 
    cp.symbol,
    cp.quantity,
    ROUND(cp.cost_basis / cp.quantity, 2) as avg_cost,
    s.last_price as current_price,
    ROUND(cp.quantity * s.last_price, 2) as current_value,
    ROUND(cp.quantity * s.last_price - cp.cost_basis, 2) as unrealized_pnl,
    ROUND((cp.quantity * s.last_price - cp.cost_basis) / cp.cost_basis * 100, 2) as pnl_percent
FROM current_positions cp
LEFT JOIN symbols s ON cp.symbol = s.symbol
ORDER BY current_value DESC;

-- 7. Custom investments and manual pricing overview
SELECT 
    s.symbol,
    s.name,
    s.asset_type,
    s.is_custom,
    CASE WHEN s.is_custom THEN 'User Created' ELSE 'Public' END as source,
    s.last_price as market_price,
    usp.manual_price,
    usp.price_date as manual_price_date,
    usp.notes as price_notes,
    CASE 
        WHEN usp.manual_price IS NOT NULL THEN usp.manual_price 
        ELSE s.last_price 
    END as effective_price
FROM symbols s
LEFT JOIN user_symbol_prices usp ON (
    s.symbol = usp.symbol 
    AND usp.user_id = 'TEST_USER_UUID' 
    AND usp.price_date = CURRENT_DATE
)
WHERE s.is_custom = TRUE OR usp.manual_price IS NOT NULL
ORDER BY s.is_custom DESC, s.symbol;

-- 8. Price override history for a specific symbol
SELECT 
    symbol,
    manual_price,
    price_date,
    notes,
    created_at
FROM user_symbol_prices 
WHERE user_id = 'TEST_USER_UUID'
ORDER BY symbol, price_date DESC;