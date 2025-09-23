/**
 * Cache Service with Singleflight Pattern
 *
 * Provides caching and request deduplication for portfolio data:
 * - Caches data results fetched from APIs
 * - Handles concurrent fetching with singleflight pattern
 * - Prevents duplicate API calls for the same data
 *
 * Cache Keys:
 * - transactions:{userId} - List of transactions for user
 * - symbols:{userId} - List of symbols for user
 * - historicalPrices:{symbol} - All price history for a symbol
 * - customPrices:{userId}:{symbol} - Custom prices for user/symbol
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

type CacheKey = string
type PromiseCache = Map<string, Promise<any>>

export class CacheService {
  private cache = new Map<CacheKey, CacheEntry<any>>()
  private promiseCache: PromiseCache = new Map()

  // Default TTL values (in milliseconds)
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly SHORT_TTL = 2 * 60 * 1000   // 2 minutes
  private readonly LONG_TTL = 15 * 60 * 1000   // 15 minutes

  /**
   * Get data from cache or execute fetcher function with singleflight
   * Multiple concurrent calls with the same key will share the same promise
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<T> {
    // Check if we have valid cached data
    const cached = this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Check if we already have an in-flight request for this key
    const existingPromise = this.promiseCache.get(key)
    if (existingPromise) {
      console.log(`🔄 Singleflight: Using existing promise for key: ${key}`)
      return existingPromise
    }

    // Create new promise and cache it (singleflight pattern)
    const promise = this.executeWithCleanup(key, fetcher, ttl)
    this.promiseCache.set(key, promise)

    return promise
  }

  /**
   * Execute fetcher and handle cleanup of promise cache
   */
  private async executeWithCleanup<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    try {
      console.log(`📡 Fetching data for key: ${key}`)
      const data = await fetcher()

      // Cache the result
      this.set(key, data, ttl)
      console.log(`✅ Cached data for key: ${key} (TTL: ${ttl}ms)`)

      return data
    } catch (error) {
      console.error(`❌ Error fetching data for key: ${key}`, error)
      throw error
    } finally {
      // Always clean up the promise cache
      this.promiseCache.delete(key)
    }
  }

  /**
   * Get data from cache if valid, return null if not found or expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) {
      return null
    }

    const now = Date.now()
    if (now > entry.timestamp + entry.ttl) {
      // Entry expired, remove it
      this.cache.delete(key)
      console.log(`⏰ Cache entry expired for key: ${key}`)
      return null
    }

    console.log(`💾 Cache hit for key: ${key}`)
    return entry.data
  }

  /**
   * Set data in cache with TTL
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key)
    console.log(`🗑️ Invalidated cache for key: ${key}`)
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace('*', '.*'))
    const keysToDelete: string[] = []

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key)
    })

    console.log(`🗑️ Invalidated ${keysToDelete.length} cache entries matching pattern: ${pattern}`)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    this.promiseCache.clear()
    console.log(`🗑️ Cleared all cache entries`)
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalEntries: number
    activePromises: number
    entriesByPrefix: Record<string, number>
  } {
    const entriesByPrefix: Record<string, number> = {}

    for (const key of this.cache.keys()) {
      const prefix = key.split(':')[0]
      entriesByPrefix[prefix] = (entriesByPrefix[prefix] || 0) + 1
    }

    return {
      totalEntries: this.cache.size,
      activePromises: this.promiseCache.size,
      entriesByPrefix
    }
  }

  // Convenience methods for specific data types

  /**
   * Cache key generators for consistent naming
   */
  Keys = {
    transactions: (userId: string) => `transactions:${userId}`,
    symbols: (userId: string) => `symbols:${userId}`,
    historicalPrices: (symbol: string) => `historicalPrices:${symbol}`,
    customPrices: (userId: string, symbol: string) => `customPrices:${userId}:${symbol}`,
    portfolioData: (userId: string, currency: string) => `portfolioData:${userId}:${currency}`,
    historicalData: (userId: string, currency: string) => `historicalData:${userId}:${currency}`,
  }

  /**
   * Invalidate all data for a specific user
   */
  invalidateUserData(userId: string): void {
    this.invalidatePattern(`*:${userId}*`)
  }

  /**
   * Invalidate all price data for a specific symbol
   */
  invalidateSymbolPrices(symbol: string): void {
    this.invalidatePattern(`.*Prices:.*:${symbol}`)
    this.invalidatePattern(`historicalPrices:${symbol}`)
  }

  /**
   * Get appropriate TTL based on data type
   */
  getTTL(dataType: 'transactions' | 'symbols' | 'prices' | 'portfolio'): number {
    switch (dataType) {
      case 'transactions':
      case 'symbols':
        return this.LONG_TTL  // 15 minutes - changes less frequently
      case 'prices':
        return this.SHORT_TTL // 2 minutes - market data changes frequently
      case 'portfolio':
        return this.DEFAULT_TTL // 5 minutes - calculated data, medium frequency
      default:
        return this.DEFAULT_TTL
    }
  }
}

// Singleton instance
export const cacheService = new CacheService()