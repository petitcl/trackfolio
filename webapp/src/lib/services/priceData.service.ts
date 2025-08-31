/**
 * Service for fetching market price data from external APIs
 * Uses waterfall approach with multiple providers:
 * 1. Alpha Vantage (primary)
 * 2. Yahoo Finance (backup)
 */

import { 
  AlphaVantageProvider, 
  YahooFinanceProvider, 
  WaterfallPriceService,
  SymbolType,
  BaseCurrency,
  PriceData,
  DailyPriceResponse,
  SymbolSearchResult
} from './price-providers'

// Re-export types for backward compatibility
export type { SymbolType, BaseCurrency, PriceData, DailyPriceResponse, SymbolSearchResult }

class PriceDataService {
  private waterfallService: WaterfallPriceService

  constructor() {
    // Initialize providers in waterfall order (Alpha Vantage first, Yahoo Finance as backup)
    const alphaVantageProvider = new AlphaVantageProvider()
    const yahooFinanceProvider = new YahooFinanceProvider()
    
    this.waterfallService = new WaterfallPriceService({
      providers: [alphaVantageProvider, yahooFinanceProvider],
      enableRetries: true,
      maxRetries: 2,
      retryDelay: 1000
    })
    
    // Log available providers
    const availableProviders = this.waterfallService.getAvailableProviders()
    console.log(`[PriceDataService] Available providers: ${availableProviders.map(p => p.name).join(', ')}`)
    
    if (availableProviders.length === 0) {
      console.warn('[PriceDataService] No price providers are available! Check your API keys.')
    }
  }


  /**
   * Fetch current quote for a symbol using waterfall approach
   * @param symbol The ticker symbol (e.g., 'AAPL', 'BTC', 'ETH')
   * @param symbolType The type of symbol ('stock', 'crypto', 'etf')
   * @param baseCurrency The base currency for pricing (defaults to 'USD')
   */
  async fetchCurrentQuote(
    symbol: string, 
    symbolType: SymbolType, 
    baseCurrency: BaseCurrency = 'USD'
  ): Promise<DailyPriceResponse | null> {
    return this.waterfallService.fetchCurrentQuote(symbol, symbolType, baseCurrency)
  }

  /**
   * Fetch historical daily prices for a symbol using waterfall approach
   * @param symbol The ticker symbol (e.g., 'AAPL', 'BTC', 'ETH')
   * @param symbolType The type of symbol ('stock', 'crypto', 'etf')
   * @param baseCurrency The base currency for pricing (defaults to 'USD')
   * @param outputSize 'compact' (last 100 days) or 'full' (20+ years)
   */
  async fetchHistoricalPrices(
    symbol: string, 
    symbolType: SymbolType, 
    baseCurrency: BaseCurrency = 'USD',
    outputSize: 'compact' | 'full' = 'full'
  ): Promise<PriceData[]> {
    return this.waterfallService.fetchHistoricalPrices(symbol, symbolType, baseCurrency, outputSize)
  }

  /**
   * Get multiple quotes in batch using waterfall approach
   * Automatically handles rate limits and failover between providers
   */
  async fetchMultipleQuotes(
    symbolData: Array<{ symbol: string; symbolType: SymbolType; baseCurrency?: BaseCurrency }>
  ): Promise<Map<string, DailyPriceResponse>> {
    return this.waterfallService.fetchMultipleQuotes(symbolData)
  }

  /**
   * Check if stock markets are likely open
   */
  isMarketHours(): boolean {
    return this.waterfallService.isMarketHours()
  }



  /**
   * Search for symbols using waterfall approach (combines results from all providers)
   * @param keywords Search term (company name, ticker, etc.)
   */
  async searchSymbols(keywords: string): Promise<SymbolSearchResult[]> {
    return this.waterfallService.searchSymbols(keywords)
  }



  /**
   * Get provider statistics for monitoring
   */
  getProviderStats(): Array<{ name: string; enabled: boolean; available: boolean; rateLimitDelay: number }> {
    return this.waterfallService.getProviderStats()
  }

  /**
   * Add a new provider to the waterfall
   */
  addProvider(provider: any): void {
    this.waterfallService.addProvider(provider)
  }

  /**
   * Remove a provider from the waterfall
   */
  removeProvider(providerName: string): void {
    this.waterfallService.removeProvider(providerName)
  }
}

// Export singleton instance
export const priceDataService = new PriceDataService()