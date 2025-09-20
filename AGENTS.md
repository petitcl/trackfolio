# AGENTS.md

## Project Overview

**Trackfolio** is a personal portfolio tracker PWA built with Next.js and Supabase. It tracks stocks, crypto, real estate, and custom investments with real-time performance metrics.

## Current State

### ✅ Completed Features
- **Full Next.js 14 PWA** with TypeScript, Tailwind CSS, and Supabase integration
- **Authentication system** with Google OAuth and email login
- **Database schema** supporting multi-asset portfolio tracking
- **Mock data system** for testing without database connection
- **Responsive dashboard** showing portfolio overview, P&L, and holdings
- **Custom investments** support (real estate, collectibles, private equity)
- **Manual pricing** system for user-controlled asset valuations
- **Complete transaction management** (buy/sell/dividend/bonus/deposit/withdrawal)

### 🏗️ Architecture
```
trackfolio/
├── webapp/           # Next.js PWA (fully functional)
├── database/         # SQL schemas with sample data
├── docs/            # Specifications and setup guides
└── README.md        # Project documentation
```

### 💾 Database Schema
- `transactions` - All portfolio transactions with full history
- `symbols` - Asset symbols (public market + user custom assets)
- `symbol_price_history` - Daily price history from APIs 
- `user_symbol_prices` - Manual price overrides by users

Supports: stocks, ETFs, crypto, real estate, cash, custom assets

### 🎯 Demo Data
Sample portfolio worth ~$548K including:
- Traditional investments (AAPL, MSFT, BTC, ETH)
- Real estate ($465K house)
- Collectibles (vintage watch $13K)
- Private equity (startup shares)

## Tech Stack

- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Backend**: Supabase (Postgres + Auth + Edge Functions)
- **Authentication**: Google OAuth + email/password
- **PWA**: Installable on mobile, offline support
- **State**: Mock data system + Supabase integration ready

## Environment Setup

### Development
```bash
cd webapp
npm install
npm run dev
```

