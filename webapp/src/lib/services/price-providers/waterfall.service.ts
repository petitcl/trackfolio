/**
 * Waterfall price service orchestrator
 * Tries multiple providers in sequence until one succeeds
 */

import { 
  IPriceProvider, 
  SymbolType, 
  BaseCurrency, 
  PriceData, 
  DailyPriceResponse, 
  SymbolSearchResult,
  WaterfallConfig,
  PriceProviderError
} from './types'

export class WaterfallPriceService {
  private config: WaterfallConfig

  constructor(config: WaterfallConfig) {
    this.config = config
  }

  /**
   * Add a provider to the waterfall
   */
  addProvider(provider: IPriceProvider): void {
    this.config.providers.push(provider)
  }

  /**
   * Remove a provider from the waterfall
   */
  removeProvider(providerName: string): void {
    this.config.providers = this.config.providers.filter(p => p.name !== providerName)
  }

  /**
   * Get list of available providers (enabled and configured)
   */
  getAvailableProviders(): IPriceProvider[] {
    return this.config.providers.filter(p => p.enabled && p.isAvailable())
  }

  /**
   * Fetch current quote using waterfall approach
   */
  async fetchCurrentQuote(
    symbol: string, 
    symbolType: SymbolType, 
    baseCurrency: BaseCurrency = 'USD'
  ): Promise<DailyPriceResponse | null> {
    const availableProviders = this.getAvailableProviders()
    const errors: PriceProviderError[] = []

    for (let i = 0; i < availableProviders.length; i++) {
      const provider = availableProviders[i]
      
      try {
        console.log(`[Waterfall] Trying provider ${i + 1}/${availableProviders.length}: ${provider.name} for ${symbol}`)
        
        const result = await provider.fetchCurrentQuote(symbol, symbolType, baseCurrency)
        
        if (result !== null) {
          console.log(`[Waterfall] Success with ${provider.name} for ${symbol}: $${result.price}`)
          return result
        }
        
        console.log(`[Waterfall] No data from ${provider.name} for ${symbol}, trying next provider`)
        
      } catch (error) {
        const providerError: PriceProviderError = {
          provider: provider.name,
          error: error as Error,
          isRateLimit: this.isRateLimitError(error as Error)
        }
        
        errors.push(providerError)
        
        console.warn(`[Waterfall] Provider ${provider.name} failed for ${symbol}:`, error)
        
        // Add delay before trying next provider
        if (i < availableProviders.length - 1) {
          const delay = provider.getRateLimitDelay()
          console.log(`[Waterfall] Waiting ${delay}ms before trying next provider`)
          await this.delay(delay)
        }
      }
    }

    // All providers failed
    console.error(`[Waterfall] All providers failed for ${symbol}. Errors:`, errors)
    
    // If all errors were rate limits, throw a specific error
    if (errors.length > 0 && errors.every(e => e.isRateLimit)) {
      throw new Error(`All price providers are rate limited for symbol: ${symbol}`)
    }
    
    // Otherwise, throw the first error or a generic one
    if (errors.length > 0) {
      throw errors[0].error
    }
    
    return null
  }

  /**
   * Fetch historical prices using waterfall approach
   */
  async fetchHistoricalPrices(
    symbol: string, 
    symbolType: SymbolType, 
    baseCurrency: BaseCurrency = 'USD',
    outputSize: 'compact' | 'full' = 'full'
  ): Promise<PriceData[]> {
    const availableProviders = this.getAvailableProviders()
    const errors: PriceProviderError[] = []

    for (let i = 0; i < availableProviders.length; i++) {
      const provider = availableProviders[i]
      
      try {
        console.log(`[Waterfall] Trying provider ${i + 1}/${availableProviders.length}: ${provider.name} for historical data of ${symbol}`)
        
        const result = await provider.fetchHistoricalPrices(symbol, symbolType, baseCurrency, outputSize)
        
        if (result && result.length > 0) {
          console.log(`[Waterfall] Success with ${provider.name} for ${symbol}: ${result.length} historical records`)
          // Ensure all records have provider information
          return result.map(record => ({ ...record, provider: provider.name }))
        }
        
        console.log(`[Waterfall] No historical data from ${provider.name} for ${symbol}, trying next provider`)
        
      } catch (error) {
        const providerError: PriceProviderError = {
          provider: provider.name,
          error: error as Error,
          isRateLimit: this.isRateLimitError(error as Error)
        }
        
        errors.push(providerError)
        
        console.warn(`[Waterfall] Provider ${provider.name} failed for historical data of ${symbol}:`, error)
        
        // Add delay before trying next provider
        if (i < availableProviders.length - 1) {
          const delay = provider.getRateLimitDelay()
          await this.delay(delay)
        }
      }
    }

    // All providers failed
    console.error(`[Waterfall] All providers failed for historical data of ${symbol}. Errors:`, errors)
    
    if (errors.length > 0 && errors.every(e => e.isRateLimit)) {
      throw new Error(`All price providers are rate limited for symbol: ${symbol}`)
    }
    
    if (errors.length > 0) {
      throw errors[0].error
    }
    
    return []
  }

