---
  Proposal: Account-Level Holdings UI Support

  Overview

  Add UI support for tracking external account balances (like Binance, Coinbase, traditional brokerages) as aggregate holdings, where the user tracks the total account value rather than individual transactions within the account.

  Core Concept

  Users can create a special "account" type holding that:
  - Represents the entire account as a single position
  - Tracks value changes through periodic snapshots
  - Handles deposits/withdrawals as cash flows
  - Automatically calculates performance metrics (cost basis, returns, P&L)

  ---
  UI Components to Add/Modify

  1. Enhanced "Add Holding" Flow

  Location: /webapp/src/app/add-holding/page.tsx

  Replace the current tab/switch interface with a select dropdown as the first field:

  ┌─────────────────────────────────────────────────────┐
  │ Holding Type                                         │
  │ ┌─────────────────────────────────────────────────┐ │
  │ │ [Account Holding ▼]                              │ │
  │ └─────────────────────────────────────────────────┘ │
  │   Options: Market Asset, Custom Asset,              │
  │            Account Holding                           │
  └─────────────────────────────────────────────────────┘

  When "Account Holding" is selected, show additional fields:

  ┌─────────────────────────────────────────────────────┐
  │ Symbol/Name                                          │
  │ ┌─────────────────────────────────────────────────┐ │
  │ │ e.g., BINANCE_TRADING                           │ │
  │ └─────────────────────────────────────────────────┘ │
  │ ℹ️  This will be used as the symbol identifier      │
  │                                                      │
  │ Account Type                                         │
  │ ┌─────────────────────────────────────────────────┐ │
  │ │ [Crypto Exchange ▼]                              │ │
  │ └─────────────────────────────────────────────────┘ │
  │   Options: Crypto Exchange, Stock Broker,          │
  │            Retirement Account, Bank Account         │
  │                                                      │
  │ Provider (Optional)                                  │
  │ ┌─────────────────────────────────────────────────┐ │
  │ │ e.g., Binance, Coinbase, Fidelity...            │ │
  │ └─────────────────────────────────────────────────┘ │
  │                                                      │
  │ Currency                                             │
  │ ┌─────────────────────────────────────────────────┐ │
  │ │ [USD ▼]                                          │ │
  │ └─────────────────────────────────────────────────┘ │
  │                                                      │
  │ Current Account Value                                │
  │ ┌─────────────────────────────────────────────────┐ │
  │ │ $ 10,000.00                                      │ │
  │ └─────────────────────────────────────────────────┘ │
  │                                                      │
  │ Starting Date                                        │
  │ ┌─────────────────────────────────────────────────┐ │
  │ │ 2024-01-01                                       │ │
  │ └─────────────────────────────────────────────────┘ │
  │                                                      │
  │    [Create Account Holding]  [Cancel]               │
  └─────────────────────────────────────────────────────┘

  Behind the scenes, this creates:
  1. Custom symbol using the user-entered name (e.g., BINANCE_TRADING)
  2. Symbol record: asset_type: 'other', is_custom: true, holding_type: 'account'
  3. Symbol metadata storing account_type and provider in new metadata JSONB field
  4. Initial transaction: type: 'buy', quantity: initial_value, price_per_unit: 1
  5. Initial price entry in user_symbol_prices

  ---
  2. Account Holding Detail Page - Enhanced Transaction UI

  Location: Modify /webapp/src/components/HoldingDetails.tsx and /webapp/src/components/AddTransactionForm.tsx

  Detect if holding is an "account" type by checking the symbol's holding_type field.

  In the standard "Add Transaction" form, when the selected symbol has holding_type='account':
  - Show transaction type dropdown with options: Buy, Sell, Dividend, Deposit, Withdrawal
  - For Deposit and Withdrawal, automatically calculate quantity based on current price per unit
  - Show helper text explaining the calculation

  Additionally, add a standalone "Update Balance" button for account holdings:

  2.1 Update Balance Button

  Opens modal:

  ┌──────────────────────────────────────────────────┐
  │  Update Account Balance                          │
  ├──────────────────────────────────────────────────┤
  │                                                   │
  │  Current Holdings: 10,000.00 units @ $1.20       │
  │  Current Value: $12,000.00                       │
  │                                                   │
  │  New Account Balance                              │
  │  ┌──────────────────────────────────────────────┐│
  │  │ $ 14,500.00                                   ││
  │  └──────────────────────────────────────────────┘│
  │                                                   │
  │  Snapshot Date                                    │
  │  ┌──────────────────────────────────────────────┐│
  │  │ 2024-02-15                                    ││
  │  └──────────────────────────────────────────────┘│
  │                                                   │
  │  ℹ️  This updates the price per unit to $1.45     │
  │     Your 10,000 units will be worth $14,500      │
  │                                                   │
  │     [Update Balance]  [Cancel]                    │
  └──────────────────────────────────────────────────┘

  Behind the scenes:
  - Fetches current position (quantity of units)
  - Calculates new price_per_unit = new_balance / current_quantity
  - Inserts into user_symbol_prices table

  2.2 Deposit & Withdrawal in Add Transaction Form

  When adding a transaction for an account holding, the existing "Add Transaction" form detects
  holding_type='account' and shows Deposit/Withdrawal as transaction type options.

  For a Deposit transaction:
  ┌──────────────────────────────────────────────────┐
  │  Add Transaction                                  │
  ├──────────────────────────────────────────────────┤
  │  Transaction Type                                 │
  │  ┌──────────────────────────────────────────────┐│
  │  │ [Deposit ▼]                                   ││
  │  └──────────────────────────────────────────────┘│
  │                                                   │
  │  Amount                                           │
  │  ┌──────────────────────────────────────────────┐│
  │  │ $ 5,000.00                                    ││
  │  └──────────────────────────────────────────────┘│
  │                                                   │
  │  Date                                             │
  │  ┌──────────────────────────────────────────────┐│
  │  │ 2024-02-01                                    ││
  │  └──────────────────────────────────────────────┘│
  │                                                   │
  │  ℹ️  Current price: $1.20/unit                    │
  │     This will add 4,166.67 units                 │
  │                                                   │
  │  Notes (optional)                                 │
  │  ┌──────────────────────────────────────────────┐│
  │  │ Wire transfer from checking                   ││
  │  └──────────────────────────────────────────────┘│
  │                                                   │
  │     [Add Transaction]  [Cancel]                   │
  └──────────────────────────────────────────────────┘

  Behind the scenes:
  - Fetches latest price per unit from user_symbol_prices
  - Calculates quantity = amount / current_price_per_unit
  - Creates transaction: type: 'deposit', calculated quantity, current price

  Withdrawal works identically but with type: 'withdrawal' and subtracts units.

  ---
  3. Account Holding Display (Dashboard & Holding Detail)

  **PARKED FOR NOW** - Will revisit UI enhancements after core functionality is working.

  ---
  Implementation Plan

  Phase 0: Database Schema Changes

  1. Add `holding_type` field to symbols table:
     ```sql
     ALTER TABLE symbols ADD COLUMN holding_type TEXT DEFAULT 'standard';
     ```
     Values: 'standard' (default), 'account'

  2. Add `metadata` JSONB field to symbols table for storing account-specific data:
     ```sql
     ALTER TABLE symbols ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
     ```

     For account holdings, metadata will contain:
     ```json
     {
       "account_type": "crypto_exchange" | "stock_broker" | "retirement" | "bank",
       "provider": "Binance" | "Coinbase" | "Fidelity" | etc.
     }
     ```

  3. Update TypeScript types in database.types.ts to reflect new fields

  Phase 1: Backend Support

  1. Helper functions in new service: /webapp/src/lib/services/account-holding.service.ts

  interface AccountHoldingMetadata {
    account_type: 'crypto_exchange' | 'stock_broker' | 'retirement' | 'bank'
    provider?: string
  }

  class AccountHoldingService {
    // Detect if a symbol is an account holding (check holding_type field)
    isAccountHolding(symbolData: Symbol): boolean

    // Get current price per unit for account
    async getCurrentPricePerUnit(user: AuthUser, symbol: string): Promise<number>

    // Calculate units to add for deposit
    calculateDepositUnits(depositAmount: number, currentPricePerUnit: number): number

    // Calculate new price per unit after balance update
    calculateNewPricePerUnit(newBalance: number, currentQuantity: number): number

    // Create initial account holding
    async createAccountHolding(user: AuthUser, params: {
      symbol: string  // User-entered name (e.g., BINANCE_TRADING)
      displayName: string  // Display name for UI
      accountType: 'crypto_exchange' | 'stock_broker' | 'retirement' | 'bank'
      provider?: string
      currency: string
      initialValue: number
      startDate: string
    }): Promise<void>

    // Update account balance
    async updateAccountBalance(user: AuthUser, symbol: string, newBalance: number, date: string): Promise<void>

    // Record deposit
    async recordDeposit(user: AuthUser, symbol: string, amount: number, date: string, notes?: string): Promise<void>

    // Record withdrawal
    async recordWithdrawal(user: AuthUser, symbol: string, amount: number, date: string, notes?: string): Promise<void>
  }

  Phase 2: UI Components

  1. Modify /webapp/src/app/add-holding/page.tsx
    - Replace tabs with "Holding Type" select dropdown (first field)
    - Show account-specific form fields when "Account Holding" is selected
    - Wire up to accountHoldingService.createAccountHolding()
  2. Create /webapp/src/components/UpdateBalanceModal.tsx
    - Modal for updating account balance
    - Shows current position and calculates new price per unit
    - Real-time preview
  3. Modify /webapp/src/components/AddTransactionForm.tsx
    - Detect if symbol has holding_type='account'
    - Show Deposit/Withdrawal in transaction type dropdown for account holdings
    - Auto-calculate quantity for deposits/withdrawals based on current price
    - Show helper text explaining the calculation
  4. Modify /webapp/src/components/HoldingDetails.tsx
    - Add "Update Balance" button for account holdings
    - Keep existing "Add Transaction" button (works for deposits/withdrawals)

  Phase 3: Polish

  1. Transaction History Display
    - Show deposits/withdrawals with clearer labeling
    - Show balance snapshots timeline
  2. Bulk Import Support
    - CSV import for account balance history
    - Format: date,balance or date,deposit_amount or date,withdrawal_amount
  3. Smart Notifications
    - "It's been 30 days since you updated [Account]. Update balance?"
    - Remind user to record deposits/withdrawals

  ---
  Example User Flow

  Creating Account Holding

  1. User clicks "Add Position" from dashboard
  2. Selects "Holding Type" → "Account Holding" from dropdown
  3. Fills in:
    - Symbol/Name: "BINANCE_TRADING"
    - Display Name: "Binance Trading Account"
    - Account Type: "Crypto Exchange"
    - Provider: "Binance"
    - Currency: USD
    - Current Value: $10,000
    - Date: 2024-01-01
  4. Clicks "Create Account Holding"
  5. System creates symbol "BINANCE_TRADING" with:
     - holding_type: 'account'
     - metadata: { account_type: 'crypto_exchange', provider: 'Binance' }
  6. Creates initial transaction: buy 10,000 units @ $1.00
  7. Redirects to holding detail page

  Recording a Deposit

  1. User goes to holding detail page for BINANCE_TRADING
  2. Clicks "Add Transaction"
  3. Selects transaction type: "Deposit" (shown because holding_type='account')
  4. Enters deposit amount: $5,000
  5. Selects date: 2024-02-15
  5. System shows preview: "Adding 4,166.67 units @ $1.20"
  6. User confirms
  7. Transaction created: type: 'deposit', quantity: 4166.67, price_per_unit: 1.20

  Updating Balance

  1. User checks Binance, sees account is now worth $17,500
  2. On holding detail page, clicks "Update Balance" button
  3. Modal opens showing current position
  4. Enters new balance: $17,500
  5. Selects date: 2024-03-01
  6. System shows preview: "Price per unit will update to $1.235"
  7. User confirms
  8. Entry added to user_symbol_prices: price: 1.235, date: 2024-03-01

  Viewing Performance

  Dashboard and holding detail automatically show:
  - Total Value: $17,500
  - Cost Basis: $15,000 (initial $10k + $5k deposit)
  - Unrealized P&L: +$2,500 (+16.67%)
  - TWR, XIRR properly calculated considering cash flows

  ---
  Benefits

  ✅ Minimal database changes - Just 2 new fields on existing symbols table
  ✅ Reuses existing calculation logic - deposit/withdrawal already supported
  ✅ Clean abstraction - Account holdings are just special symbols
  ✅ Flexible - Works for any account type (exchange, broker, retirement, bank)
  ✅ Accurate performance tracking - Proper cost basis and return metrics
  ✅ User-friendly - Simple UI abstracts the technical details
  ✅ Integrates seamlessly - Uses existing Add Transaction flow

  ---
  Files to Create/Modify

  Database Updates

  - /database/migrations/01-database-setup.sql - Edit setup script to add the new column(s)

  New Files

  - /webapp/src/lib/services/account-holding.service.ts - Core logic
  - /webapp/src/components/modals/UpdateBalanceModal.tsx - Balance update modal

  Modified Files

  - /webapp/src/app/add-holding/page.tsx - Add holding type dropdown & account fields
  - /webapp/src/components/AddTransactionForm.tsx - Add deposit/withdrawal for accounts
  - /webapp/src/components/HoldingDetails.tsx - Add "Update Balance" button for accounts
  - /webapp/src/lib/supabase/database.types.ts - Update types for new fields

  ---
  Next Steps

  1. ✅ Review this proposal - Get feedback on approach
  2. Implement Phase 1 (backend service)
  3. Implement Phase 2 (UI components)
  4. Test with real Binance data
  5. Polish & add Phase 3 features

