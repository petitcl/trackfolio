/**
 * Alpha Vantage price data provider
 * Extracted from the original PriceDataService
 */

import { 
  IPriceProvider, 
  SymbolType, 
  BaseCurrency, 
  PriceData, 
  DailyPriceResponse, 
  SymbolSearchResult 
} from './types'

interface CryptoSymbolCache {
  symbols: Record<string, SymbolSearchResult>
  lastUpdated: number
  ttl: number
}

export class AlphaVantageProvider implements IPriceProvider {
  public readonly name = 'alpha_vantage'
  public readonly enabled = false // Disabled for now
  private readonly apiKey: string
  private readonly baseUrl = 'https://www.alphavantage.co/query'
  private readonly cryptoListUrl = 'https://www.alphavantage.co/digital_currency_list/'
  private cryptoCache: CryptoSymbolCache | null = null

  constructor() {
    this.apiKey = process.env.ALPHA_VANTAGE_API_KEY || ''
  }

  isAvailable(): boolean {
    return !!this.apiKey
  }

  getRateLimitDelay(): number {
    const isPremium = process.env.ALPHA_VANTAGE_PLAN === 'premium'
    return isPremium ? 800 : 12000
  }

  async fetchCurrentQuote(
    symbol: string, 
    symbolType: SymbolType, 
    baseCurrency: BaseCurrency = 'USD'
  ): Promise<DailyPriceResponse | null> {
    if (!this.isAvailable()) {
      throw new Error('Alpha Vantage API key not configured')
    }

    try {
      if (symbolType === 'crypto') {
        const historicalData = await this.fetchCryptocurrencyData(symbol, baseCurrency)
        
        if (historicalData.length === 0) {
          return null
        }
        
        const latestPrice = historicalData[0]
        return {
          symbol: symbol,
          price: latestPrice.close_price,
          lastUpdated: latestPrice.date,
          provider: this.name
        }
      } else if (symbolType === 'currency') {
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
        
        this.checkApiErrors(data)

        const quote = data['Global Quote']
        if (!quote) {
          return null
        }

        return {
          symbol: quote['01. symbol'],
          price: parseFloat(quote['05. price']),
          lastUpdated: quote['07. latest trading day'],
          provider: this.name
        }
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
    if (!this.isAvailable()) {
      throw new Error('Alpha Vantage API key not configured')
    }

    try {
      if (symbolType === 'crypto') {
        return await this.fetchCryptocurrencyData(symbol, baseCurrency)
      } else if (symbolType === 'currency') {
        const cleanSymbol = symbol.replace('/', '')
        
        if (cleanSymbol.length !== 6) {
          throw new Error(`Invalid currency pair format: ${symbol}. Expected format: EURUSD or EUR/USD`)
        }
        
        const fromCurrency = cleanSymbol.slice(0, 3)
        const toCurrency = cleanSymbol.slice(3, 6)
        
        return await this.fetchCurrencyData(fromCurrency, toCurrency)
      } else {
        const url = `${this.baseUrl}?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=${outputSize}&apikey=${this.apiKey}`
        const response = await fetch(url)
        
        if (!response.ok) {
          throw new Error(`Alpha Vantage API error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        this.checkApiErrors(data)

        const timeSeries = data['Time Series (Daily)']
        if (!timeSeries) {
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
            adjusted_close: parseFloat(dayData['4. close']),
            volume: parseInt(dayData['5. volume']),
            data_source: this.name,
            symbol_type: symbolType,
            base_currency: baseCurrency,
            provider: this.name
          })
        }

        return prices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }
    } catch (error) {
      console.error(`[${this.name}] Error fetching historical prices for ${symbol}:`, error)
      throw error
    }
  }

  async searchSymbols(keywords: string): Promise<SymbolSearchResult[]> {
    if (!keywords || keywords.trim().length < 1) {
      return []
    }

    const normalizedKeywords = keywords.trim().toUpperCase()
    const results: SymbolSearchResult[] = []

    // Search crypto symbols first
    try {
      const cryptoSymbols = await this.fetchCryptoSymbols()
      const cryptoMatches = Object.values(cryptoSymbols).filter(crypto => {
        const symbolMatch = crypto.symbol.includes(normalizedKeywords)
        const nameMatch = crypto.name.toUpperCase().includes(normalizedKeywords)
        return symbolMatch || nameMatch
      })

      cryptoMatches.forEach(crypto => {
        if (crypto.symbol === normalizedKeywords) {
          crypto.matchScore = '1.0000'
        } else if (crypto.symbol.includes(normalizedKeywords)) {
          crypto.matchScore = '0.9000'
        } else if (crypto.name.toUpperCase().includes(normalizedKeywords)) {
          crypto.matchScore = '0.8000'
        }
        crypto.provider = this.name
      })

      results.push(...cryptoMatches)
      
    } catch (error) {
      console.warn(`[${this.name}] Could not fetch crypto symbols:`, error)
    }

    // Search Alpha Vantage for stocks/ETFs
    if (this.isAvailable()) {
      try {
        const url = `${this.baseUrl}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(keywords)}&apikey=${this.apiKey}`
        const response = await fetch(url)
        
        if (!response.ok) {
          throw new Error(`Alpha Vantage API error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        
        // Handle API errors gracefully
        if (data['Error Message'] || data['Note'] || data['Information']) {
          throw new Error(data['Error Message'] || data['Note'] || data['Information'])
        }

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
            matchScore: match['9. matchScore'] || '0',
            provider: this.name
          })).filter(result => result.symbol && result.name)

          results.push(...stockMatches)
        }
      } catch (error) {
        console.warn(`[${this.name}] Symbol search error:`, error)
      }
    }

