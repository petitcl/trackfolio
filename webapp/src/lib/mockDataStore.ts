import { mockTransactions, mockSymbols, type MockTransaction, type MockSymbol } from './mockData'
import type { Transaction, Symbol } from './supabase/database.types'

// Create a singleton store for mock data that can be modified at runtime
class MockDataStore {
  private static instance: MockDataStore
  private transactions: Transaction[]
  private symbols: Symbol[]
  private lastTransactionId: number

  private constructor() {
    // Initialize with the static mock data
    this.transactions = [...mockTransactions]
    this.symbols = [...mockSymbols]
    // Find the highest transaction ID to continue from
    this.lastTransactionId = Math.max(...mockTransactions.map(t => 
      parseInt(t.id.replace('mock-transaction-', ''))
    ))
  }

  static getInstance(): MockDataStore {
    if (!MockDataStore.instance) {
      MockDataStore.instance = new MockDataStore()
    }
    return MockDataStore.instance
  }

  // Get all transactions
  getTransactions(): Transaction[] {
    return [...this.transactions]
  }

  // Get all symbols
  getSymbols(): Symbol[] {
    return [...this.symbols]
  }

  // Add a new holding (creates both symbol if needed and transaction)
  addHolding(holding: {
    symbol: string
    name: string
    assetType: string
    quantity: number
    purchasePrice: number
    purchaseDate: string
    notes?: string
    isCustom: boolean
  }): void {
    // Check if symbol exists, if not add it
    const existingSymbol = this.symbols.find(s => s.symbol === holding.symbol.toUpperCase())
    
    if (!existingSymbol) {
      const newSymbol: Symbol = {
        symbol: holding.symbol.toUpperCase(),
        name: holding.name,
        asset_type: holding.assetType as any,
        is_custom: holding.isCustom,
        created_by_user_id: holding.isCustom ? 'mock-user-id' : null,
        last_price: holding.purchasePrice,
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString()
      }
      this.symbols.push(newSymbol)
    }

    // Create a buy transaction for the holding
    this.lastTransactionId++
    const newTransaction: Transaction = {
      id: `mock-transaction-${this.lastTransactionId}`,
      user_id: 'mock-user-id',
      symbol: holding.symbol.toUpperCase(),
      transaction_type: 'buy',
      quantity: holding.quantity,
      price: holding.purchasePrice,
      amount: holding.quantity * holding.purchasePrice,
      transaction_date: holding.purchaseDate,
      notes: holding.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    this.transactions.push(newTransaction)
    
    // Log for debugging
    console.log('📈 Added new holding to mock data:', {
      symbol: holding.symbol,
      transaction: newTransaction
    })
  }

  // Add a transaction directly
  addTransaction(transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): void {
    this.lastTransactionId++
    const newTransaction: Transaction = {
      ...transaction,
      id: `mock-transaction-${this.lastTransactionId}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    this.transactions.push(newTransaction)
  }

  // Update a symbol's price
  updateSymbolPrice(symbol: string, price: number): void {
    const symbolToUpdate = this.symbols.find(s => s.symbol === symbol)
    if (symbolToUpdate) {
      symbolToUpdate.last_price = price
      symbolToUpdate.last_updated = new Date().toISOString()
    }
  }

  // Reset to original mock data (useful for testing)
  reset(): void {
    this.transactions = [...mockTransactions]
    this.symbols = [...mockSymbols]
    this.lastTransactionId = Math.max(...mockTransactions.map(t => 
      parseInt(t.id.replace('mock-transaction-', ''))
    ))
  }
}

export const mockDataStore = MockDataStore.getInstance()