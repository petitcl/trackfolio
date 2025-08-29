/**
 * Price Data Service
 * Handles fetching historical price data from external APIs
 */

import { createClient } from '@/lib/supabase/client'

interface HistoricalPriceData {
  symbol: string
  date: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
  adjustedClose?: number
}

interface YahooFinanceResponse {
  chart: {
    result: Array<{
      meta: {
        symbol: string
        currency: string
        timezone: string
      }
      timestamp: number[]
      indicators: {
        quote: Array<{
          open: number[]
          high: number[]
          low: number[]
          close: number[]
          volume: number[]
        }>
        adjclose?: Array<{
          adjclose: number[]
        }>
      }
    }>
  }
}

export class PriceDataService {
  private supabase = createClient()

  /**
   * Fetch historical price data from Yahoo Finance API (free tier)
   * Note: This is for demonstration - in production, use a proper API key service
   */
  async fetchHistoricalPrices(
    symbol: string, 
    startDate: Date, 
    endDate: Date = new Date()
  ): Promise<HistoricalPriceData[]> {
    try {
      // Convert dates to Unix timestamps
      const start = Math.floor(startDate.getTime() / 1000)
      const end = Math.floor(endDate.getTime() / 1000)

      // Note: This is a simplified example. In production, you'd want to:
      // 1. Use a proper API service with authentication
      // 2. Handle rate limiting
      // 3. Cache responses
      // 4. Handle different data providers
      
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${start}&period2=${end}&interval=1d`
      
      console.log(`📊 Fetching historical data for ${symbol} from ${startDate.toDateString()} to ${endDate.toDateString()}`)
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`Yahoo Finance API error: ${response.status}`)
      }

      const data: YahooFinanceResponse = await response.json()
      
      if (!data.chart.result || data.chart.result.length === 0) {
        console.warn(`No data found for symbol: ${symbol}`)
        return []
      }

      const result = data.chart.result[0]
      const timestamps = result.timestamp
      const quotes = result.indicators.quote[0]
      const adjClose = result.indicators.adjclose?.[0]?.adjclose

      const historicalData: HistoricalPriceData[] = []

      for (let i = 0; i < timestamps.length; i++) {
        const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0]
        
        historicalData.push({
          symbol,
          date,
          open: quotes.open[i] || 0,
          high: quotes.high[i] || 0,
          low: quotes.low[i] || 0,
          close: quotes.close[i] || 0,
          volume: quotes.volume[i],
          adjustedClose: adjClose?.[i]
        })
      }

      console.log(`✅ Fetched ${historicalData.length} price points for ${symbol}`)
      return historicalData

    } catch (error) {
      console.error(`❌ Error fetching historical prices for ${symbol}:`, error)
      return []
    }
  }

  /**
   * Store historical price data in the database
   */
  async storeHistoricalPrices(priceData: HistoricalPriceData[]): Promise<boolean> {
    try {
      if (priceData.length === 0) return true

      // Prepare data for insertion
      const insertData = priceData.map(data => ({
        symbol: data.symbol,
        date: data.date,
        open_price: data.open,
        high_price: data.high,
        low_price: data.low,
        close_price: data.close,
        volume: data.volume,
        adjusted_close: data.adjustedClose,
        data_source: 'yahoo_finance'
      }))

      // Use upsert to handle duplicates
      const { error } = await this.supabase
        .from('symbol_price_history')
        .upsert(insertData, { 
          onConflict: 'symbol,date',
          ignoreDuplicates: false 
        })

      if (error) {
        console.error('Error storing historical prices:', error)
        return false
      }

      console.log(`✅ Stored ${priceData.length} price records for ${priceData[0]?.symbol}`)
      return true

    } catch (error) {
      console.error('Error storing historical prices:', error)
      return false
    }
  }

  /**
   * Fetch and store historical prices for a symbol
   */
  async updateHistoricalPrices(
    symbol: string, 
    startDate: Date, 
    endDate: Date = new Date()
  ): Promise<boolean> {
    const priceData = await this.fetchHistoricalPrices(symbol, startDate, endDate)
    
    if (priceData.length === 0) {
      return false
    }

    return await this.storeHistoricalPrices(priceData)
  }

  /**
   * Get the date range where we have historical data for a symbol
   */
  async getHistoricalDataRange(symbol: string): Promise<{ startDate: Date | null, endDate: Date | null }> {
    try {
      const { data, error } = await this.supabase
        .from('symbol_price_history')
        .select('date')
        .eq('symbol', symbol)
        .order('date', { ascending: true })

      if (error || !data || data.length === 0) {
        return { startDate: null, endDate: null }
      }

      return {
        startDate: new Date(data[0].date),
        endDate: new Date(data[data.length - 1].date)
      }

    } catch (error) {
      console.error('Error getting historical data range:', error)
      return { startDate: null, endDate: null }
    }
  }

  /**
   * Check if we need to update historical data for a symbol
   */
  async needsHistoricalDataUpdate(symbol: string): Promise<boolean> {
    const { endDate } = await this.getHistoricalDataRange(symbol)
    
    if (!endDate) return true // No data at all
    
    // Check if last data is more than 1 day old
    const daysDiff = (Date.now() - endDate.getTime()) / (1000 * 60 * 60 * 24)
    return daysDiff > 1
  }
}

// Singleton instance
export const priceDataService = new PriceDataService()

// Example usage functions for the "Update Prices" page

/**
 * Update historical prices for all symbols in user's portfolio
 */
export async function updateAllPortfolioSymbols(userSymbols: string[]): Promise<{
  success: string[]
  failed: string[]
}> {
  const results = { success: [], failed: [] } as {
    success: string[]
    failed: string[]
  }
  
  for (const symbol of userSymbols) {
    try {
      const needsUpdate = await priceDataService.needsHistoricalDataUpdate(symbol)
      
      if (needsUpdate) {
        // Update last 2 years of data
        const startDate = new Date()
        startDate.setFullYear(startDate.getFullYear() - 2)
        
        const success = await priceDataService.updateHistoricalPrices(symbol, startDate)
        
        if (success) {
          results.success.push(symbol)
        } else {
          results.failed.push(symbol)
        }
      } else {
        results.success.push(symbol) // Already up to date
      }
    } catch (error) {
      console.error(`Failed to update ${symbol}:`, error)
      results.failed.push(symbol)
    }
  }
  
  return results
}