  /**
   * Search symbols using waterfall approach (combines results from all providers)
   */
  async searchSymbols(keywords: string): Promise<SymbolSearchResult[]> {
    if (!keywords || keywords.trim().length < 1) {
      return []
    }

    const availableProviders = this.getAvailableProviders()
    const allResults: SymbolSearchResult[] = []
    const errors: PriceProviderError[] = []

    for (const provider of availableProviders) {
      try {
        console.log(`[Waterfall] Searching with ${provider.name} for: ${keywords}`)
        
        const results = await provider.searchSymbols(keywords)
        
        if (results && results.length > 0) {
          console.log(`[Waterfall] Found ${results.length} results from ${provider.name}`)
          allResults.push(...results)
        }
        
        // Add delay between providers
        await this.delay(provider.getRateLimitDelay())
        
      } catch (error) {
        const providerError: PriceProviderError = {
          provider: provider.name,
          error: error as Error,
          isRateLimit: this.isRateLimitError(error as Error)
        }
        
        errors.push(providerError)
        console.warn(`[Waterfall] Search failed with ${provider.name}:`, error)
      }
    }

    // Remove duplicates based on symbol
    const uniqueResults = allResults.filter((result, index, arr) => 
      arr.findIndex(r => r.symbol === result.symbol) === index
    )

    // Sort by match score (higher first)
    uniqueResults.sort((a, b) => parseFloat(b.matchScore) - parseFloat(a.matchScore))

    console.log(`[Waterfall] Combined search results: ${uniqueResults.length} unique symbols`)
    
    return uniqueResults
  }

  /**
   * Fetch multiple quotes with intelligent batching and rate limiting
   */
  async fetchMultipleQuotes(
    symbolData: Array<{ symbol: string; symbolType: SymbolType; baseCurrency?: BaseCurrency }>
  ): Promise<Map<string, DailyPriceResponse>> {
    const results = new Map<string, DailyPriceResponse>()

    console.log(`[Waterfall] Fetching quotes for ${symbolData.length} symbols...`)

    for (let i = 0; i < symbolData.length; i++) {
      const { symbol, symbolType, baseCurrency = 'USD' } = symbolData[i]

      try {
        console.log(`[Waterfall] Fetching quote ${i + 1}/${symbolData.length}: ${symbol}`)
        const quote = await this.fetchCurrentQuote(symbol, symbolType, baseCurrency)

        if (quote) {
          results.set(symbol, quote)
        }

        // Add delay between requests to respect rate limits
        if (i < symbolData.length - 1) {
          const availableProviders = this.getAvailableProviders()
          const delay = availableProviders.length > 0 ? availableProviders[0].getRateLimitDelay() : 1000
          console.log(`[Waterfall] Waiting ${delay}ms before next request...`)
          await this.delay(delay)
        }

      } catch (error) {
        console.error(`[Waterfall] Failed to fetch quote for ${symbol}:`, error)

        // Add delay even after errors to avoid rapid retries
        if (i < symbolData.length - 1) {
          const availableProviders = this.getAvailableProviders()
          const delay = availableProviders.length > 0 ? availableProviders[0].getRateLimitDelay() : 1000
          console.log(`[Waterfall] Waiting ${delay}ms after error before next request...`)
          await this.delay(delay)
        }
      }
    }

    console.log(`[Waterfall] Successfully fetched ${results.size}/${symbolData.length} quotes`)
    return results
  }

  /**
   * Check if error is likely a rate limit error
   */
  private isRateLimitError(error: Error): boolean {
    const message = error.message.toLowerCase()
    return message.includes('rate limit') || 
           message.includes('too many requests') || 
           message.includes('429') ||
           message.includes('quota exceeded') ||
           message.includes('api limit')
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Check if stock markets are likely open
   */
  isMarketHours(): boolean {
    const now = new Date()
    const utcHour = now.getUTCHours()
    const dayOfWeek = now.getUTCDay()
    
    // Basic check: Monday-Friday, 9:30 AM - 4:00 PM EST (14:30 - 21:00 UTC)
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5
    const isDuringMarketHours = utcHour >= 14 && utcHour < 21
    
    return isWeekday && isDuringMarketHours
  }

  /**
   * Get provider statistics
   */
  getProviderStats(): Array<{ name: string; enabled: boolean; available: boolean; rateLimitDelay: number }> {
    return this.config.providers.map(provider => ({
      name: provider.name,
      enabled: provider.enabled,
      available: provider.isAvailable(),
      rateLimitDelay: provider.getRateLimitDelay()
    }))
  }
}