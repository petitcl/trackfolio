import type { AuthUser } from '@/lib/auth/client.auth.service'
import type { Database } from '@/lib/supabase/types'
import type { CsvImportConfig } from './BulkCsvImport'
import { portfolioService } from '@/lib/services/portfolio.service'
import { accountHoldingService } from '@/lib/services/account-holding.service'

// Transaction Import Configuration
export interface ParsedTransaction {
  symbol: string
  type: Database["public"]["Enums"]["transaction_type"]
  quantity: number
  price_per_unit: number
  date: string
  fees: number
  currency: string
  broker: string | null
  notes: string | null
  amount?: number // For bonus transactions
}

export const transactionImportConfig = (symbol: string): CsvImportConfig<ParsedTransaction> => ({
  title: 'Import Transactions',
  description: `Import multiple transactions for ${symbol} from CSV`,
  columns: [
    { key: 'symbol', label: 'Symbol', required: true },
    { key: 'type', label: 'Type', required: true, description: 'buy, sell, dividend, bonus, deposit, withdrawal' },
    { key: 'quantity', label: 'Quantity', required: true },
    { key: 'price_per_unit', label: 'Price per Unit', required: false, description: 'Not needed for bonus transactions if amount is provided' },
    { key: 'amount', label: 'Amount', required: false, description: 'Total amount for bonus transactions (replaces price_per_unit * quantity)' },
    { key: 'date', label: 'Date', required: true, description: 'YYYY-MM-DD format' },
    { key: 'fees', label: 'Fees', required: false },
    { key: 'currency', label: 'Currency', required: false, description: 'defaults to USD' },
    { key: 'broker', label: 'Broker', required: false },
    { key: 'notes', label: 'Notes', required: false }
  ],
  sampleData: `symbol,type,quantity,price_per_unit,amount,date,fees,currency,broker,notes
${symbol},buy,100,50.00,,2024-01-15,9.99,USD,Interactive Brokers,Initial purchase
${symbol},buy,50,52.50,,2024-02-20,9.99,USD,Interactive Brokers,Additional shares
${symbol},bonus,2,,100.00,2024-02-25,0,USD,Interactive Brokers,Bonus shares
${symbol},sell,25,55.00,,2024-03-10,9.99,USD,Interactive Brokers,Partial sale`,
  parseRow: (values: string[], header: string[]): ParsedTransaction | null => {
    try {
      const amountValue = values[header.indexOf('amount')] || ''
      const pricePerUnitValue = values[header.indexOf('price_per_unit')] || ''
      
      return {
        symbol: values[header.indexOf('symbol')] || symbol,
        type: values[header.indexOf('type')] as Database["public"]["Enums"]["transaction_type"],
        quantity: parseFloat(values[header.indexOf('quantity')]),
        price_per_unit: pricePerUnitValue ? parseFloat(pricePerUnitValue) : 0,
        date: values[header.indexOf('date')],
        fees: parseFloat(values[header.indexOf('fees')] || '0'),
        currency: values[header.indexOf('currency')] || 'USD',
        broker: values[header.indexOf('broker')] || null,
        notes: values[header.indexOf('notes')] || null,
        amount: amountValue ? parseFloat(amountValue) : undefined
      }
    } catch {
      return null
    }
  },
  validateRow: (row: ParsedTransaction, index: number): string | null => {
    if (!row.symbol) {
      return `Row ${index}: Symbol is required`
    }
    if (!['buy', 'sell', 'dividend', 'bonus', 'deposit', 'withdrawal'].includes(row.type)) {
      return `Row ${index}: Invalid transaction type "${row.type}"`
    }
    if (isNaN(row.quantity) || (row.quantity <= 0 && row.type !== 'dividend')) {
      return `Row ${index}: Quantity must be a positive number (except for dividend transactions)`
    }
    
    // For bonus transactions, allow either price_per_unit OR amount
    if (row.type === 'bonus') {
      if ((!row.amount || isNaN(row.amount) || row.amount <= 0) && 
          (isNaN(row.price_per_unit) || row.price_per_unit <= 0)) {
        return `Row ${index}: Bonus transactions require either a positive amount or positive price_per_unit`
      }
    } else if (row.type === 'dividend') {
      // For dividends, price_per_unit can be 0 when quantity is 0 (cash dividends)
      if (isNaN(row.price_per_unit) || row.price_per_unit < 0) {
        return `Row ${index}: Price per unit must be a non-negative number for dividend transactions`
      }
    } else {
      // For other transactions, require positive price_per_unit
      if (isNaN(row.price_per_unit) || row.price_per_unit <= 0) {
        return `Row ${index}: Price per unit must be a positive number`
      }
    }
    if (!row.date || isNaN(new Date(row.date).getTime())) {
      return `Row ${index}: Invalid date format`
    }
    return null
  },
  importRows: async (user: AuthUser, rows: ParsedTransaction[]) => {
    const errors: string[] = []
    let successCount = 0

    for (const row of rows) {
      try {
        // For bonus transactions with amount field, calculate price_per_unit
        let pricePerUnit = row.price_per_unit;
        if (row.type === 'bonus' && row.amount && row.quantity > 0) {
          pricePerUnit = row.amount / row.quantity;
        }
        
        const result = await portfolioService.addTransactionForUser(user, {
          symbol: row.symbol,
          type: row.type,
          quantity: row.quantity,
          pricePerUnit: pricePerUnit,
          date: row.date,
          fees: row.fees,
          currency: row.currency,
          broker: row.broker,
          notes: row.notes
        })

        if (!result.success) {
          errors.push(`Failed to import transaction: ${result.error}`)
        } else {
          successCount++
        }
      } catch (err) {
        errors.push(`Error importing transaction: ${err}`)
      }
    }

    return { success: successCount, errors }
  }
})

