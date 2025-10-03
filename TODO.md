# Trackfolio Todo List
Mark done item with ✅

## TODO P1
- ✅ Fix Annualized Return = -100% for some closed positions
- ✅ Prevent page reload when changing "show closed positions"
- [ ] Improve page load speed
- [ ] Implement portfolio export and backup functionality
- [ ] Add infinite scrolling to transaction history
- [ ] Update timerange changes to affect other metrics correctly
- [ ] Fix annualized return calculation (use money weighted?)
- [ ] Update portfolio P&L and annualized returns to reflect selected timeframe
- [ ] Redirect custom holding creation to holding detail page instead of homepage
- [ ] Allow editing of custom holding details

## TODO P2
- [ ] Style delete buttons for holdings, prices, and transactions as red/danger
- [ ] Add performance view per period bucket showing 2024, 2025 performance separately
- [ ] Remove requirement for price = 0 transactions and simplify custom holding creation
- [ ] Fix holding details quantity rounding error transforming 1.00 to 0.99998
- [ ] Add multi custom holding CSV import functionality from home page
- [ ] Refresh page when adding or editing custom prices or transactions on holding page
- [ ] Implement live price updates using Yahoo Finance API
- [ ] Add cursor pointer and hover states to all buttons

## TODO P3
- [ ] Improve flow for creating new symbols: either autocomplete for existing symbols only, or create symbols on the fly
- [ ] Add support for custom tags / labels on holdings + filtering by label
- [ ] Improve support for cash positions
- [ ] Implement automatic database backups
- [ ] Add unit tests for portfolio services logic
- [ ] Enhance font selection and typography
- [ ] Implement admin functionality
- [ ] Re-enable turbopack after resolving monorepo setup conflicts
