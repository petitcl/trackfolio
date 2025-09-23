import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import { clientAuthService } from '@/lib/auth/client.auth.service'
import type { Symbol } from '@/lib/supabase/types'
import { mockSymbolPriceHistory } from '@/lib/mockData'
import { cacheService } from './cache.service'

/**
 * Service responsible for fetching and caching historical price data
 * Handles both market symbols (symbol_price_history) and custom symbols (user_symbol_prices)
 */
export class HistoricalPriceService {
  private supabase = createClient()
  private readonly PAGE_SIZE = 1000 // Supabase default limit

  /**
   * Clear historical price cache (useful for testing or when data changes)
   */
  clearCache(): void {
    // Clear both old cache and new cache service
    cacheService.invalidatePattern('historicalPrices:*')
    cacheService.invalidatePattern('customPrices:*')
  }

  /**
   * Fetch all symbol price history with pagination to handle >1000 records
   * Returns all price history data for a symbol, fetching in batches if needed
   */
  async fetchAllSymbolPriceHistory(symbol: string): Promise<Array<{date: string, close_price: number}>> {
    const allPrices: Array<{date: string, close_price: number}> = []
    let page = 0
    let hasMore = true

    while (hasMore) {
      const { data: pageData = [], error } = await this.supabase
        .from('symbol_price_history')
        .select('date, close_price')
        .eq('symbol', symbol)
        .order('date', { ascending: true })
        .range(page * this.PAGE_SIZE, (page + 1) * this.PAGE_SIZE - 1)

      if (error) {
        console.warn(`Failed to fetch historical prices for ${symbol} (page ${page}):`, error)
        break
      }

      if (pageData && pageData.length > 0) {
        allPrices.push(...pageData)
        hasMore = pageData.length === this.PAGE_SIZE
        page++
      } else {
        hasMore = false
      }
    }

    return allPrices
  }

  /**
   * Fetch all user symbol prices with pagination to handle >1000 records
   * Returns all price history data for a custom symbol, fetching in batches if needed
   */
  async fetchAllUserSymbolPrices(userId: string, symbol: string): Promise<Array<{price_date: string, manual_price: number}>> {
    const allPrices: Array<{price_date: string, manual_price: number}> = []
    let page = 0
    let hasMore = true

    while (hasMore) {
      const { data: pageData = [], error } = await this.supabase
        .from('user_symbol_prices')
        .select('price_date, manual_price')
        .eq('user_id', userId)
        .eq('symbol', symbol)
        .order('price_date', { ascending: true })
        .range(page * this.PAGE_SIZE, (page + 1) * this.PAGE_SIZE - 1)

      if (error) {
        console.warn(`Failed to fetch user prices for custom symbol ${symbol} (page ${page}):`, error)
        break
      }

      if (pageData && pageData.length > 0) {
        allPrices.push(...pageData)
        hasMore = pageData.length === this.PAGE_SIZE
        page++
      } else {
        hasMore = false
      }
    }

    return allPrices
  }

  /**
   * Fetch historical prices for a given symbol and return as a Map
   * Uses mock data for demo users, Supabase for real users
   */
  async fetchHistoricalPrices(symbol: string): Promise<Map<string, number>> {
    const cacheKey = cacheService.Keys.historicalPrices(symbol)

    return cacheService.getOrFetch(
      cacheKey,
      async () => {
        const priceMap = new Map<string, number>()

        if (clientAuthService.isCurrentUserMock()) {
          // Use mock price history for mock users
          mockSymbolPriceHistory
            .filter(p => p.symbol === symbol)
            .forEach(p => priceMap.set(p.date, Number(p.close_price)))
        } else {
          // Fetch all historical prices from Supabase for real users (with pagination)
          const historicalPrices = await this.fetchAllSymbolPriceHistory(symbol)

          historicalPrices.forEach(p => priceMap.set(p.date, Number(p.close_price)))
        }

        return priceMap
      },
      cacheService.getTTL('prices')
    )
  }