// Price Import Configuration
export interface ParsedPrice {
  symbol: string
  price: number
  date: string
  notes: string | null
}

export const priceImportConfig = (symbol: string): CsvImportConfig<ParsedPrice> => ({
  title: 'Import Prices',
  description: `Import multiple price entries for ${symbol} from CSV`,
  columns: [
    { key: 'symbol', label: 'Symbol', required: true },
    { key: 'date', label: 'Date', required: true, description: 'YYYY-MM-DD format' },
    { key: 'price', label: 'Price', required: true },
    { key: 'notes', label: 'Notes', required: false }
  ],
  sampleData: `symbol,date,price,notes
${symbol},2024-01-15,100.00,Initial valuation
${symbol},2024-02-15,105.50,Market update
${symbol},2024-03-15,98.75,Quarterly review`,
  parseRow: (values: string[], header: string[]): ParsedPrice | null => {
    try {
      return {
        symbol: values[header.indexOf('symbol')] || symbol,
        date: values[header.indexOf('date')],
        price: parseFloat(values[header.indexOf('price')]),
        notes: values[header.indexOf('notes')] || null
      }
    } catch {
      return null
    }
  },
  validateRow: (row: ParsedPrice, index: number): string | null => {
    if (!row.symbol) {
      return `Row ${index}: Symbol is required`
    }
    if (!row.date || isNaN(new Date(row.date).getTime())) {
      return `Row ${index}: Invalid date format`
    }
    if (isNaN(row.price) || row.price <= 0) {
      return `Row ${index}: Price must be a positive number`
    }
    return null
  },
  importRows: async (user: AuthUser, rows: ParsedPrice[]) => {
    const errors: string[] = []
    let successCount = 0

    for (const row of rows) {
      try {
        await portfolioService.addUserSymbolPrice(user, {
          symbol: row.symbol,
          manual_price: row.price,
          price_date: row.date,
          notes: row.notes
        })
        successCount++
      } catch (err) {
        errors.push(`Error importing price: ${err}`)
      }
    }

    return { success: successCount, errors }
  }
})

// Multi-Symbol Transaction Import Configuration
export interface ParsedMultiTransaction {
  symbol: string
  type: Database["public"]["Enums"]["transaction_type"]
  quantity: number
  price_per_unit: number
  date: string
  fees: number
  currency: string
  broker: string | null
  notes: string | null
  amount?: number // For bonus transactions
}

