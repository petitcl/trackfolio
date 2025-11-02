import type { AuthUser } from '@/lib/auth/client.auth.service'
import { clientAuthService } from '@/lib/auth/client.auth.service'
import { getClientMockDataStore } from '@/lib/mockDataStoreClient'
import { createClient } from '@/lib/supabase/client'
import { portfolioService } from './portfolio.service'
import type { Symbol } from '@/lib/supabase/types'

/**
 * Service responsible for exporting user data to CSV format
 * Exports match the import formats exactly for round-trip compatibility
 */
export class ExportService {
  private supabase = createClient()

  /**
   * Export all holdings (market, custom, and account)
   * Format matches multiBulkHoldingImportConfig
   * Columns: holding_type,symbol,name,asset_type,currency,account_type,provider,initial_value,start_date
   */
  async exportHoldings(user: AuthUser): Promise<string> {
    const symbols = await portfolioService.getSymbols(user)
    const positions = await portfolioService.getPositions(user)

    // Filter to only symbols that have positions
    const positionSymbols = new Set(positions.map(p => p.symbol))
    const activeSymbols = symbols.filter(s => positionSymbols.has(s.symbol))

    const rows: string[] = [
      'holding_type,symbol,name,asset_type,currency,account_type,provider,initial_value,start_date'
    ]

    for (const symbol of activeSymbols) {
      if (symbol.holding_type === 'account') {
        // Account holding
        const metadata = symbol.metadata as any
        const accountType = metadata?.account_type || ''
        const provider = metadata?.provider || ''

        // Get initial balance from first user_symbol_price entry
        const initialData = await this.getInitialAccountData(user, symbol.symbol)

        rows.push([
          'account',
          symbol.symbol,
          symbol.name,
          '', // asset_type not used for accounts
          symbol.currency,
          accountType,
          provider || '',
          initialData.initialValue.toString(),
          initialData.startDate
        ].join(','))
      } else if (symbol.is_custom) {
        // Custom holding
        rows.push([
          'custom',
          symbol.symbol,
          symbol.name,
          symbol.asset_type,
          symbol.currency,
          '', // account_type
          '', // provider
          '', // initial_value
          ''  // start_date
        ].join(','))
      } else {
        // Market holding
        rows.push([
          'market',
          symbol.symbol,
          symbol.name,
          symbol.asset_type,
          symbol.currency,
          '', // account_type
          '', // provider
          '', // initial_value
          ''  // start_date
        ].join(','))
      }
    }

    return rows.join('\n')
  }

  /**
   * Get initial account data (first balance entry)
   */
  private async getInitialAccountData(user: AuthUser, symbol: string): Promise<{ initialValue: number, startDate: string }> {
    if (clientAuthService.isCurrentUserMock()) {
      const mockStore = getClientMockDataStore()
      const prices = mockStore.getUserSymbolPrices(symbol)
      const firstPrice = prices[prices.length - 1] // oldest first

      return {
        initialValue: firstPrice?.manual_price || 0,
        startDate: firstPrice?.price_date || new Date().toISOString().split('T')[0]
      }
    }

    try {
      const { data } = await this.supabase
        .from('user_symbol_prices')
        .select('manual_price, price_date')
        .eq('user_id', user.id)
        .eq('symbol', symbol)
        .order('price_date', { ascending: true })
        .limit(1)
        .single()

      return {
        initialValue: data?.manual_price || 0,
        startDate: data?.price_date || new Date().toISOString().split('T')[0]
      }
    } catch {
      return {
        initialValue: 0,
        startDate: new Date().toISOString().split('T')[0]
      }
    }
  }

  /**
   * Export all transactions
   * Format matches multiBulkTransactionImportConfig
   * Columns: symbol,name,type,date,quantity,fees,price_per_unit,amount,currency,broker,comments
   */
  async exportTransactions(user: AuthUser): Promise<string> {
    const transactions = await portfolioService.getTransactions(user)
    const symbols = await portfolioService.getSymbols(user)
    const symbolMap = new Map(symbols.map(s => [s.symbol, s]))

    const rows: string[] = [
      'symbol,name,type,date,quantity,fees,price_per_unit,amount,currency,broker,comments'
    ]

    for (const tx of transactions) {
      const symbol = symbolMap.get(tx.symbol)
      const symbolName = symbol?.name || tx.symbol

      rows.push([
        tx.symbol,
        this.escapeCsv(symbolName),
        tx.type,
        tx.date,
        tx.quantity.toString(),
        (tx.fees ?? 0).toString(),
        tx.price_per_unit.toString(),
        tx.amount?.toString() || '',
        tx.currency,
        this.escapeCsv(tx.broker || ''),
        this.escapeCsv(tx.notes || '')
      ].join(','))
    }

    return rows.join('\n')
  }

  /**
   * Export all price history (includes account balance history)
   * Format matches multiBulkPriceImportConfig
   * Columns: symbol,name,date,price,notes
   * Note: This includes both regular price history AND account balance history from user_symbol_prices
   */
  async exportPriceHistory(user: AuthUser): Promise<string> {
    const symbols = await portfolioService.getSymbols(user)
    const rows: string[] = [
      'symbol,name,date,price,notes'
    ]

    if (clientAuthService.isCurrentUserMock()) {
      const mockStore = getClientMockDataStore()

      for (const symbol of symbols) {
        const prices = mockStore.getUserSymbolPrices(symbol.symbol)

        for (const price of prices) {
          rows.push([
            symbol.symbol,
            this.escapeCsv(symbol.name),
            price.price_date,
            price.manual_price.toString(),
            this.escapeCsv(price.notes || '')
          ].join(','))
        }
      }
    } else {
      const { data: prices } = await this.supabase
        .from('user_symbol_prices')
        .select('symbol, price_date, manual_price, notes')
        .eq('user_id', user.id)
        .order('symbol', { ascending: true })
        .order('price_date', { ascending: true })

      if (prices) {
        const symbolMap = new Map(symbols.map(s => [s.symbol, s]))

        for (const price of prices) {
          const symbol = symbolMap.get(price.symbol)

          rows.push([
            price.symbol,
            this.escapeCsv(symbol?.name || price.symbol),
            price.price_date,
            price.manual_price.toString(),
            this.escapeCsv(price.notes || '')
          ].join(','))
        }
      }
    }

    return rows.join('\n')
  }


  /**
   * Escape CSV values (handle commas, quotes, newlines)
   */
  private escapeCsv(value: string): string {
    if (!value) return ''

    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }

    return value
  }

  /**
   * Generate a complete data export as a ZIP file
   * Returns a Blob containing all CSV files
   */
  async exportAllData(user: AuthUser): Promise<Blob> {
    const [holdings, transactions, priceHistory] = await Promise.all([
      this.exportHoldings(user),
      this.exportTransactions(user),
      this.exportPriceHistory(user)
    ])

    // Use JSZip to create ZIP file
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()

    zip.file('holdings.csv', holdings)
    zip.file('transactions.csv', transactions)
    zip.file('price_history.csv', priceHistory)

    return await zip.generateAsync({ type: 'blob' })
  }

  /**
   * Trigger download of the export ZIP file
   */
  async downloadExport(user: AuthUser): Promise<void> {
    const blob = await this.exportAllData(user)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trackfolio-export-${new Date().toISOString().split('T')[0]}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}

// Export singleton instance
export const exportService = new ExportService()
