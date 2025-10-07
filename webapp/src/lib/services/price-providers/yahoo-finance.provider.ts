/**
 * Yahoo Finance price data provider
 * Uses unofficial yahoo-finance2 API
 */

import yahooFinance from 'yahoo-finance2'
import { 
  IPriceProvider, 
  SymbolType, 
  BaseCurrency, 
  PriceData, 
  DailyPriceResponse, 
  SymbolSearchResult 
} from './types'

export class YahooFinanceProvider implements IPriceProvider {
  public readonly name = 'yahoo_finance'
  public readonly enabled = true

  constructor() {
    // Configure yahoo-finance2 options if needed
    yahooFinance.setGlobalConfig({
      validation: {
        logErrors: true,
        logOptionsErrors: false
      }
    })
    yahooFinance.suppressNotices(['yahooSurvey', 'ripHistorical'])
  }

  isAvailable(): boolean {
    // Yahoo Finance doesn't require API key, but we should check if the module is working
    return true
  }

  getRateLimitDelay(): number {
    // Yahoo Finance unofficial API - be conservative to avoid getting blocked
    return 1000 // 1 second delay between requests
  }

  async fetchCurrentQuote(
    symbol: string, 
    symbolType: SymbolType, 
    baseCurrency: BaseCurrency = 'USD'
  ): Promise<DailyPriceResponse | null> {
    try {
      const yahooSymbol = this.convertToYahooSymbol(symbol, symbolType)
      
      const quote = await yahooFinance.quote(yahooSymbol)
      
      if (!quote || typeof quote.regularMarketPrice !== 'number') {
        return null
      }

      // Convert Yahoo's date format
      const lastUpdated = quote.regularMarketTime && typeof quote.regularMarketTime === 'number'
        ? new Date(quote.regularMarketTime * 1000).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]

      return {
        symbol: symbol,
        price: quote.regularMarketPrice,
        lastUpdated,
        provider: this.name
      }
    } catch (error) {
      console.error(`[${this.name}] Error fetching quote for ${symbol}:`, error)
      throw error
    }
  }

  async fetchHistoricalPrices(
    symbol: string, 
    symbolType: SymbolType, 
    baseCurrency: BaseCurrency = 'USD',
    outputSize: 'compact' | 'full' = 'full'
  ): Promise<PriceData[]> {
    try {
      const yahooSymbol = this.convertToYahooSymbol(symbol, symbolType)
      
      // Determine date range based on outputSize
      const endDate = new Date()
      const startDate = new Date()
      
      if (outputSize === 'compact') {
        startDate.setDate(endDate.getDate() - 100) // ~100 days
      } else {
        startDate.setFullYear(endDate.getFullYear() - 5) // 5 years for full
      }

      const chartData = await yahooFinance.chart(yahooSymbol, {
        period1: startDate,
        period2: endDate,
        interval: '1d'
      })

      if (!chartData || !chartData.quotes || chartData.quotes.length === 0) {
        return []
      }

      const prices: PriceData[] = chartData.quotes.map(day => ({
        symbol,
        date: day.date.toISOString().split('T')[0],
        open_price: day.open || undefined,
        high_price: day.high || undefined,
        low_price: day.low || undefined,
        close_price: day.close || 0,
        adjusted_close: day.adjclose || day.close || 0,
        volume: day.volume || undefined,
        data_source: this.name,
        symbol_type: symbolType,
        base_currency: baseCurrency,
        provider: this.name
      }))

      return prices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    } catch (error) {
      console.error(`[${this.name}] Error fetching historical prices for ${symbol}:`, error)
      throw error
    }
  }

  async searchSymbols(keywords: string): Promise<SymbolSearchResult[]> {
    if (!keywords || keywords.trim().length < 1) {
      return []
    }

    try {
      const searchResults = await yahooFinance.search(keywords, {
        quotesCount: 10,
        newsCount: 0
      })

      if (!searchResults.quotes || searchResults.quotes.length === 0) {
        return []
      }

      return searchResults.quotes
        .filter(quote => (quote as any).symbol) // Only include results with symbol property
        .map(quote => ({
          symbol: (quote as any).symbol || '',
          name: (quote as any).longname || (quote as any).shortname || '',
          type: this.mapYahooTypeToGeneric((quote as any).quoteType || ''),
          region: (quote as any).region || '',
          marketOpen: '09:30', // Default market hours
          marketClose: '16:00',
          timezone: (quote as any).exchangeTimezoneShortName || 'EST',
          currency: (quote as any).currency || 'USD',
          matchScore: (quote as any).score?.toString() || '1.0',
          provider: this.name
        }))
        .filter(result => result.symbol && result.name)
    } catch (error) {
      console.error(`[${this.name}] Error searching symbols:`, error)
      return []
    }
  }

  /**
   * Convert generic symbol to Yahoo Finance format
   */
  private convertToYahooSymbol(symbol: string, symbolType: SymbolType): string {
    switch (symbolType) {
      case 'crypto':
        // Yahoo uses format like BTC-USD, ETH-USD
        return symbol.includes('-') ? symbol : `${symbol}-USD`
      
      case 'currency':
        // Convert EURUSD to EUR=X format
        if (symbol.length === 6) {
          const from = symbol.slice(0, 3)
          const to = symbol.slice(3, 6)
          return `${from}${to}=X`
        }
        return symbol
      
      case 'stock':
      default:
        // Most stocks work as-is, but some international ones might need suffixes
        return symbol
    }
  }

  /**
   * Map Yahoo Finance quote types to our generic types
   */
  private mapYahooTypeToGeneric(yahooType: string): string {
    switch (yahooType.toLowerCase()) {
      case 'equity':
        return 'Stock'
      case 'cryptocurrency':
        return 'Cryptocurrency'
      case 'currency':
        return 'Currency'
      case 'mutualfund':
        return 'Mutual Fund'
      case 'index':
        return 'Index'
      default:
        return yahooType
    }
  }
}