    // Remove duplicates and sort
    const uniqueResults = results.filter((result, index, arr) => 
      arr.findIndex(r => r.symbol === result.symbol) === index
    )

    return uniqueResults.sort((a, b) => {
      const aExact = a.symbol === normalizedKeywords
      const bExact = b.symbol === normalizedKeywords
      
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      
      const aIsCrypto = a.type === 'Cryptocurrency'
      const bIsCrypto = b.type === 'Cryptocurrency'
      
      if (aIsCrypto && !bIsCrypto) return -1
      if (!aIsCrypto && bIsCrypto) return 1
      
      return parseFloat(b.matchScore) - parseFloat(a.matchScore)
    })
  }

  private checkApiErrors(data: any): void {
    if (data['Error Message']) {
      throw new Error(`Alpha Vantage API error: ${data['Error Message']}`)
    }
    
    if (data['Note']) {
      throw new Error(`Alpha Vantage API rate limit: ${data['Note']}`)
    }
    
    if (data['Information']) {
      throw new Error(`Alpha Vantage API rate limit: ${data['Information']}`)
    }
  }

  private async fetchCryptocurrencyData(symbol: string, baseCurrency: BaseCurrency = 'USD'): Promise<PriceData[]> {
    const url = `${this.baseUrl}?function=DIGITAL_CURRENCY_DAILY&symbol=${symbol}&market=${baseCurrency}&apikey=${this.apiKey}`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    this.checkApiErrors(data)

    const timeSeries = data['Time Series (Digital Currency Daily)']
    if (!timeSeries) {
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
        data_source: this.name,
        symbol_type: 'crypto',
        base_currency: baseCurrency,
        provider: this.name
      })
    }

    return prices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  private async fetchCurrencyData(fromCurrency: string, toCurrency: string = 'USD'): Promise<PriceData[]> {
    const currencyPair = `${fromCurrency}${toCurrency}`
    const url = `${this.baseUrl}?function=FX_DAILY&from_symbol=${fromCurrency}&to_symbol=${toCurrency}&apikey=${this.apiKey}`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    this.checkApiErrors(data)

    const timeSeries = data['Time Series FX (Daily)']
    if (!timeSeries) {
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
        volume: 0,
        data_source: this.name,
        symbol_type: 'currency',
        base_currency: toCurrency as BaseCurrency,
        provider: this.name
      })
    }

    return prices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  private async fetchCurrentCurrencyRate(fromCurrency: string, toCurrency: string = 'USD'): Promise<DailyPriceResponse | null> {
    const url = `${this.baseUrl}?function=CURRENCY_EXCHANGE_RATE&from_currency=${fromCurrency}&to_currency=${toCurrency}&apikey=${this.apiKey}`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    this.checkApiErrors(data)

    const exchangeRate = data['Realtime Currency Exchange Rate']
    if (!exchangeRate) {
      return null
    }

    return {
      symbol: `${fromCurrency}${toCurrency}`,
      price: parseFloat(exchangeRate['5. Exchange Rate']),
      lastUpdated: exchangeRate['6. Last Refreshed'],
      provider: this.name
    }
  }

  private parseCryptoCsv(csvText: string): Record<string, SymbolSearchResult> {
    const symbols: Record<string, SymbolSearchResult> = {}
    const lines = csvText.trim().split('\n')
    const startIndex = lines[0]?.toLowerCase().includes('currency') ? 1 : 0

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

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

  private async fetchCryptoSymbols(forceRefresh = false): Promise<Record<string, SymbolSearchResult>> {
    const now = Date.now()
    const cacheValidFor = 24 * 60 * 60 * 1000 // 24 hours

    if (!forceRefresh && this.cryptoCache && 
        (now - this.cryptoCache.lastUpdated) < this.cryptoCache.ttl) {
      return this.cryptoCache.symbols
    }

    try {
      const response = await fetch(this.cryptoListUrl)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch crypto list: ${response.status} ${response.statusText}`)
      }

      const csvText = await response.text()
      const symbols = this.parseCryptoCsv(csvText)

      this.cryptoCache = {
        symbols,
        lastUpdated: now,
        ttl: cacheValidFor
      }

      return symbols

    } catch (error) {
      console.error(`[${this.name}] Error fetching crypto symbols:`, error)
      
      if (this.cryptoCache) {
        return this.cryptoCache.symbols
      }
      
      // Fallback to minimal crypto set
      return {
        'BTC': { symbol: 'BTC', name: 'Bitcoin', type: 'Cryptocurrency', region: 'Global', marketOpen: '00:00', marketClose: '23:59', timezone: 'UTC', currency: 'USD', matchScore: '1.0000' },
        'ETH': { symbol: 'ETH', name: 'Ethereum', type: 'Cryptocurrency', region: 'Global', marketOpen: '00:00', marketClose: '23:59', timezone: 'UTC', currency: 'USD', matchScore: '1.0000' },
        'ADA': { symbol: 'ADA', name: 'Cardano', type: 'Cryptocurrency', region: 'Global', marketOpen: '00:00', marketClose: '23:59', timezone: 'UTC', currency: 'USD', matchScore: '1.0000' }
      }
    }
  }
}