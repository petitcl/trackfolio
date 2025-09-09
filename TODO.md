# Trackfolio Todo List

## ✅ Completed Features

### Core Dashboard & Navigation
- ✅ Portfolio overview dashboard with metrics cards
- ✅ Holdings table with asset type grouping and totals  
- ✅ Time range selector with dashboard integration
- ✅ Holding details page with symbol-specific data
- ✅ Navigation between dashboard and holding details
- ✅ Portfolio value evolution chart (reusable component)
- ✅ Portfolio repartition chart (pie chart by asset type)
- ✅ Portfolio history chart with allocation over time
- ✅ QuickActions component (reusable across pages)

### Data & Authentication
- ✅ Supabase integration with PostgreSQL database
- ✅ Demo user authentication for testing
- ✅ Mock data system for development/testing
- ✅ Real transaction data support (buy, sell, dividend, bonus, deposit, withdrawal)
- ✅ Manual price updates for custom assets with full history management
- ✅ Row Level Security (RLS) policies

### Chart & Analytics Features
- ✅ ValueEvolutionChart component (reusable)
- ✅ Time-range dependent performance metrics
- ✅ Cost basis tracking on charts
- ✅ P&L calculations (realized vs unrealized)
- ✅ Portfolio weight calculations
- ✅ Currency formatting and percentage displays
- [ ] Portfolio repartition history is displayed as stacked bars
- [ ] Portfolio repartition history can switch betwen % and absolute value

## 🐛 Bug Fixes
- ✅ Fix the light mode (it still doesn't work)
- ✅ Delete all traces of light theme (incl login page)
- ✅ Fix demo mode outside of development env
- [ ] Make all charts (homepage, holding page) take into account custom prices
- [ ] Revisit all charts styles + logic
- [ ] Add cursor: pointer; hover on all buttons

## 🎯 Priority Features

### Transaction Management
- ✅ **Add Transaction Page** - Form to add new transactions (buy, sell, dividend, etc.)
- ✅ **Add holding transaction csv** - Import transactions for holding via CSV
- ✅ **Edit/Delete Transactions** - Modify existing transaction records
- [ ] **Homepage Bulk Import Transactions** - Multi holding CSV import functionality from home page

### Holding Management  
- ✅ **Add Holding Page**
- ✅ **Add Custom Holding Page** - Form for real estate, collectibles, private equity
- ✅ **Delete Holding** - "Delete Holding" button
- ✅ **Custom Holding Price Management** - Manual price updates with history, CSV import, and full table view
- ✅ Edit + Delete button for both custom prices and transactions
- ✅ Use confirm modal for delete price & delete transactions
- [ ] Infinite scrolling in Transaction History
- [ ] Support for cash positions

### Data & Sync
- ✅ **Daily prices updates** - Daily prices updates
- ✅ **Symbol price backfill**
- ✅ Fix Crypto price update
- [ ] Multi currency support (EUR, USD) -> use symbols?
- [ ] **Data Export** - Portfolio export to CSV
- [ ] **Data Backup/Restore** - Portfolio backup
- [ ] **Database backups** - Automatic Database Backups
- [ ] **Live price Updates** - Live price Updates using Yahoo Finance API

### 🎨 UI/UX Enhancements
- [ ] Hardcoded list of brokers to pick from
- [ ] Creating a custom holding should redirect to holding detail page instead of homepage 
- [ ] Delete holding button should be red / danger
- [ ] Edit custom holding price
- [ ] Enhance fonts
- [ ] Toggle / switch component 


### Security & Reliability  
- [ ] **Input Validation** - Comprehensive form validation
- [ ] **Error Handling** - Better error boundaries and user feedback
- [ ] **Re-enable Turbopack** - re-enable turbopack (currently clashes with monorepo setup)

---

*Last updated: 2025-08-29*
*Current Status: Core dashboard and holding details pages complete. Ready for transaction management features.*