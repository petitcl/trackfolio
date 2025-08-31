# Trackfolio - Personal Portfolio Tracker

A personal portfolio tracker PWA built with Next.js and Supabase for tracking stocks, crypto, real estate, and custom investments.

## 🏗️ Project Structure

```
trackfolio/
├── webapp/                    # Next.js PWA application
│   ├── src/
│   │   ├── app/              # Next.js 14 App Router
│   │   ├── components/       # React components
│   │   ├── lib/              # Utilities, Supabase client, types
│   │   └── middleware.ts     # Auth middleware
│   ├── public/               # Static assets, PWA manifest
│   └── package.json
├── database/                 # Database schemas and scripts
│   ├── database-setup.sql    # Main database schema
│   ├── row-level-security.sql # RLS policies
│   ├── sample-data.sql       # Test data
│   └── test-queries.sql      # Validation queries
└── docs/                     # Documentation
    ├── spec.md               # Technical specification
    └── SETUP-INSTRUCTIONS.md # Database setup guide
```

## 🚀 Features

### Core Features
- **Multi-Asset Support**: Stocks, ETFs, crypto, real estate, collectibles, cash
- **Transaction Management**: Buy/sell/dividend/bonus transactions with full history
- **Custom Investments**: Add your own assets (real estate, private companies, collectibles)
- **Manual Pricing**: Override market prices with your own valuations
- **Portfolio Analytics**: P&L, daily changes, performance metrics
- **PWA Support**: Install on mobile devices, offline-first design

### Technical Features
- **Next.js 14** with App Router and TypeScript
- **Supabase** for database, auth, and real-time updates
- **Tailwind CSS** for responsive design
- **Google OAuth** authentication
- **Row-level security** for multi-user data isolation
- **Automatic Price Updates** with Alpha Vantage API and Vercel cron
- **Mock data** for testing without database connection

## 📱 Demo Mode

The app includes comprehensive mock data for testing:

### Sample Portfolio (~$548K)
- **Stocks**: AAPL, MSFT (traditional investments)
- **Crypto**: Bitcoin (with manual price override)
- **Real Estate**: Primary residence ($465K)
- **Collectibles**: Vintage Rolex collection ($13K)
- **Private Equity**: Startup shares with custom valuation
- **Cash**: Available balance

## 🛠️ Setup & Installation

### Quick Start (Root Directory)

```bash
# Install all dependencies
npm run setup

# Start development server  
npm run dev

# Test automatic price updates
npm run update-daily-prices
```

Visit `http://localhost:3000`

### Available Commands

#### Development
```bash
npm run dev              # Start development server
npm run build           # Build for production  
npm run start           # Start production server
npm run lint            # Run ESLint
```

#### Setup & Maintenance
```bash
npm run setup           # Install all dependencies
npm run install:webapp  # Install webapp dependencies only
npm run clean           # Clean build files and reinstall
```

#### Price Updates & Testing
```bash
npm run update-daily-prices        # Update daily prices locally
npm run update-daily-prices:local  # Update against local server
npm run update-daily-prices:prod   # Update against production
```

### Detailed Setup

#### 1. Database Setup
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Follow the detailed guide in `docs/SETUP-INSTRUCTIONS.md`
3. Run the SQL scripts in this order:
   - `database/database-setup.sql`
   - `database/row-level-security.sql`
   - `database/sample-data.sql` (after updating user UUID)

#### 2. Environment Configuration
```bash
# Copy environment template (from root directory)
cp webapp/.env.example webapp/.env.local
# Edit webapp/.env.local with your credentials
```

Required environment variables:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Price Data API (Alpha Vantage)
ALPHA_VANTAGE_API_KEY=your_api_key
ALPHA_VANTAGE_PLAN=free

# Cron Job Security  
CRON_SECRET=your_secure_random_string
```

#### 3. Get API Keys
- **Supabase**: Create project at [supabase.com](https://supabase.com)
- **Alpha Vantage**: Get free API key at [alphavantage.co](https://www.alphavantage.co/support/#api-key)

## 🔄 Automatic Price Updates

The app automatically fetches daily market prices using a Vercel cron job:

- **Schedule**: Daily at 9 PM UTC (4 PM EST, after US market close)
- **Source**: Alpha Vantage API (25 free requests/day)
- **Security**: Protected with authorization headers
- **Coverage**: Updates all non-custom symbols automatically

### Testing Price Updates

```bash
# Test locally (requires dev server running)
npm run update-daily-prices

# Test against production deployment  
npm run update-daily-prices:prod
```

See detailed documentation in [`webapp/docs/PRICE_UPDATES.md`](webapp/docs/PRICE_UPDATES.md).

## 🔐 Authentication

### Demo Credentials
- Email: `test@trackfolio.com`
- Password: `testpassword123`

### Google OAuth (Optional)
Configure in Supabase Dashboard > Authentication > Providers

## 📊 Database Schema

### Core Tables
- `transactions` - All portfolio transactions
- `symbols` - Asset symbols (public + user custom)
- `user_symbol_prices` - Manual price overrides
- `portfolio_snapshots` - Historical portfolio values

### Supported Transaction Types
- `buy` - Asset purchases
- `sell` - Asset sales  
- `dividend` - Dividend payments
- `bonus` - Free shares received
- `deposit` - Cash additions
- `withdrawal` - Cash withdrawals

### Supported Asset Types
- `stock` - Public stocks
- `etf` - Exchange-traded funds
- `crypto` - Cryptocurrencies  
- `real_estate` - Real estate holdings
- `cash` - Cash positions
- `other` - Custom assets (collectibles, private equity, etc.)

## 🎯 Next Steps

### Phase 1 Enhancements
- [ ] Transaction CRUD operations
- [ ] Symbol search and autocomplete
- [ ] Manual price update interface
- [ ] Real Supabase integration
- [ ] Mobile-optimized forms

### Phase 2 Features
- [ ] Charts and visualizations
- [ ] Performance analytics (XIRR, drawdown)
- [ ] Price refresh automation
- [ ] Import/export functionality
- [ ] Notification system

## 💡 Usage Tips

1. **Custom Assets**: Use descriptive symbols like `MY_HOUSE` or `ROLEX_COLLECTION`
2. **Manual Pricing**: Perfect for real estate, collectibles, private investments
3. **Transaction History**: Record all historical transactions for accurate P&L
4. **Mobile First**: Designed for mobile use with PWA installation

## 🔧 Technical Notes

- **PWA Ready**: Installable on mobile devices
- **Offline Support**: Works without internet connection
- **Type Safe**: Full TypeScript coverage
- **Responsive**: Mobile-first design with desktop support
- **Scalable**: Built for personal use, easily extensible

## 📝 License

Personal project - use as you wish!

---

Built with ❤️ for personal portfolio tracking