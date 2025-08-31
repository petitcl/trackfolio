# Automatic Price Updates

This document explains how the automatic market price update system works.

## Overview

The system automatically fetches daily market prices for all non-custom symbols and stores them in the database. This enables:

- **Historical portfolio valuations**: Track how your portfolio value changed over time
- **Current market prices**: Display up-to-date prices for holdings
- **Performance analysis**: Calculate returns and gains accurately

## Architecture

### Components

1. **PriceDataService** (`/src/lib/services/priceData.service.ts`)
   - Handles API communication with Alpha Vantage
   - Manages rate limiting and error handling
   - Fetches both current quotes and historical data

2. **Cron Job** (`/src/app/api/cron/update-prices/route.ts`)
   - Runs daily at 9 PM UTC (after US market close)
   - Protected with authorization header
   - Updates both `symbol_price_history` and `symbols.last_price`

3. **Database Tables**
   - `symbol_price_history`: Historical OHLC data with volume
   - `symbols`: Current prices in `last_price` field
   - `user_symbol_prices`: Manual price overrides (separate from market data)

### Data Flow

```
Daily at 9 PM UTC
↓
Vercel Cron Scheduler
↓
/api/cron/update-prices
↓
Fetch non-custom symbols from DB
↓
Alpha Vantage API (with rate limiting)
↓
Update symbol_price_history table
↓
Update symbols.last_price field
```

## Setup Instructions

### 1. Get Alpha Vantage API Key

