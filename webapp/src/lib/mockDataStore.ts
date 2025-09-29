import { mockTransactions, mockSymbols } from './mockData'
import type { Transaction, Symbol } from './supabase/types'
import { MOCK_USER_ID, MOCK_DATA_STORAGE_KEY } from './constants/mockConstants'

const STORAGE_KEY = MOCK_DATA_STORAGE_KEY

interface StoredMockData {
  transactions: Transaction[]
  symbols: Symbol[]
  lastTransactionId: number
}

// Create a singleton store for mock data that can be modified at runtime
class MockDataStore {
  private static instance: MockDataStore | null = null
  private transactions: Transaction[] = []
  private symbols: Symbol[] = []
  private lastTransactionId: number = 0
  private initialized: boolean = false

  private constructor() {
    // Don't initialize in constructor to avoid SSR issues
  }
  
  private initialize() {
    if (this.initialized) return
    
    // Try to load from localStorage first
    const storedData = this.loadFromLocalStorage()
    
    if (storedData) {
      // Use stored data if available
      this.transactions = storedData.transactions
      this.symbols = storedData.symbols
      this.lastTransactionId = storedData.lastTransactionId
      console.log('📦 Loaded mock data from localStorage')
    } else {
      // Initialize with the static mock data
      this.transactions = [...mockTransactions]
      this.symbols = [...mockSymbols]
      // Find the highest transaction ID to continue from
      this.lastTransactionId = Math.max(...mockTransactions.map(t => 
        parseInt(t.id.replace('mock-transaction-', ''))
      ))
      // Save initial data to localStorage
      this.saveToLocalStorage()
      console.log('📦 Initialized mock data from code and saved to localStorage')
    }
    
    this.initialized = true
  }

  private loadFromLocalStorage(): StoredMockData | null {
    if (typeof window === 'undefined') return null
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored) as StoredMockData
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error)
    }
    return null
  }

  private saveToLocalStorage(): void {
    if (typeof window === 'undefined') return
    
    try {
      const dataToStore: StoredMockData = {
        transactions: this.transactions,
        symbols: this.symbols,
        lastTransactionId: this.lastTransactionId
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore))
      console.log('💾 Saved mock data to localStorage')
    } catch (error) {
      console.error('Error saving to localStorage:', error)
    }
  }

  static getInstance(): MockDataStore {
    // Only create instance on client side
    if (typeof window === 'undefined') {
      // Return a dummy instance for SSR
      return new MockDataStore()
    }
    
    if (!MockDataStore.instance) {
      MockDataStore.instance = new MockDataStore()
      MockDataStore.instance.initialize()
    }
    return MockDataStore.instance
  }

  // Get all transactions
  getTransactions(): Transaction[] {
    this.initialize()
    return [...this.transactions]
  }

  // Get all symbols
  getSymbols(): Symbol[] {
    this.initialize()
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
    this.initialize()
    // Check if symbol exists, if not add it
    const existingSymbol = this.symbols.find(s => s.symbol === holding.symbol.toUpperCase())
    
    if (!existingSymbol) {
      const newSymbol: Symbol = {
        symbol: holding.symbol.toUpperCase(),
        name: holding.name,
        asset_type: holding.assetType as any,
        is_custom: holding.isCustom,
        created_by_user_id: holding.isCustom ? MOCK_USER_ID : null,
        last_price: holding.purchasePrice,
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString(),
        currency: 'USD'
      }
      this.symbols.push(newSymbol)
    }

    // Create a buy transaction for the holding
    this.lastTransactionId++
    const newTransaction: Transaction = {
      id: `mock-transaction-${this.lastTransactionId}`,
      user_id: MOCK_USER_ID,
      symbol: holding.symbol.toUpperCase(),
      type: 'buy',
      quantity: holding.quantity,
      price_per_unit: holding.purchasePrice,
      date: holding.purchaseDate,
      notes: holding.notes || null,
      fees: 0,
      amount: null,
      currency: 'USD',
      broker: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    this.transactions.push(newTransaction)
    
    // Save to localStorage
    this.saveToLocalStorage()
    
    // Log for debugging
    console.log('📈 Added new holding to mock data:', {
      symbol: holding.symbol,
      transaction: newTransaction
    })
  }

  // Add a transaction directly
  addTransaction(transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): void {
    this.initialize()
    this.lastTransactionId++
    const newTransaction: Transaction = {
      ...transaction,
      id: `mock-transaction-${this.lastTransactionId}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    this.transactions.push(newTransaction)
    
    // Save to localStorage
    this.saveToLocalStorage()
  }

  // Update a symbol's price
  updateSymbolPrice(symbol: string, price: number): void {
    this.initialize()
    const symbolToUpdate = this.symbols.find(s => s.symbol === symbol)
    if (symbolToUpdate) {
      symbolToUpdate.last_price = price
      symbolToUpdate.last_updated = new Date().toISOString()
      
      // Save to localStorage
      this.saveToLocalStorage()
    }
  }

  // Reset to original mock data (useful for testing)
  reset(): void {
    this.initialize()
    this.transactions = [...mockTransactions]
    this.symbols = [...mockSymbols]
    this.lastTransactionId = Math.max(...mockTransactions.map(t => 
      parseInt(t.id.replace('mock-transaction-', ''))
    ))
    
    // Save reset data to localStorage
    this.saveToLocalStorage()
    
    console.log('🔄 Reset mock data to original values')
  }
  
  // Clear localStorage completely
  clearLocalStorage(): void {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.removeItem(STORAGE_KEY)
      console.log('🗑️ Cleared mock data from localStorage')
    } catch (error) {
      console.error('Error clearing localStorage:', error)
    }
  }
}

export const mockDataStore = MockDataStore.getInstance()