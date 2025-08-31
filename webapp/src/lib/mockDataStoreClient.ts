// Client-side only mock data store wrapper
import { mockTransactions, mockSymbols } from './mockData'
import type { Transaction, Symbol, UserSymbolPrice } from './supabase/types'
import { MOCK_USER_ID, MOCK_DATA_STORAGE_KEY } from './constants/mockConstants'

const STORAGE_KEY = MOCK_DATA_STORAGE_KEY

interface StoredMockData {
  transactions: Transaction[]
  symbols: Symbol[]
  userSymbolPrices: UserSymbolPrice[]
  lastTransactionId: number
}

class ClientMockDataStore {
  private transactions: Transaction[] = []
  private symbols: Symbol[] = []
  private userSymbolPrices: UserSymbolPrice[] = []
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
        this.userSymbolPrices = data.userSymbolPrices || []
        this.lastTransactionId = data.lastTransactionId
        console.log('📦 Loaded mock data from localStorage:', {
          transactions: this.transactions.length,
          symbols: this.symbols.length
        })
      } else {
        // Initialize with the static mock data
        this.transactions = [...mockTransactions]
        this.symbols = [...mockSymbols]
        this.userSymbolPrices = [] // Start with empty price history
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
        userSymbolPrices: this.userSymbolPrices,
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
    currency: string
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
        created_at: new Date().toISOString(),
        currency: holding.currency
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

  updateTransaction(id: string, updates: {
    type?: 'buy' | 'sell' | 'dividend' | 'bonus' | 'deposit' | 'withdrawal'
    quantity?: number
    pricePerUnit?: number
    date?: string
    fees?: number
    currency?: string
    broker?: string | null
    notes?: string | null
  }): boolean {
    if (!this.initialized && typeof window !== 'undefined') {
      this.initialize()
    }
    
    const transactionIndex = this.transactions.findIndex(t => t.id === id)
    if (transactionIndex === -1) {
      console.error('Transaction not found for update:', id)
      return false
    }
    
    // Update the transaction
    this.transactions[transactionIndex] = {
      ...this.transactions[transactionIndex],
      type: updates.type || this.transactions[transactionIndex].type,
      quantity: updates.quantity !== undefined ? updates.quantity : this.transactions[transactionIndex].quantity,
      price_per_unit: updates.pricePerUnit !== undefined ? updates.pricePerUnit : this.transactions[transactionIndex].price_per_unit,
      date: updates.date || this.transactions[transactionIndex].date,
      fees: updates.fees !== undefined ? updates.fees : this.transactions[transactionIndex].fees,
      currency: updates.currency || this.transactions[transactionIndex].currency,
      broker: updates.broker !== undefined ? updates.broker : this.transactions[transactionIndex].broker,
      notes: updates.notes !== undefined ? updates.notes : this.transactions[transactionIndex].notes,
      updated_at: new Date().toISOString()
    }
    
    // Save to localStorage
    this.saveToLocalStorage()
    
    console.log('📝 Updated transaction in mock data:', id)
    return true
  }

  deleteTransaction(id: string): boolean {
    if (!this.initialized && typeof window !== 'undefined') {
      this.initialize()
    }
    
    const transactionIndex = this.transactions.findIndex(t => t.id === id)
    if (transactionIndex === -1) {
      console.error('Transaction not found for deletion:', id)
      return false
    }
    
    // Remove the transaction
    this.transactions.splice(transactionIndex, 1)
    
    // Save to localStorage
    this.saveToLocalStorage()
    
    console.log('🗑️ Deleted transaction from mock data:', id)
    return true
  }

  getUserSymbolPrices(symbol: string): UserSymbolPrice[] {
    if (!this.initialized && typeof window !== 'undefined') {
      this.initialize()
    }
    
    return this.userSymbolPrices
      .filter(price => price.symbol === symbol.toUpperCase())
      .sort((a, b) => new Date(b.price_date).getTime() - new Date(a.price_date).getTime())
  }

  async addUserSymbolPrice(priceData: UserSymbolPrice): Promise<void> {
    if (!this.initialized && typeof window !== 'undefined') {
      this.initialize()
    }
    
    // Add the new price entry
    this.userSymbolPrices.push(priceData)
    
    // Update the symbol's last_price with the latest price
    const symbolToUpdate = this.symbols.find(s => s.symbol === priceData.symbol.toUpperCase())
    if (symbolToUpdate) {
      symbolToUpdate.last_price = priceData.manual_price
      symbolToUpdate.last_updated = new Date().toISOString()
    }
    
    // Save to localStorage
    this.saveToLocalStorage()
    
    console.log('💰 Added price entry to mock data:', {
      symbol: priceData.symbol,
      price: priceData.manual_price,
      date: priceData.price_date
    })
  }

  async updateUserSymbolPrice(priceId: string, updates: {
    manual_price: number
    price_date: string
    notes?: string | null
    updated_at: string
  }): Promise<void> {
    if (!this.initialized && typeof window !== 'undefined') {
      this.initialize()
    }
    
    const priceIndex = this.userSymbolPrices.findIndex(price => price.id === priceId)
    if (priceIndex === -1) {
      console.error('Price entry not found for update:', priceId)
      throw new Error('Price entry not found')
    }
    
    const existingPrice = this.userSymbolPrices[priceIndex]
    
    // Update the price entry
    this.userSymbolPrices[priceIndex] = {
      ...existingPrice,
      manual_price: updates.manual_price,
      price_date: updates.price_date,
      notes: updates.notes || null,
      updated_at: updates.updated_at
    }
    
    // Update the symbol's last_price if this is the most recent price for this symbol
    const symbolPrices = this.userSymbolPrices
      .filter(p => p.symbol === existingPrice.symbol)
      .sort((a, b) => new Date(b.price_date).getTime() - new Date(a.price_date).getTime())
    
    const symbolToUpdate = this.symbols.find(s => s.symbol === existingPrice.symbol)
    if (symbolToUpdate && symbolPrices.length > 0) {
      symbolToUpdate.last_price = symbolPrices[0].manual_price
      symbolToUpdate.last_updated = new Date().toISOString()
    }
    
    // Save to localStorage
    this.saveToLocalStorage()
    
    console.log(`Updated price entry for ${existingPrice.symbol}: ${updates.manual_price} on ${updates.price_date}`)
  }

  async deleteUserSymbolPrice(priceId: string): Promise<void> {
    if (!this.initialized && typeof window !== 'undefined') {
      this.initialize()
    }
    
    const priceIndex = this.userSymbolPrices.findIndex(price => price.id === priceId)
    if (priceIndex === -1) {
      console.error('Price entry not found for deletion:', priceId)
      return
    }
    
    const deletedPrice = this.userSymbolPrices[priceIndex]
    
    // Remove the price entry
    this.userSymbolPrices.splice(priceIndex, 1)
    
    // If we deleted a price entry, update the symbol's last_price to the most recent remaining price
    const remainingPrices = this.userSymbolPrices
      .filter(p => p.symbol === deletedPrice.symbol)
      .sort((a, b) => new Date(b.price_date).getTime() - new Date(a.price_date).getTime())
    
    const symbolToUpdate = this.symbols.find(s => s.symbol === deletedPrice.symbol)
    if (symbolToUpdate && remainingPrices.length > 0) {
      symbolToUpdate.last_price = remainingPrices[0].manual_price
      symbolToUpdate.last_updated = new Date().toISOString()
    }
    
    // Save to localStorage
    this.saveToLocalStorage()
    
    console.log('🗑️ Deleted price entry from mock data:', priceId)
  }

  reset(): void {
    this.transactions = [...mockTransactions]
    this.symbols = [...mockSymbols]
    this.userSymbolPrices = [] // Reset price history
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
      updateTransaction: () => false,
      deleteTransaction: () => false,
      addHolding: () => {},
      getUserSymbolPrices: () => [],
      addUserSymbolPrice: async () => {},
      deleteUserSymbolPrice: async () => {},
      reset: () => {}
    } as unknown as ClientMockDataStore
  }
  
  if (!instance) {
    instance = new ClientMockDataStore()
  }
  return instance
}