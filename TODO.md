# Trackfolio Todo List
Mark done item with ✅

## TODO P1
- ✅ Multi transaction CSV import functionality from home page
- ✅ Multi custom price CSV import functionality from home page
- ✅ Value Evolution charts takes into account dividends
- ✅ Dashboard - Shows inflated current positions -> race condition occurs, where currency is not loaded before we display the data
- ✅ HoldingDetails - "Performance" should take into account dividends
- ✅ HoldingDetails - "Performance Breakdown" shows >0 "Price appreciation" / "Capital Gains" for positions that do not have Capital Gains
- ✅ HoldingDetails - "Performance Breakdown" should always show Dividends & Capital Gains, regardless if they are 0
- ✅ Dashboard - Return Breakdown - fix Realized Gains vs Unrealized Gains, same for Capital Gains -> showing crazy values
- ✅ HoldingDetails - always show Dividends & Capital Gains, regardless if they are 0
- ✅ Dashboard - Toggle to show closed positions
- ✅ HoldingDetails - "Value Evolution" and "Performance Breakdown" show different total price than Current Position => data comes out like this from portfolio service. Current position seems to have the latest, correct amount to show

## TODO P2
- ✅ Portfolio repartition history can switch betwen % and absolute value
- ✅ Toggle / switch component 
- ✅ Mobile => fix header responsiveness
- ✅ Optimization => don't refetch already fetched data
- ✅ Portfolio Value Evolution - Use day as point legend instead of month
- [ ] MAYBE -> fix "Annualized Return" - not sure how
- [ ] MAYBE -> make timerange change correctly affect other metrics
- [ ] Dashboard - We should show closed holdings, maybe not displayed by default
- [ ] HoldingDetails - Weird rounding error on quantity => sometimes get 1.00 transformed to 0.99998 
- [ ] Multi custom holding CSV import functionality from home page
- [ ] Delete holding / price / tx buttons should be red / danger
- [ ] Hardcoded list of brokers to pick from
- [ ] Portfolio export / backup
- [ ] Allow Bonus with price 0
- [ ] Remove need for transaction with price = 0, simplify custom holding creation
- [ ] Use existing symbols instead of symbol search when adding symbol
- [ ] Cost Basis takes into account currency conversion
- [ ] Creating a custom holding should redirect to holding detail page instead of homepage 
- [ ] Don't reload page when changing "show closed positions"
- [ ] Adding or editing a custom price or transaction in the the holding page should refresh the page
- [ ] Infinite scrolling in Transaction History
- [ ] Add cursor: pointer; hover on all buttons
- [ ] Allow to right click -> open in a new tab holding detail pages on homepage
- [ ] Live price Updates using Yahoo Finance API
- [ ] Some way to see performance per period bucket (eg: ALL shows perf of 2024, 2025, etc..)
- [ ] Better Support for cash positions
- [ ] Allow to edit custom holding details
- [ ] Portfolio P&L and Annualized Returns should show value depending on selected timeframe

## TODO P3
- [ ] Automatic Database Backups
- [ ] Add unit tests to Portfolio Services logic
- [ ] Enhance fonts
- [ ] Admin Stuffs
- [ ] Re-enable turbopack (currently clashes with monorepo setup)