  /**
   * Get historical price for a symbol on a specific date
   * Finds the latest price <= the given date
   * Supports both market symbols (symbol_price_history) and custom symbols (user_symbol_prices)
   * Returns null if no historical data exists
   */
  async getHistoricalPriceForDate(
    symbol: string, 
    date: string, 
    user: AuthUser,
    symbolData: Symbol | null
  ): Promise<number | null> {
    const upperSymbol = symbol.toUpperCase()
    
    if (clientAuthService.isCurrentUserMock()) {
      const relevantPrices = mockSymbolPriceHistory
        .filter(p => p.symbol === upperSymbol && p.date <= date)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      return relevantPrices.length > 0 ? relevantPrices[0].close_price : null
    } else {
      // Handle custom symbols - they use user_symbol_prices
      if (symbolData?.is_custom === true) {
        return await this.getCustomSymbolHistoricalPrice(upperSymbol, date, user)
      }
      
      // Handle regular market symbols - use symbol_price_history
      return await this.getMarketSymbolHistoricalPrice(upperSymbol, date)
    }
  }

  /**
   * Get historical price for custom symbols from user_symbol_prices table
   */
  private async getCustomSymbolHistoricalPrice(
    symbol: string,
    date: string,
    user: AuthUser
  ): Promise<number | null> {
    const cacheKey = cacheService.Keys.customPrices(user.id, symbol)

    const symbolPriceMap = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        // Cache miss - fetch all user manual prices for this symbol (with pagination)
        try {
          const userPrices = await this.fetchAllUserSymbolPrices(user.id, symbol)

          const priceMap = new Map<string, number>()
          userPrices.forEach(p => {
            const price = Number(p.manual_price)
            if (!isNaN(price) && price > 0) {
              priceMap.set(p.price_date, price)
            }
          })

          if (priceMap.size === 0) {
            console.warn(`No manual prices found for custom symbol ${symbol}`)
          }

          return priceMap
        } catch (error) {
          console.error(`Error fetching user prices for custom symbol ${symbol}:`, error)
          return new Map()
        }
      },
      cacheService.getTTL('prices')
    )

    // Find the latest price <= the given date
    let latestPrice: number | null = null
    let latestDate = ''

    for (const [priceDate, price] of symbolPriceMap.entries()) {
      if (priceDate <= date && priceDate > latestDate) {
        latestDate = priceDate
        latestPrice = price
      }
    }

    return latestPrice
  }

  /**
   * Get historical price for market symbols from symbol_price_history table
   */
  private async getMarketSymbolHistoricalPrice(
    symbol: string,
    date: string
  ): Promise<number | null> {
    const cacheKey = cacheService.Keys.historicalPrices(symbol)

    const symbolPriceMap = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        // Cache miss - fetch all historical prices for this symbol (with pagination)
        try {
          const allPrices = await this.fetchAllSymbolPriceHistory(symbol)

          const priceMap = new Map<string, number>()
          allPrices.forEach(p => {
            const price = Number(p.close_price)
            if (!isNaN(price) && price > 0) {
              priceMap.set(p.date, price)
            }
          })

          if (priceMap.size === 0) {
            console.warn(`No valid historical prices found for ${symbol}`)
          }

          return priceMap
        } catch (error) {
          console.error(`Error fetching historical prices for ${symbol}:`, error)
          return new Map()
        }
      },
      cacheService.getTTL('prices')
    )

    // Find the latest price <= the given date
    let latestPrice: number | null = null
    let latestDate = ''

    for (const [priceDate, price] of symbolPriceMap.entries()) {
      if (priceDate <= date && priceDate > latestDate) {
        latestDate = priceDate
        latestPrice = price
      }
    }

    return latestPrice
  }
}

// Singleton instance
export const historicalPriceService = new HistoricalPriceService()