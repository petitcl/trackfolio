/**
 * Types and interfaces for modular price data providers
 */

export type SymbolType = 'stock' | 'crypto' | 'currency'
export type BaseCurrency = 'USD' | 'EUR'

export interface PriceData {
  symbol: string
  date: string
  open_price?: number
  high_price?: number
  low_price?: number
  close_price: number
  volume?: number
  adjusted_close?: number
  data_source: string
  symbol_type?: SymbolType
  base_currency?: BaseCurrency
  provider?: string // Track which provider returned this data
}

export interface DailyPriceResponse {
  symbol: string
  price: number
  lastUpdated: string
  provider?: string // Track which provider was used
}

export interface SymbolSearchResult {
  symbol: string
  name: string
  type: string
  region: string
  marketOpen: string
  marketClose: string
  timezone: string
  currency: string
  matchScore: string
  provider?: string // Track which provider returned this result
}

export interface PriceProviderError {
  provider: string
  error: Error
  isRateLimit: boolean
}

/**
 * Base interface for price data providers
 */
export interface IPriceProvider {
  name: string
  enabled: boolean
  
  /**
   * Fetch current quote for a symbol
   */
  fetchCurrentQuote(
    symbol: string, 
    symbolType: SymbolType, 
    baseCurrency?: BaseCurrency
  ): Promise<DailyPriceResponse | null>
  
  /**
   * Fetch historical daily prices for a symbol
   */
  fetchHistoricalPrices(
    symbol: string, 
    symbolType: SymbolType, 
    baseCurrency?: BaseCurrency,
    outputSize?: 'compact' | 'full'
  ): Promise<PriceData[]>
  
  /**
   * Search for symbols
   */
  searchSymbols(keywords: string): Promise<SymbolSearchResult[]>
  
  /**
   * Check if provider is available/configured
   */
  isAvailable(): boolean
  
  /**
   * Get rate limit delay for this provider
   */
  getRateLimitDelay(): number
}

/**
 * Configuration for the waterfall price service
 */
export interface WaterfallConfig {
  providers: IPriceProvider[]
  enableRetries: boolean
  maxRetries: number
  retryDelay: number
}