### Environment Variables (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NODE_ENV=development  # Shows demo login button
```

### Demo Login (Development Only)
- **Email**: test@trackfolio.com
- **Password**: testpassword123
- **Access**: Purple "🚀 Demo Login" button (dev mode only)

## File Structure Deep Dive

### Key Files to Know

#### `/webapp/src/app/`
- `page.tsx` - Main dashboard (auth-protected)
- `login/page.tsx` - Login form with dev demo button
- `layout.tsx` - App shell with PWA metadata

#### `/webapp/src/components/`
- `Dashboard.tsx` - Main portfolio dashboard with mock data

#### `/webapp/src/lib/`
- `supabase/client.ts` - Browser Supabase client
- `supabase/server.ts` - Server Supabase client  
- `supabase/database.types.ts` - Full TypeScript schema
- `mockData.ts` - Demo portfolio data (~$548K sample)

#### `/webapp/src/middleware.ts`
- Auth protection for protected routes
- Automatic redirects for unauthenticated users

#### `/database/`
- `database-setup.sql` - Complete schema with custom types
- `row-level-security.sql` - User isolation policies
- `sample-data.sql` - Test data (must replace TEST_USER_UUID)
- `test-queries.sql` - Portfolio calculation queries

#### `/docs/`
- `spec.md` - Original technical specification  
- `SETUP-INSTRUCTIONS.md` - Database setup guide

## Key Features Implementation

### Authentication Flow
1. Middleware checks auth on protected routes
2. Redirects to `/login` if unauthenticated
3. Google OAuth or email/password login
4. Development demo button bypasses with test credentials

### Portfolio Calculation Logic
- **Current positions**: Calculated from transaction history
- **P&L tracking**: Realized + unrealized gains/losses
- **Manual pricing**: User overrides market prices
- **Multi-currency**: USD default, extensible
- **Asset types**: 6 types including custom real estate/collectibles

### Database Design Patterns
- **RLS policies**: Users only see their own data
- **Custom symbols**: User-created assets (houses, collectibles)
- **Price overrides**: `user_symbol_prices` table for manual valuations
- **Transaction types**: Enum-based with full audit trail

## Next Development Priorities

### Phase 1: Core Functionality
1. **Transaction CRUD** - Add/edit/delete transactions
2. **Symbol search** - Typeahead for public symbols
3. **Manual price updates** - UI for custom asset pricing
4. **Real Supabase integration** - Replace mock data

### Phase 2: Enhanced Features
1. **Charts/visualizations** - Portfolio performance over time
2. **Advanced metrics** - XIRR, drawdown, allocation
3. **Price refresh automation** - Daily market data updates
4. **Import/export** - CSV/JSON data management

### Phase 3: Polish
1. **Mobile optimizations** - PWA enhancements
2. **Offline support** - Better caching strategies
3. **Notifications** - Price alerts, performance updates
4. **Multi-user** - Optional sharing features

## Development Guidelines

### Git Workflow
- **NEVER commit or push automatically** - Only make code changes
- **User commits manually** - Let the user review and commit changes
- **No automatic git operations** - Only use git commands when explicitly requested
- **Exception**: Only commit/push when the user explicitly asks "commit this" or "push this"

### Code Conventions
- **TypeScript strict mode** enabled
- **Tailwind CSS** for all styling (no custom CSS)
- **Server components** for data fetching when possible
- **Client components** only when needed (interactivity)

### Database Patterns
- **Row Level Security** enforced on all tables
- **UUID primary keys** for all entities
- **Timestamps** on all records (created_at, updated_at)
- **Soft deletes** preferred over hard deletes

### Testing Strategy
- **Mock data** system allows full testing without database
- **Sample transactions** cover all edge cases
- **Realistic portfolio** demonstrates all features

#### Portfolio Logic Testing
**IMPORTANT**: When adding tests for portfolio calculations, currency conversion, or position logic, always use these test files:

1. **Primary test file**: `/webapp/src/lib/services/__tests__/portfolio-calculation.service.test.ts`
   - Contains comprehensive tests for all portfolio calculation logic
   - Includes specialized section: "Currency Conversion and Current Price Bug Fixes"
   - Tests for multi-currency support, custom assets, and edge cases

2. **Integration tests**: `/webapp/src/lib/services/__tests__/portfolio-integration.test.ts`
   - Full end-to-end portfolio service testing
   - Cross-service integration validation

**Test Guidelines**:
- Add new portfolio calculation tests to `portfolio-calculation.service.test.ts`
- Use anonymized test data (no real financial information)
- Test both sync and async calculation methods
- Always test currency conversion edge cases
- Include tests for custom assets with manual pricing
- Verify current price fetching from user symbol prices

## Common Tasks

### Adding New Transaction Types
1. Update `transaction_type` enum in `database-setup.sql`
2. Add to TypeScript types in `database.types.ts`
3. Update transaction processing logic
4. Add to mock data for testing

### Adding New Asset Types  
1. Update `asset_type` enum in database schema
2. Update TypeScript types
3. Add icon mapping in Dashboard component
4. Create sample data

### Database Changes
1. Always update SQL files in `/database/`
2. Regenerate TypeScript types if schema changes
3. Update mock data to match new structure
4. Test with sample queries

### Full-Stack Feature Changes
**Critical**: When modifying authentication, environment variables, or configuration that affects both client and server:

1. **Client-side changes** (`/webapp/src/lib/auth/client.auth.service.ts`)
   - Update authentication logic
   - Modify environment variable usage
   - Update localStorage/cookie handling

2. **Server-side changes** (`/webapp/src/lib/auth/server.auth.service.ts`)
   - **ALWAYS update server auth service** to match client changes
   - Ensure same environment variable logic (e.g., `isDemoEnabled` vs `isDevelopment`)
   - Update server-side authentication checks

3. **Middleware updates** (`/webapp/src/middleware.ts`)
   - Update route protection logic
   - Ensure consistency with auth services
   - Update environment variable checks

4. **Build verification**
   - Run `npm run build` after all changes
   - Fix any TypeScript compilation errors
   - Test both development and production modes

**Common mistake**: Updating client-side auth logic but forgetting to update server-side auth service, causing production authentication issues.

## Troubleshooting

### Common Issues
- **Build errors**: Check TypeScript types match database schema
- **Auth issues**: Verify Supabase credentials in `.env.local`
- **Demo login**: Ensure `NODE_ENV=development` is set
- **Mock data**: App works without database - check `mockData.ts`

### Database Connection Issues
- App defaults to mock data if Supabase unreachable
- Check environment variables are correct
- Verify RLS policies allow user access
- Use test queries to validate data

## Contact Context

This is a **personal pet project** for portfolio tracking with:
- **Minimal cost** focus (Supabase free tier)
- **Mobile-first** design (PWA installable)
- **Custom investments** support (real estate, collectibles)
- **Manual pricing** for non-market assets

The project is **production-ready** with comprehensive mock data for immediate testing and a complete database schema for real deployment.