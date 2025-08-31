# Scripts

This directory contains utility scripts for development and testing.

## update-daily-prices.js

Update daily market prices locally and test the automatic price update cron job.

### Usage

```bash
# Make sure your development server is running
npm run dev

# In another terminal, update prices
node scripts/update-daily-prices.js
```
### Running Against Production

You can also test against your deployed Vercel app:

```bash
node scripts/update-daily-prices.js https://trackfolio-jy6d.vercel.app
```

### What it does

1. **Loads Environment Variables**: Uses `dotenv` to read from `.env.local`
2. **Validates Configuration**: Ensures all required API keys are set
3. **Makes Authenticated Request**: Calls the admin endpoint with proper auth
4. **Pretty Output**: Shows formatted results with success/failure details

### Example Output

```
📈 Daily Price Update Script
============================

✅ Environment variables loaded from .env.local
✅ Environment variables validated
🌐 Target URL: http://localhost:3000

🔗 Calling: http://localhost:3000/api/admin/update-prices
🔐 Auth: Bearer xa0*7G3#...

📊 Status: 200 OK
✅ Success! Response:

📝 Message: Daily price update completed
📅 Date: 2024-01-15
⏱️  Duration: 45000ms
📈 Total symbols: 15
✅ Successful: 15
❌ Failed: 0

🔧 Provider Status:
   🔴 ✅ alpha_vantage (12000ms delay)
   🟢 ✅ yahoo_finance (1000ms delay)

📊 Results by Provider:
   yahoo_finance: 15 successful

📋 Detailed Results:
   1. ✅ AAPL: $192.53 [yahoo_finance]
   2. ✅ GOOGL: $2847.28 [yahoo_finance]
   3. ✅ MSFT: $404.87 [yahoo_finance]
   ...
```

### Provider Information

All scripts now show which price provider was used for each operation:

- **🟢 Enabled**: Provider is active and will be used in the waterfall
- **🔴 Disabled**: Provider is configured but temporarily disabled
- **✅ Available**: Provider is properly configured (API keys, etc.)
- **❌ Unavailable**: Provider configuration is missing or invalid
- **alpha_vantage**: Currently disabled, more comprehensive but with rate limits
- **yahoo_finance**: Currently enabled as primary provider
- **Provider Status**: Shows enabled/disabled status, availability, and rate limit delays
- **Results by Provider**: Summary of how many symbols each provider handled
- **Individual Results**: Each price/symbol shows `[provider_name]` to indicate source

### Troubleshooting

**"Environment variables not configured"**
- Update your `.env.local` file with real API keys
- Make sure `CRON_SECRET`, `ALPHA_VANTAGE_API_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are set

**"Connection refused"**
- Make sure `npm run dev` is running in another terminal
- Check that the server is running on http://localhost:3000

**"Rate limit exceeded"**
- Alpha Vantage free tier has 25 requests per day
- System automatically falls back to Yahoo Finance when this happens
- Wait until the next day or upgrade Alpha Vantage to premium plan

