/**
 * Service for fetching market price data from external APIs
 * Currently supports Alpha Vantage API for stocks and cryptocurrencies
 */

export type SymbolType = 'stock' | 'crypto' | 'etf' | 'currency'
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
}

export interface DailyPriceResponse {
  symbol: string
  price: number
  lastUpdated: string
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
}

// Crypto symbols cache interface
interface CryptoSymbolCache {
  symbols: Record<string, SymbolSearchResult>
  lastUpdated: number
  ttl: number // Time to live in milliseconds
}

class PriceDataService {
  private readonly apiKey: string
  private readonly baseUrl = 'https://www.alphavantage.co/query'
  private readonly cryptoListUrl = 'https://www.alphavantage.co/digital_currency_list/'
  private cryptoCache: CryptoSymbolCache | null = null

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
    
    if (data['Information']) {
      throw new Error(`Alpha Vantage API rate limit: ${data['Information']}`)
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
      // Use different API functions for different symbol types
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
      } else if (symbolType === 'currency') {
        // For currencies, parse the currency pair and fetch exchange rate
        // Symbol should be in format like "EURUSD" or "EUR/USD"
        const cleanSymbol = symbol.replace('/', '')
        
        if (cleanSymbol.length !== 6) {
          throw new Error(`Invalid currency pair format: ${symbol}. Expected format: EURUSD or EUR/USD`)
        }
        
        const fromCurrency = cleanSymbol.slice(0, 3)
        const toCurrency = cleanSymbol.slice(3, 6)
        
        return await this.fetchCurrentCurrencyRate(fromCurrency, toCurrency)
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
        
        if (data['Information']) {
          throw new Error(`Alpha Vantage API rate limit: ${data['Information']}`)
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
      // Use different API functions for different symbol types
      if (symbolType === 'crypto') {
        // For crypto, use DIGITAL_CURRENCY_DAILY (outputSize doesn't apply)
        console.log(`Fetching cryptocurrency historical data for: ${symbol} in ${baseCurrency}`)
        return await this.fetchCryptocurrencyData(symbol, baseCurrency)
      } else if (symbolType === 'currency') {
        // For currencies, parse the currency pair and fetch FX data
        // Symbol should be in format like "EURUSD" or "EUR/USD"
        const cleanSymbol = symbol.replace('/', '')
        
        if (cleanSymbol.length !== 6) {
          throw new Error(`Invalid currency pair format: ${symbol}. Expected format: EURUSD or EUR/USD`)
        }
        
        const fromCurrency = cleanSymbol.slice(0, 3)
        const toCurrency = cleanSymbol.slice(3, 6)
        
        console.log(`Fetching currency exchange rate historical data for: ${fromCurrency}/${toCurrency}`)
        return await this.fetchCurrencyData(fromCurrency, toCurrency)
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
        
        if (data['Information']) {
          throw new Error(`Alpha Vantage API rate limit: ${data['Information']}`)
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
   * Parse CSV text into crypto symbols dictionary
   * @param csvText Raw CSV content from Alpha Vantage
   */
  private parseCryptoCsv(csvText: string): Record<string, SymbolSearchResult> {
    const symbols: Record<string, SymbolSearchResult> = {}
    const lines = csvText.trim().split('\n')

    // Skip header if it exists
    const startIndex = lines[0]?.toLowerCase().includes('currency') ? 1 : 0

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Parse CSV line (handle quotes and commas in names)
      const csvMatch = line.match(/^([^,]+),(.+)$/)
      if (csvMatch) {
        const symbol = csvMatch[1].trim()
        const name = csvMatch[2].trim()

        if (symbol && name) {
          symbols[symbol] = {
            symbol,
            name,
            type: 'Cryptocurrency',
            region: 'Global',
            marketOpen: '00:00',
            marketClose: '23:59',
            timezone: 'UTC',
            currency: 'USD',
            matchScore: '1.0000'
          }
        }
      }
    }

    return symbols
  }

  /**
   * Fetch cryptocurrency symbols from Alpha Vantage CSV endpoint
   * @param forceRefresh Force refresh even if cache is valid
   */
  private async fetchCryptoSymbols(forceRefresh = false): Promise<Record<string, SymbolSearchResult>> {
    const now = Date.now()
    const cacheValidFor = 24 * 60 * 60 * 1000 // 24 hours

    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && this.cryptoCache && 
        (now - this.cryptoCache.lastUpdated) < this.cryptoCache.ttl) {
      console.log('Using cached crypto symbols')
      return this.cryptoCache.symbols
    }

    try {
      console.log('Fetching cryptocurrency symbols from Alpha Vantage...')
      const response = await fetch(this.cryptoListUrl)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch crypto list: ${response.status} ${response.statusText}`)
      }

      const csvText = await response.text()
      const symbols = this.parseCryptoCsv(csvText)

      // Update cache
      this.cryptoCache = {
        symbols,
        lastUpdated: now,
        ttl: cacheValidFor
      }

      console.log(`✅ Loaded ${Object.keys(symbols).length} cryptocurrency symbols`)
      return symbols

    } catch (error) {
      console.error('Error fetching crypto symbols:', error)
      
      // Return cached data if available, even if expired
      if (this.cryptoCache) {
        console.warn('Using expired crypto cache due to fetch error')
        return this.cryptoCache.symbols
      }
      
      // Fallback to minimal crypto set if no cache available
      console.warn('Using minimal crypto fallback due to fetch error')
      return {
        'BTC': { symbol: 'BTC', name: 'Bitcoin', type: 'Cryptocurrency', region: 'Global', marketOpen: '00:00', marketClose: '23:59', timezone: 'UTC', currency: 'USD', matchScore: '1.0000' },
        'ETH': { symbol: 'ETH', name: 'Ethereum', type: 'Cryptocurrency', region: 'Global', marketOpen: '00:00', marketClose: '23:59', timezone: 'UTC', currency: 'USD', matchScore: '1.0000' },
        'ADA': { symbol: 'ADA', name: 'Cardano', type: 'Cryptocurrency', region: 'Global', marketOpen: '00:00', marketClose: '23:59', timezone: 'UTC', currency: 'USD', matchScore: '1.0000' }
      }
    }
  }

  /**
   * Search for symbols using Alpha Vantage SYMBOL_SEARCH function with comprehensive crypto database
   * @param keywords Search term (company name, ticker, etc.)
   */
  async searchSymbols(keywords: string): Promise<SymbolSearchResult[]> {
    if (!keywords || keywords.trim().length < 1) {
      return []
    }

    const normalizedKeywords = keywords.trim().toUpperCase()
    const results: SymbolSearchResult[] = []

    // First, search comprehensive crypto symbols database
    try {
      const cryptoSymbols = await this.fetchCryptoSymbols()
      const cryptoMatches = Object.values(cryptoSymbols).filter(crypto => {
        const symbolMatch = crypto.symbol.includes(normalizedKeywords)
        const nameMatch = crypto.name.toUpperCase().includes(normalizedKeywords)
        return symbolMatch || nameMatch
      })

      // Calculate better match scores for crypto symbols
      cryptoMatches.forEach(crypto => {
        if (crypto.symbol === normalizedKeywords) {
          crypto.matchScore = '1.0000' // Exact symbol match
        } else if (crypto.symbol.includes(normalizedKeywords)) {
          crypto.matchScore = '0.9000' // Symbol contains keywords
        } else if (crypto.name.toUpperCase().includes(normalizedKeywords)) {
          crypto.matchScore = '0.8000' // Name contains keywords
        }
      })

      // Add crypto matches
      results.push(...cryptoMatches)
      
    } catch (error) {
      console.warn('Warning: Could not fetch crypto symbols:', error)
      // Continue without crypto symbols
    }

    // If we have an API key, also search Alpha Vantage (for stocks/ETFs)
    if (this.apiKey) {
      try {
        const url = `${this.baseUrl}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(keywords)}&apikey=${this.apiKey}`
        const response = await fetch(url)
        
        if (!response.ok) {
          console.warn(`Alpha Vantage API error: ${response.status} ${response.statusText}`)
        } else {
          const data = await response.json()
          
          // Check for API errors
          if (data['Error Message']) {
            console.warn(`Alpha Vantage API error: ${data['Error Message']}`)
          } else if (data['Note']) {
            console.warn(`Alpha Vantage API rate limit: ${data['Note']}`)
          } else if (data['Information']) {
            console.warn(`Alpha Vantage API rate limit: ${data['Information']}`)
          } else {
            const bestMatches = data['bestMatches']
            if (bestMatches && Array.isArray(bestMatches)) {
              const stockMatches = bestMatches.map((match: any) => ({
                symbol: match['1. symbol'] || '',
                name: match['2. name'] || '',
                type: match['3. type'] || '',
                region: match['4. region'] || '',
                marketOpen: match['5. marketOpen'] || '',
                marketClose: match['6. marketClose'] || '',
                timezone: match['7. timezone'] || '',
                currency: match['8. currency'] || 'USD',
                matchScore: match['9. matchScore'] || '0'
              })).filter(result => result.symbol && result.name)

              results.push(...stockMatches)
            }
          }
        }
      } catch (error) {
        console.warn(`Warning: Could not fetch from Alpha Vantage:`, error)
        // Continue with crypto results only
      }
    } else {
      console.log('Alpha Vantage API key not configured - crypto symbols only')
    }

    // Remove duplicates and sort by match quality (exact matches first, then crypto, then by match score)
    const uniqueResults = results.filter((result, index, arr) => 
      arr.findIndex(r => r.symbol === result.symbol) === index
    )

    return uniqueResults.sort((a, b) => {
      // Exact symbol matches first
      const aExact = a.symbol === normalizedKeywords
      const bExact = b.symbol === normalizedKeywords
      
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      
      // Then crypto symbols
      const aIsCrypto = a.type === 'Cryptocurrency'
      const bIsCrypto = b.type === 'Cryptocurrency'
      
      if (aIsCrypto && !bIsCrypto) return -1
      if (!aIsCrypto && bIsCrypto) return 1
      
      // Finally by match score (higher first)
      return parseFloat(b.matchScore) - parseFloat(a.matchScore)
    })
  }

  /**
   * Fetch currency exchange rate data using FX_DAILY
   */
  private async fetchCurrencyData(fromCurrency: string, toCurrency: string = 'USD'): Promise<PriceData[]> {
    const currencyPair = `${fromCurrency}${toCurrency}`
    const url = `${this.baseUrl}?function=FX_DAILY&from_symbol=${fromCurrency}&to_symbol=${toCurrency}&apikey=${this.apiKey}`
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
    
    if (data['Information']) {
      throw new Error(`Alpha Vantage API rate limit: ${data['Information']}`)
    }

    const timeSeries = data['Time Series FX (Daily)']
    if (!timeSeries) {
      console.warn(`No currency exchange data found for ${fromCurrency}/${toCurrency}`)
      return []
    }

    const prices: PriceData[] = []
    
    for (const [date, values] of Object.entries(timeSeries)) {
      const dayData = values as any
      
      prices.push({
        symbol: currencyPair,
        date,
        open_price: parseFloat(dayData['1. open']),
        high_price: parseFloat(dayData['2. high']),
        low_price: parseFloat(dayData['3. low']),
        close_price: parseFloat(dayData['4. close']),
        adjusted_close: parseFloat(dayData['4. close']),
        volume: 0, // FX doesn't have volume
        data_source: 'alpha_vantage',
        symbol_type: 'currency',
        base_currency: toCurrency as BaseCurrency
      })
    }

    return prices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  /**
   * Fetch current currency exchange rate using CURRENCY_EXCHANGE_RATE
   */
  private async fetchCurrentCurrencyRate(fromCurrency: string, toCurrency: string = 'USD'): Promise<DailyPriceResponse | null> {
    const url = `${this.baseUrl}?function=CURRENCY_EXCHANGE_RATE&from_currency=${fromCurrency}&to_currency=${toCurrency}&apikey=${this.apiKey}`
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
    
    if (data['Information']) {
      throw new Error(`Alpha Vantage API rate limit: ${data['Information']}`)
    }

    const exchangeRate = data['Realtime Currency Exchange Rate']
    if (!exchangeRate) {
      console.warn(`No exchange rate data found for ${fromCurrency}/${toCurrency}`)
      return null
    }

    return {
      symbol: `${fromCurrency}${toCurrency}`,
      price: parseFloat(exchangeRate['5. Exchange Rate']),
      lastUpdated: exchangeRate['6. Last Refreshed']
    }
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