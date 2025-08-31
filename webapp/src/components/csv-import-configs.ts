import type { AuthUser } from '@/lib/auth/client.auth.service'
import type { Database } from '@/lib/supabase/types'
import type { CsvImportConfig } from './BulkCsvImport'
import { portfolioService } from '@/lib/services/portfolio.service'

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
}

export const transactionImportConfig = (symbol: string): CsvImportConfig<ParsedTransaction> => ({
  title: 'Import Transactions',
  description: `Import multiple transactions for ${symbol} from CSV`,
  columns: [
    { key: 'symbol', label: 'Symbol', required: true },
    { key: 'type', label: 'Type', required: true, description: 'buy, sell, dividend, bonus, deposit, withdrawal' },
    { key: 'quantity', label: 'Quantity', required: true },
    { key: 'price_per_unit', label: 'Price per Unit', required: true },
    { key: 'date', label: 'Date', required: true, description: 'YYYY-MM-DD format' },
    { key: 'fees', label: 'Fees', required: false },
    { key: 'currency', label: 'Currency', required: false, description: 'defaults to USD' },
    { key: 'broker', label: 'Broker', required: false },
    { key: 'notes', label: 'Notes', required: false }
  ],
  sampleData: `symbol,type,quantity,price_per_unit,date,fees,currency,broker,notes
${symbol},buy,100,50.00,2024-01-15,9.99,USD,Interactive Brokers,Initial purchase
${symbol},buy,50,52.50,2024-02-20,9.99,USD,Interactive Brokers,Additional shares
${symbol},sell,25,55.00,2024-03-10,9.99,USD,Interactive Brokers,Partial sale`,
  parseRow: (values: string[], header: string[]): ParsedTransaction | null => {
    try {
      return {
        symbol: values[header.indexOf('symbol')] || symbol,
        type: values[header.indexOf('type')] as Database["public"]["Enums"]["transaction_type"],
        quantity: parseFloat(values[header.indexOf('quantity')]),
        price_per_unit: parseFloat(values[header.indexOf('price_per_unit')]),
        date: values[header.indexOf('date')],
        fees: parseFloat(values[header.indexOf('fees')] || '0'),
        currency: values[header.indexOf('currency')] || 'USD',
        broker: values[header.indexOf('broker')] || null,
        notes: values[header.indexOf('notes')] || null
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
    if (isNaN(row.quantity) || row.quantity <= 0) {
      return `Row ${index}: Quantity must be a positive number`
    }
    if (isNaN(row.price_per_unit) || row.price_per_unit <= 0) {
      return `Row ${index}: Price per unit must be a positive number`
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
        const result = await portfolioService.addTransactionForUser(user, {
          symbol: row.symbol,
          type: row.type,
          quantity: row.quantity,
          pricePerUnit: row.price_per_unit,
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