1. Go to [Alpha Vantage](https://www.alphavantage.co/support/#api-key)
2. Sign up for a free account
3. Copy your API key

**Free Tier Limits:**
- 25 API requests per day
- 5 requests per minute
- Perfect for portfolios with up to 25 symbols

**Premium Plan ($25/month):**
- 75 requests per minute
- Higher daily limits
- Set `ALPHA_VANTAGE_PLAN=premium` for faster updates

### 2. Configure Environment Variables

Add these to your `.env.local` file:

```bash
# Alpha Vantage API
ALPHA_VANTAGE_API_KEY=your_api_key_here
ALPHA_VANTAGE_PLAN=free  # or 'premium'

# Cron Security
CRON_SECRET=your_secure_random_string

# Supabase Service Role (for admin DB operations)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Generate a secure CRON_SECRET:
```bash
openssl rand -base64 32
```

### 3. Deploy to Vercel

The `vercel.json` file configures the cron job:

```json
{
  "crons": [
    {
      "path": "/api/cron/update-prices",
      "schedule": "0 21 * * 1-5"  // Monday-Friday at 9 PM UTC
    }
  ]
}
```

**Important:** Add all environment variables to your Vercel project settings before deployment.

## Security

### Authorization Protection

The cron endpoint is protected using a bearer token:

```typescript
const authHeader = request.headers.get('authorization')
const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

if (authHeader !== expectedAuth) {
  return 401 Unauthorized
}
```

Only requests with the correct `CRON_SECRET` can execute the price updates.

### Database Access

The cron job uses the `SUPABASE_SERVICE_ROLE_KEY` which has admin permissions. This key:
- Should never be exposed to client-side code
- Is only used in server-side cron jobs
- Allows bypassing Row Level Security (RLS) for batch operations

## Monitoring

### Logs

The cron job provides detailed logging:

```
🕒 Starting daily price update job...
📈 Found 15 symbols to update: ['AAPL', 'GOOGL', ...]
✅ Retrieved 15 quotes from Alpha Vantage
💾 Inserted 15 price history records
🔄 Updated last_price for 15 symbols
🎉 Daily price update job completed: 15 successful, 0 failed
```

### Success Response

```json
{
  "message": "Daily price update completed",
  "date": "2024-01-15",
  "duration": "180000ms",
  "total": 15,
  "successful": 15,
  "failed": 0,
  "results": [...]
}
```

### Error Handling

- **API Rate Limits**: Automatic backoff and retry
- **Individual Symbol Failures**: Continue processing other symbols
- **Network Issues**: Log errors and return failure status
- **Duplicate Prevention**: Skip if already processed today

## Local Development & Testing

### Running Price Updates Locally

Yes! You can run the price update job locally for development and testing:

#### Option 1: Use the Test Script (Recommended)

```bash
# Make sure your dev server is running
npm run dev

# In another terminal, run the update script
npm run update-daily-prices

# Or run directly
node scripts/update-daily-prices.js
```

The update script will:
- ✅ Load environment variables from `.env.local`
- ✅ Validate all required variables are configured
- ✅ Call your local endpoint with proper authorization
- ✅ Show detailed, formatted results

#### Option 2: Manual cURL Testing

Test the cron endpoint directly:

**Local Development:**
```bash
curl -X GET http://localhost:3000/api/cron/update-prices \
  -H "Authorization: Bearer xa0*7G3#bbdzIB*D!rkOwqJu"
```

**Production:**
```bash
curl -X GET https://your-app.vercel.app/api/cron/update-prices \
  -H "Authorization: Bearer your_cron_secret_here"
```

### Local Development Features

When running in development mode (`NODE_ENV=development`), the endpoint provides:

- **Enhanced Error Messages**: Detailed debugging information for auth failures
- **Environment Validation**: Checks for missing API keys and configuration
- **Detailed Logging**: More verbose console output for troubleshooting

Example enhanced error response:
```json
{
  "error": "Unauthorized",
  "debug": {
    "received": "Bearer wrong_secret",
    "expected": "Bearer xa0*7G3#bbdzIB*D!rkOwqJu",
    "cronSecretConfigured": true
  }
}
```

### Local vs Production Behavior

| Feature | Local Development | Production |
|---------|------------------|------------|
| **Error Details** | Full debug info | Minimal error messages |
| **Environment Validation** | Validates all required vars | Assumes properly configured |
| **Rate Limiting** | Same as production | Respects Alpha Vantage limits |
| **Database Updates** | Uses real Supabase DB | Uses real Supabase DB |

⚠️ **Important**: Local testing uses your real database and API quotas, just like production.

## Database Schema

### symbol_price_history

```sql
CREATE TABLE symbol_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR NOT NULL REFERENCES symbols(symbol),
  date DATE NOT NULL,
  open_price DECIMAL,
  high_price DECIMAL,
  low_price DECIMAL,
  close_price DECIMAL NOT NULL,
  volume BIGINT,
  adjusted_close DECIMAL,
  data_source VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(symbol, date)
);
```

### Key Features

- **Unique constraint**: Prevents duplicate entries for same symbol/date
- **Foreign key**: Links to symbols table
- **Full OHLC data**: Open, High, Low, Close prices
- **Data source tracking**: Know whether price came from API, manual entry, etc.

## Rate Limiting Strategy

### Free Tier (25 requests/day)
- Updates run Monday-Friday only
- 12-second delays between requests
- Can handle up to 25 symbols
- Takes about 5 minutes to complete

### Premium Tier (75 requests/minute)
- 0.8-second delays between requests
- Can handle hundreds of symbols
- Completes in under a minute

## Troubleshooting

### Common Issues

1. **"API key not configured"**
   - Add `ALPHA_VANTAGE_API_KEY` to environment variables

2. **"Rate limit exceeded"**
   - Free tier reached daily limit (25 requests)
   - Wait until next day or upgrade to premium

3. **"Unauthorized cron request"**
   - Check `CRON_SECRET` matches in environment variables

4. **"Failed to fetch symbols"**
   - Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
   - Check database connection

### Logs Location

- **Local Development**: Check terminal/console output
- **Vercel Production**: View in Vercel Dashboard > Functions tab > Logs

## Future Enhancements

### Backfill Script
A separate endpoint for historical data backfill:

```
POST /api/admin/backfill-prices
{
  "symbol": "AAPL",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31"
}
```

### Multiple Data Sources
Support for additional price APIs:
- IEX Cloud
- Polygon.io  
- Finnhub

### Advanced Scheduling
- Market holiday awareness
- Different schedules for different asset types (crypto 24/7)
- Intraday updates for real-time portfolios