// Client-side only mock data store wrapper
import { mockTransactions, mockSymbols } from './mockData'
import type { Transaction, Symbol } from './supabase/database.types'
import { MOCK_USER_ID, MOCK_DATA_STORAGE_KEY } from './constants/mockConstants'

const STORAGE_KEY = MOCK_DATA_STORAGE_KEY

interface StoredMockData {
  transactions: Transaction[]
  symbols: Symbol[]
  lastTransactionId: number
}

class ClientMockDataStore {
  private transactions: Transaction[] = []
  private symbols: Symbol[] = []
  private lastTransactionId: number = 0
  private initialized: boolean = false

  constructor() {
    // Initialize immediately in constructor since this is client-only
    if (typeof window !== 'undefined') {
      this.initialize()
    }
  }
  
  private initialize() {
    if (this.initialized || typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored) as StoredMockData
        this.transactions = data.transactions
        this.symbols = data.symbols
        this.lastTransactionId = data.lastTransactionId
        console.log('📦 Loaded mock data from localStorage:', {
          transactions: this.transactions.length,
          symbols: this.symbols.length
        })
      } else {
        // Initialize with the static mock data
        this.transactions = [...mockTransactions]
        this.symbols = [...mockSymbols]
        this.lastTransactionId = Math.max(...mockTransactions.map(t => 
          parseInt(t.id.replace('mock-transaction-', ''))
        ))
        this.saveToLocalStorage()
        console.log('📦 Initialized mock data from code and saved to localStorage')
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error)
      // Fallback to mock data
      this.transactions = [...mockTransactions]
      this.symbols = [...mockSymbols]
      this.lastTransactionId = Math.max(...mockTransactions.map(t => 
        parseInt(t.id.replace('mock-transaction-', ''))
      ))
    }
    
    this.initialized = true
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

  getTransactions(): Transaction[] {
    if (!this.initialized && typeof window !== 'undefined') {
      this.initialize()
    }
    return [...this.transactions]
  }

  getSymbols(): Symbol[] {
    if (!this.initialized && typeof window !== 'undefined') {
      this.initialize()
    }
    return [...this.symbols]
  }

  addTransaction(transaction: {
    symbol: string
    type: 'buy' | 'sell' | 'dividend' | 'bonus' | 'deposit' | 'withdrawal'
    quantity: number
    pricePerUnit: number
    date: string
    fees?: number
    currency?: string
    broker?: string | null
    notes?: string | null
  }): Transaction {
    if (!this.initialized && typeof window !== 'undefined') {
      this.initialize()
    }
    
    // Create a new transaction
    this.lastTransactionId++
    const newTransaction: Transaction = {
      id: `mock-transaction-${this.lastTransactionId}`,
      user_id: MOCK_USER_ID,
      symbol: transaction.symbol.toUpperCase(),
      type: transaction.type,
      quantity: transaction.quantity,
      price_per_unit: transaction.pricePerUnit,
      date: transaction.date,
      notes: transaction.notes || null,
      fees: transaction.fees || 0,
      currency: transaction.currency || 'USD',
      broker: transaction.broker || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    this.transactions.push(newTransaction)
    
    // Save to localStorage
    this.saveToLocalStorage()
    
    console.log('📈 Added new transaction to mock data:', {
      symbol: transaction.symbol,
      type: transaction.type,
      transaction: newTransaction
    })
    
    return newTransaction
  }

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
    if (!this.initialized && typeof window !== 'undefined') {
      this.initialize()
    }
    
    // Check if symbol exists, if not add it
    const existingSymbol = this.symbols.find(s => s.symbol === holding.symbol.toUpperCase())
    
    if (!existingSymbol) {
      const newSymbol: Symbol = {
        symbol: holding.symbol.toUpperCase(),
        name: holding.name,
        asset_type: holding.assetType as 'stock' | 'etf' | 'crypto' | 'cash' | 'real_estate' | 'other',
        is_custom: holding.isCustom,
        created_by_user_id: holding.isCustom ? MOCK_USER_ID : null,
        last_price: holding.purchasePrice,
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString()
      }
      this.symbols.push(newSymbol)
    }

    // Create a buy transaction for the holding using the new addTransaction method
    this.addTransaction({
      symbol: holding.symbol,
      type: 'buy',
      quantity: holding.quantity,
      pricePerUnit: holding.purchasePrice,
      date: holding.purchaseDate,
      notes: holding.notes,
      fees: 0,
      currency: 'USD',
      broker: null
    })
    
    console.log('📈 Added new holding to mock data:', {
      symbol: holding.symbol
    })
  }

  reset(): void {
    this.transactions = [...mockTransactions]
    this.symbols = [...mockSymbols]
    this.lastTransactionId = Math.max(...mockTransactions.map(t => 
      parseInt(t.id.replace('mock-transaction-', ''))
    ))
    
    // Save reset data to localStorage
    this.saveToLocalStorage()
    
    console.log('🔄 Reset mock data to original values')
  }
}

// Create a singleton instance that's only initialized on the client
let instance: ClientMockDataStore | null = null

export const getClientMockDataStore = (): ClientMockDataStore => {
  if (typeof window === 'undefined') {
    // Return a dummy for SSR that returns empty data
    return {
      getTransactions: () => [],
      getSymbols: () => [],
      addTransaction: () => ({} as Transaction),
      addHolding: () => {},
      reset: () => {}
    } as ClientMockDataStore
  }
  
  if (!instance) {
    instance = new ClientMockDataStore()
  }
  return instance
}