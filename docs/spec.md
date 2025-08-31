# Portfolio Tracker App - Technical Specification

## Overview
A personal portfolio tracker PWA for tracking stocks, ETFs, crypto, and cash with real-time valuations and performance metrics.

## User Flow
1. User logs in via Google social auth and sees empty dashboard (all amounts = $0)
2. User adds holdings by recording transactions (buy/sell/dividend/bonus)
3. User views portfolio performance, P/L, and metrics
4. App fetches current prices and calculates valuations automatically

## Core Features

### 1. Authentication
- Google OAuth integration
- Single user per account (manual account creation)
- Session management via Supabase Auth

### 2. Transaction Management
**Transaction Types:**
- `buy` - Purchase of assets
- `sell` - Sale of assets  
- `dividend` - Dividend payments received
- `bonus` - Free shares received (quantity with $0 price)
- `deposit` - Cash additions to portfolio
- `withdrawal` - Cash withdrawals from portfolio

**Transaction Fields:**
- `id` (UUID, primary key)
- `user_id` (foreign key to auth.users)
- `date` (date)
- `symbol` (string, e.g., "AAPL", "BTC")
- `type` (enum: buy/sell/dividend/bonus/deposit/withdrawal)
- `quantity` (decimal)
- `price_per_unit` (decimal, $0 for bonuses)
- `currency` (string, default "USD")
- `fees` (decimal, optional)
- `notes` (text, optional)
- `broker` (string, optional)
- `created_at`, `updated_at` (timestamps)

### 3. Asset Symbol Management
- **No local symbol database** - use external API for symbol lookup
- Typeahead search using free API (Yahoo Finance/Alpha Vantage)
- Cache only symbols that users actually own
- Store basic symbol info when first used:
  - `symbol` (primary key)
  - `name` (company/asset name)
  - `asset_type` (stock/etf/crypto/cash)
  - `last_price` (decimal)
  - `last_updated` (timestamp)

### 4. Portfolio Valuation & Pricing
**Pricing Strategy (Hybrid):**
- Manual refresh available anytime
- Automatic daily refresh via Supabase Edge Function (cron)
- Store current portfolio snapshots for historical tracking

**Price Data:**
- Fetch from free APIs (Yahoo Finance, Alpha Vantage, Finnhub)
- Store daily snapshots, not full historical price series
- Calculate Mark-to-Market values using latest prices

### 5. Performance Metrics
- Current portfolio value (sum of position values + cash)
- Daily P/L (today vs yesterday)
- Total P/L (realized + unrealized)
- XIRR calculation for annualized returns
- Holdings breakdown by symbol

## Technical Architecture

### Frontend
- **Next.js 14+ with TypeScript**
- **PWA configuration** for mobile installation
- **Responsive design** (mobile-first, desktop compatible)
- **Offline support** with service worker caching

### Backend & Database
- **Supabase** (Postgres + Auth + Edge Functions)
- **Row Level Security** for user data isolation
- **Real-time subscriptions** for live portfolio updates

### External APIs
- Symbol search: Yahoo Finance/Alpha Vantage free tier
- Price data: Same APIs for current prices
- No API keys stored in frontend (use Supabase Edge Functions as proxy)

### Database Schema

```sql
-- Extends Supabase auth.users
-- Users created manually in Supabase dashboard

-- Transactions table
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  date DATE NOT NULL,
  symbol TEXT NOT NULL,
  type TEXT CHECK (type IN ('buy', 'sell', 'dividend', 'bonus', 'deposit', 'withdrawal')) NOT NULL,
  quantity DECIMAL(20,8) NOT NULL,
  price_per_unit DECIMAL(20,8) NOT NULL,
  currency TEXT DEFAULT 'USD' NOT NULL,
  fees DECIMAL(20,8) DEFAULT 0,
  notes TEXT,
  broker TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Symbols cache (only for owned assets)
CREATE TABLE symbols (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  asset_type TEXT DEFAULT 'stock',
  last_price DECIMAL(20,8),
  last_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

```

## Pages & UI Structure

### 1. Dashboard (`/`)
- Portfolio overview (total value, daily P/L)
- Holdings summary
- Quick action: "Add Transaction" button

### 2. Holdings (`/holdings`)
- List of current positions with current values
- Click holding → view transactions for that symbol

### 3. Add Transaction (`/transactions/new`)
- Symbol typeahead search
- Transaction type selector
- Form fields based on transaction type
- Save and optionally "Add Another"

### 4. Transaction History (`/transactions`)
- Chronological list of all transactions
- Filter by symbol, type, date range
- Edit/delete transactions

### 5. Symbol Detail (`/holdings/[symbol]`)
- Position summary for specific symbol
- Transaction history for that symbol
- Performance metrics for that holding

## Implementation Phases

### Phase 1: Core MVP
- [ ] Supabase project setup with database schema
- [ ] Next.js PWA foundation with Google Auth
- [ ] Basic transaction CRUD operations
- [ ] Simple dashboard with portfolio value
- [ ] Manual price refresh functionality

### Phase 2: Automation & Polish
- [ ] Daily price refresh via Edge Functions
- [ ] Portfolio snapshots and historical tracking
- [ ] Performance metrics (P/L, XIRR)
- [ ] Symbol typeahead search
- [ ] Mobile PWA optimization

### Phase 3: Enhancement
- [ ] Advanced metrics and charts
- [ ] Export functionality
- [ ] Improved offline support
- [ ] UI/UX refinements

## Next Steps
Ready to proceed with detailed technical implementation planning for Phase 1.