export const multiBulkTransactionImportConfig: CsvImportConfig<ParsedMultiTransaction> = {
  title: 'Bulk Import Transactions',
  description: 'Import transactions for multiple symbols from CSV',
  columns: [
    { key: 'symbol', label: 'Symbol', required: true },
    { key: 'name', label: 'Name', required: false, description: 'Human readable name (ignored)' },
    { key: 'type', label: 'Type', required: true, description: 'buy, sell, dividend, bonus, deposit, withdrawal' },
    { key: 'date', label: 'Date', required: true, description: 'YYYY-MM-DD format' },
    { key: 'quantity', label: 'Quantity', required: true },
    { key: 'fees', label: 'Fees', required: false },
    { key: 'price_per_unit', label: 'Price per Unit', required: false, description: 'Not needed for bonus transactions if amount is provided' },
    { key: 'amount', label: 'Amount', required: false, description: 'Total amount for bonus transactions (replaces price_per_unit * quantity)' },
    { key: 'currency', label: 'Currency', required: false, description: 'defaults to USD' },
    { key: 'broker', label: 'Broker', required: false },
    { key: 'comments', label: 'Comments', required: false }
  ],
  sampleData: `symbol,name,type,date,quantity,fees,price_per_unit,amount,currency,broker,comments
AAPL,Apple Inc,buy,2024-01-15,100,9.99,150.00,,USD,Interactive Brokers,Initial purchase
MSFT,Microsoft Corp,buy,2024-01-20,50,9.99,300.00,,USD,Interactive Brokers,Tech position
AAPL,Apple Inc,bonus,2024-01-25,5,0,,750.00,USD,Interactive Brokers,Bonus shares
AAPL,Apple Inc,sell,2024-02-10,25,9.99,160.00,,USD,Interactive Brokers,Partial sale
BTC,Bitcoin,buy,2024-01-25,0.5,25.00,42000.00,,USD,Coinbase,Crypto allocation`,
  parseRow: (values: string[], header: string[]): ParsedMultiTransaction | null => {
    try {
      // Handle price_per_unit with potential comma formatting (e.g., "14,300.00")
      const priceValue = values[header.indexOf('price_per_unit')] || '0'
      const cleanedPrice = priceValue.replace(/"/g, '').replace(/,/g, '')
      
      // Handle amount field
      const amountValue = values[header.indexOf('amount')] || ''
      
      return {
        symbol: values[header.indexOf('symbol')],
        type: values[header.indexOf('type')] as Database["public"]["Enums"]["transaction_type"],
        quantity: parseFloat(values[header.indexOf('quantity')]),
        price_per_unit: cleanedPrice ? parseFloat(cleanedPrice) : 0,
        date: values[header.indexOf('date')],
        fees: parseFloat(values[header.indexOf('fees')] || '0'),
        currency: values[header.indexOf('currency')] || 'USD',
        broker: values[header.indexOf('broker')] || null,
        notes: values[header.indexOf('comments')] || null,
        amount: amountValue ? parseFloat(amountValue.replace(/"/g, '').replace(/,/g, '')) : undefined
      }
    } catch {
      return null
    }
  },
  validateRow: (row: ParsedMultiTransaction, index: number): string | null => {
    if (!row.symbol) {
      return `Row ${index}: Symbol is required`
    }
    if (!['buy', 'sell', 'dividend', 'bonus', 'deposit', 'withdrawal'].includes(row.type)) {
      return `Row ${index}: Invalid transaction type "${row.type}"`
    }
    if (isNaN(row.quantity) || (row.quantity === 0 && row.type !== 'dividend')) {
      return `Row ${index}: Quantity must be a non-zero number (except for dividend transactions)`
    }
    
    // For bonus transactions, allow either price_per_unit OR amount
    if (row.type === 'bonus') {
      if ((!row.amount || isNaN(row.amount) || row.amount <= 0) && 
          (isNaN(row.price_per_unit) || row.price_per_unit <= 0)) {
        return `Row ${index}: Bonus transactions require either a positive amount or positive price_per_unit`
      }
    } else if (row.type === 'dividend') {
      // For dividends, price_per_unit can be 0 when quantity is 0 (cash dividends)
      if (isNaN(row.price_per_unit) || row.price_per_unit < 0) {
        return `Row ${index}: Price per unit must be a non-negative number for dividend transactions`
      }
    } else {
      // For other transactions, require positive price_per_unit
      if (isNaN(row.price_per_unit) || row.price_per_unit <= 0) {
        return `Row ${index}: Price per unit must be a positive number`
      }
    }
    if (!row.date || isNaN(new Date(row.date).getTime())) {
      return `Row ${index}: Invalid date format (use YYYY-MM-DD)`
    }
    return null
  },
  importRows: async (user: AuthUser, rows: ParsedMultiTransaction[]) => {
    const errors: string[] = []
    let successCount = 0

    // First validate all symbols exist
    const uniqueSymbols = [...new Set(rows.map(row => row.symbol))]
    
    // Get all existing symbols
    let existingSymbols: string[] = []
    try {
      const symbols = await portfolioService.getSymbols(user)
      existingSymbols = symbols.map(s => s.symbol)
    } catch (err) {
      errors.push(`Failed to fetch existing symbols: ${err}`)
      return { success: 0, errors }
    }

    // Check which symbols don't exist
    const missingSymbols = uniqueSymbols.filter(symbol => !existingSymbols.includes(symbol))
    if (missingSymbols.length > 0) {
      errors.push(`The following symbols don't exist in your portfolio: ${missingSymbols.join(', ')}. Please add them first.`)
      return { success: 0, errors }
    }

    const symbols = await portfolioService.getSymbols(user)

    // Import all rows
    for (const [rowIndex, row] of rows.entries()) {
      try {
        // For bonus transactions with amount field, calculate price_per_unit
        let pricePerUnit = row.price_per_unit;
        if (row.type === 'bonus' && row.amount && row.quantity > 0) {
          pricePerUnit = row.amount / row.quantity;
        }

        const symbol = symbols.find(s => s.symbol == row.symbol)!!
        const result = await portfolioService.addTransactionForUser(user, {
          symbol: symbol,
          type: row.type,
          quantity: row.quantity,
          pricePerUnit: pricePerUnit,
          date: row.date,
          fees: row.fees,
          currency: row.currency,
          broker: row.broker,
          notes: row.notes
        })

        if (!result.success) {
          errors.push(`Row ${rowIndex + 2}: Failed to import transaction for ${row.symbol} - ${result.error}`)
        } else {
          successCount++
        }
      } catch (err) {
        errors.push(`Row ${rowIndex + 2}: Error importing transaction for ${row.symbol} - ${err}`)
      }
    }

    return { success: successCount, errors }
  }
}

// Account Balance Import Configuration
export interface ParsedAccountBalance {
  symbol: string
  date: string
  balance: number
  notes: string | null
}

export const accountBalanceImportConfig = (symbol: string): CsvImportConfig<ParsedAccountBalance> => ({
  title: 'Import Account Balances',
  description: `Import multiple account balance entries for ${symbol} from CSV`,
  columns: [
    { key: 'symbol', label: 'Symbol', required: true },
    { key: 'date', label: 'Date', required: true, description: 'YYYY-MM-DD format' },
    { key: 'balance', label: 'Balance', required: true },
    { key: 'notes', label: 'Notes', required: false }
  ],
  sampleData: `symbol,date,balance,notes
${symbol},2024-01-15,10000.00,Initial balance
${symbol},2024-02-15,10250.50,Monthly update
${symbol},2024-03-15,10180.75,Quarterly review`,
  parseRow: (values: string[], header: string[]): ParsedAccountBalance | null => {
    try {
      // Handle balance with potential comma formatting (e.g., "10,000.00")
      const balanceValue = values[header.indexOf('balance')] || '0'
      const cleanedBalance = balanceValue.replace(/"/g, '').replace(/,/g, '')

      return {
        symbol: values[header.indexOf('symbol')] || symbol,
        date: values[header.indexOf('date')],
        balance: parseFloat(cleanedBalance),
        notes: values[header.indexOf('notes')] || null
      }
    } catch {
      return null
    }
  },
  validateRow: (row: ParsedAccountBalance, index: number): string | null => {
    if (!row.symbol) {
      return `Row ${index}: Symbol is required`
    }
    if (!row.date || isNaN(new Date(row.date).getTime())) {
      return `Row ${index}: Invalid date format`
    }
    if (isNaN(row.balance) || row.balance <= 0) {
      return `Row ${index}: Balance must be a positive number`
    }
    return null
  },
  importRows: async (user: AuthUser, rows: ParsedAccountBalance[]) => {
    const errors: string[] = []
    let successCount = 0

    // Get all symbols to validate the account exists
    const symbols = await portfolioService.getSymbols(user)
    const targetSymbol = symbols.find(s => s.symbol === rows[0]?.symbol)

    if (!targetSymbol) {
      errors.push('Account symbol not found in portfolio')
      return { success: 0, errors }
    }

    // Check if this is an account holding
    if (!accountHoldingService.isAccountHolding(targetSymbol)) {
      errors.push('This symbol is not an account holding. Balance import only works for account holdings.')
      return { success: 0, errors }
    }

    // Process each row
    for (const [rowIndex, row] of rows.entries()) {
      try {
        // Simply store the balance snapshot - no quantity calculation needed
        await accountHoldingService.updateAccountBalance(user, {
          symbol: row.symbol,
          newBalance: row.balance,
          date: row.date,
          notes: row.notes || undefined
        })

        successCount++
      } catch (err) {
        errors.push(`Row ${rowIndex + 2}: Error importing balance - ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return { success: successCount, errors }
  }
})

// Multi-Symbol Price Import Configuration
export interface ParsedMultiPrice {
  symbol: string
  price: number
  date: string
  notes: string | null
}

export const multiBulkPriceImportConfig: CsvImportConfig<ParsedMultiPrice> = {
  title: 'Bulk Import Prices',
  description: 'Import prices for multiple symbols from CSV',
  columns: [
    { key: 'symbol', label: 'Symbol', required: true },
    { key: 'name', label: 'Name', required: false, description: 'Human readable name (ignored)' },
    { key: 'date', label: 'Date', required: true, description: 'YYYY-MM-DD format' },
    { key: 'price', label: 'Price', required: true },
    { key: 'notes', label: 'Notes', required: false }
  ],
  sampleData: `symbol,name,date,price,notes
MY_HOUSE,My House,2024-01-15,465000.00,Recent appraisal
VINTAGE_WATCH,Vintage Watch,2024-01-15,13200.00,Professional valuation
BTC,Bitcoin,2024-01-15,45000.00,Personal price target
STARTUP_XYZ,Startup XYZ,2024-01-15,60.00,Series B valuation`,
  parseRow: (values: string[], header: string[]): ParsedMultiPrice | null => {
    try {
      // Handle price with potential comma formatting (e.g., "465,000.00")
      const priceValue = values[header.indexOf('price')] || '0'
      const cleanedPrice = priceValue.replace(/"/g, '').replace(/,/g, '')
      
      return {
        symbol: values[header.indexOf('symbol')],
        date: values[header.indexOf('date')],
        price: parseFloat(cleanedPrice),
        notes: values[header.indexOf('notes')] || null
      }
    } catch {
      return null
    }
  },
  validateRow: (row: ParsedMultiPrice, index: number): string | null => {
    if (!row.symbol) {
      return `Row ${index}: Symbol is required`
    }
    if (!row.date || isNaN(new Date(row.date).getTime())) {
      return `Row ${index}: Invalid date format (use YYYY-MM-DD)`
    }
    if (isNaN(row.price) || row.price <= 0) {
      return `Row ${index}: Price must be a positive number`
    }
    return null
  },
  importRows: async (user: AuthUser, rows: ParsedMultiPrice[]) => {
    const errors: string[] = []
    let successCount = 0

    // First validate all symbols exist
    const uniqueSymbols = [...new Set(rows.map(row => row.symbol))]
    
    // Get all existing symbols
    let existingSymbols: string[] = []
    try {
      const symbols = await portfolioService.getSymbols(user)
      existingSymbols = symbols.map(s => s.symbol)
    } catch (err) {
      errors.push(`Failed to fetch existing symbols: ${err}`)
      return { success: 0, errors }
    }

    // Check which symbols don't exist
    const missingSymbols = uniqueSymbols.filter(symbol => !existingSymbols.includes(symbol))
    if (missingSymbols.length > 0) {
      errors.push(`The following symbols don't exist in your portfolio: ${missingSymbols.join(', ')}. Please add them first.`)
      return { success: 0, errors }
    }

    // Import all rows
    for (const [rowIndex, row] of rows.entries()) {
      try {
        await portfolioService.addUserSymbolPrice(user, {
          symbol: row.symbol,
          manual_price: row.price,
          price_date: row.date,
          notes: row.notes
        })
        successCount++
      } catch (err) {
        errors.push(`Row ${rowIndex + 2}: Error importing price for ${row.symbol} - ${err}`)
      }
    }

    return { success: successCount, errors }
  }
}