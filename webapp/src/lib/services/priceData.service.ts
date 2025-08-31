/**
 * Service for fetching market price data from external APIs
 * Currently supports Alpha Vantage API for stocks and cryptocurrencies
 */

export type SymbolType = 'stock' | 'crypto' | 'etf'
export type BaseCurrency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY' | 'CAD' | 'AUD'

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
}

export interface DailyPriceResponse {
  symbol: string
  price: number
  lastUpdated: string
}

class PriceDataService {
  private readonly apiKey: string
  private readonly baseUrl = 'https://www.alphavantage.co/query'

  constructor() {
    this.apiKey = process.env.ALPHA_VANTAGE_API_KEY || ''
    
    if (!this.apiKey) {
      console.warn('ALPHA_VANTAGE_API_KEY not configured')
    }
  }

  /**
   * Fetch cryptocurrency data using DIGITAL_CURRENCY_DAILY
   */
  private async fetchCryptocurrencyData(symbol: string, baseCurrency: BaseCurrency = 'USD'): Promise<PriceData[]> {
    const url = `${this.baseUrl}?function=DIGITAL_CURRENCY_DAILY&symbol=${symbol}&market=${baseCurrency}&apikey=${this.apiKey}`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    // Check for API errors
    if (data['Error Message']) {
      throw new Error(`Alpha Vantage API error: ${data['Error Message']}`)
    }
    
    if (data['Note']) {
      throw new Error(`Alpha Vantage API rate limit: ${data['Note']}`)
    }

    const timeSeries = data['Time Series (Digital Currency Daily)']
    if (!timeSeries) {
      console.warn(`No cryptocurrency data found for symbol: ${symbol}`)
      return []
    }

    const prices: PriceData[] = []
    
    for (const [date, values] of Object.entries(timeSeries)) {
      const dayData = values as any
      
      prices.push({
        symbol,
        date,
        open_price: parseFloat(dayData[`1a. open (${baseCurrency})`] || dayData['1b. open (USD)']),
        high_price: parseFloat(dayData[`2a. high (${baseCurrency})`] || dayData['2b. high (USD)']),
        low_price: parseFloat(dayData[`3a. low (${baseCurrency})`] || dayData['3b. low (USD)']),
        close_price: parseFloat(dayData[`4a. close (${baseCurrency})`] || dayData['4b. close (USD)']),
        adjusted_close: parseFloat(dayData[`4a. close (${baseCurrency})`] || dayData['4b. close (USD)']),
        volume: parseFloat(dayData['5. volume']),
        data_source: 'alpha_vantage',
        symbol_type: 'crypto',
        base_currency: baseCurrency
      })
    }

    return prices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  /**
   * Fetch current quote for a symbol
   * @param symbol The ticker symbol (e.g., 'AAPL', 'BTC', 'ETH')
   * @param symbolType The type of symbol ('stock', 'crypto', 'etf')
   * @param baseCurrency The base currency for pricing (defaults to 'USD')
   */
  async fetchCurrentQuote(
    symbol: string, 
    symbolType: SymbolType, 
    baseCurrency: BaseCurrency = 'USD'
  ): Promise<DailyPriceResponse | null> {
    if (!this.apiKey) {
      throw new Error('Alpha Vantage API key not configured')
    }

    try {
      // Use different API functions for crypto vs stocks
      if (symbolType === 'crypto') {
        // For crypto, get the latest price from daily data
        const historicalData = await this.fetchCryptocurrencyData(symbol, baseCurrency)
        
        if (historicalData.length === 0) {
          console.warn(`No cryptocurrency data found for symbol: ${symbol}`)
          return null
        }
        
        const latestPrice = historicalData[0] // Already sorted by date desc
        return {
          symbol: symbol,
          price: latestPrice.close_price,
          lastUpdated: latestPrice.date
        }
      } else {
        // For stocks, use GLOBAL_QUOTE
        const url = `${this.baseUrl}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.apiKey}`
        const response = await fetch(url)
        
        if (!response.ok) {
          throw new Error(`Alpha Vantage API error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        
        // Check for API errors
        if (data['Error Message']) {
          throw new Error(`Alpha Vantage API error: ${data['Error Message']}`)
        }
        
        if (data['Note']) {
          throw new Error(`Alpha Vantage API rate limit: ${data['Note']}`)
        }

        const quote = data['Global Quote']
        if (!quote) {
          console.warn(`No quote data found for symbol: ${symbol}`)
          return null
        }

        return {
          symbol: quote['01. symbol'],
          price: parseFloat(quote['05. price']),
          lastUpdated: quote['07. latest trading day']
        }
      }
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Fetch historical daily prices for a symbol
   * @param symbol The ticker symbol (e.g., 'AAPL', 'BTC', 'ETH')
   * @param symbolType The type of symbol ('stock', 'crypto', 'etf')
   * @param baseCurrency The base currency for pricing (defaults to 'USD')
   * @param outputSize 'compact' (last 100 days) or 'full' (20+ years) - only applies to stocks
   */
  async fetchHistoricalPrices(
    symbol: string, 
    symbolType: SymbolType, 
    baseCurrency: BaseCurrency = 'USD',
    outputSize: 'compact' | 'full' = 'full'
  ): Promise<PriceData[]> {
    if (!this.apiKey) {
      throw new Error('Alpha Vantage API key not configured')
    }

    try {
      // Use different API functions for crypto vs stocks
      if (symbolType === 'crypto') {
        // For crypto, use DIGITAL_CURRENCY_DAILY (outputSize doesn't apply)
        console.log(`Fetching cryptocurrency historical data for: ${symbol} in ${baseCurrency}`)
        return await this.fetchCryptocurrencyData(symbol, baseCurrency)
      } else {
        // For stocks, use TIME_SERIES_DAILY
        console.log(`Fetching stock historical data for: ${symbol}`)
        const url = `${this.baseUrl}?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=${outputSize}&apikey=${this.apiKey}`
        const response = await fetch(url)
        
        if (!response.ok) {
          throw new Error(`Alpha Vantage API error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        
        // Check for API errors
        if (data['Error Message']) {
          throw new Error(`Alpha Vantage API error: ${data['Error Message']}`)
        }
        
        if (data['Note']) {
          throw new Error(`Alpha Vantage API rate limit: ${data['Note']}`)
        }

        const timeSeries = data['Time Series (Daily)']
        if (!timeSeries) {
          console.warn(`No historical data found for symbol: ${symbol}`)
          return []
        }

        const prices: PriceData[] = []
        
        for (const [date, values] of Object.entries(timeSeries)) {
          const dayData = values as any
          
          prices.push({
            symbol,
            date,
            open_price: parseFloat(dayData['1. open']),
            high_price: parseFloat(dayData['2. high']),
            low_price: parseFloat(dayData['3. low']),
            close_price: parseFloat(dayData['4. close']),
            adjusted_close: parseFloat(dayData['4. close']), // Free tier doesn't have adjusted close, use close price
            volume: parseInt(dayData['5. volume']), // Volume is field 5 in free tier, not 6
            data_source: 'alpha_vantage',
            symbol_type: symbolType,
            base_currency: baseCurrency
          })
        }

        return prices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }
    } catch (error) {
      console.error(`Error fetching historical prices for ${symbol}:`, error)
      throw error
    }
  }

  /**
   * Get multiple quotes in batch (respecting rate limits)
   * Alpha Vantage free tier: 25 requests per day, 5 requests per minute
   */
  async fetchMultipleQuotes(
    symbolData: Array<{ symbol: string; symbolType: SymbolType; baseCurrency?: BaseCurrency }>
  ): Promise<Map<string, DailyPriceResponse>> {
    const results = new Map<string, DailyPriceResponse>()
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
    
    console.log(`Fetching quotes for ${symbolData.length} symbols...`)
    
    for (let i = 0; i < symbolData.length; i++) {
      const { symbol, symbolType, baseCurrency = 'USD' } = symbolData[i]
      
      try {
        console.log(`Fetching quote ${i + 1}/${symbolData.length}: ${symbol} (${symbolType}, ${baseCurrency})`)
        const quote = await this.fetchCurrentQuote(symbol, symbolType, baseCurrency)
        
        if (quote) {
          results.set(symbol, quote)
        }
        
        // Rate limiting: wait 12 seconds between requests (5 per minute)
        if (i < symbolData.length - 1) {
          console.log('Waiting 12 seconds for rate limiting...')
          await delay(12000)
        }
      } catch (error) {
        console.error(`Failed to fetch quote for ${symbol}:`, error)
        // Continue with next symbol rather than failing entire batch
      }
    }
    
    console.log(`Successfully fetched ${results.size}/${symbolData.length} quotes`)
    return results
  }

  /**
   * Check if stock markets are likely open (basic check)
   * Note: Cryptocurrency markets are open 24/7
   * More sophisticated logic could check holidays, market hours by timezone
   */
  isMarketHours(): boolean {
    const now = new Date()
    const utcHour = now.getUTCHours()
    const dayOfWeek = now.getUTCDay()
    
    // Basic check: Monday-Friday, 9:30 AM - 4:00 PM EST (14:30 - 21:00 UTC)
    // This applies to traditional stock markets only - crypto markets are 24/7
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5
    const isDuringMarketHours = utcHour >= 14 && utcHour < 21
    
    return isWeekday && isDuringMarketHours
  }

  /**
   * Get appropriate delay for rate limiting based on plan
   */
  getRateLimitDelay(): number {
    // Free tier: 5 requests per minute = 12 seconds between requests
    // Premium ($25/month): 75 requests per minute = 0.8 seconds between requests
    
    const isPremium = process.env.ALPHA_VANTAGE_PLAN === 'premium'
    return isPremium ? 800 : 12000
  }
}

// Export singleton instance
export const priceDataService = new PriceDataService()