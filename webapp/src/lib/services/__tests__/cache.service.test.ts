import { cacheService } from '../cache.service'

describe('CacheService', () => {
  beforeEach(() => {
    // Clear cache before each test
    cacheService.clear()
  })

  describe('Basic caching functionality', () => {
    it('should cache and retrieve data', () => {
      const testData = { foo: 'bar' }
      cacheService.set('test-key', testData)

      const retrieved = cacheService.get('test-key')
      expect(retrieved).toEqual(testData)
    })

    it('should return null for non-existent keys', () => {
      const retrieved = cacheService.get('non-existent')
      expect(retrieved).toBeNull()
    })

    it('should respect TTL and expire entries', async () => {
      const testData = { foo: 'bar' }
      const shortTTL = 100 // 100ms

      cacheService.set('test-key', testData, shortTTL)

      // Should be available immediately
      expect(cacheService.get('test-key')).toEqual(testData)

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, shortTTL + 50))

      // Should be expired now
      expect(cacheService.get('test-key')).toBeNull()
    })
  })

  describe('Singleflight pattern', () => {
    it('should deduplicate concurrent requests', async () => {
      let fetchCount = 0
      const testData = { result: 'test' }

      const fetcher = jest.fn(async () => {
        fetchCount++
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 100))
        return testData
      })

      // Make 3 concurrent requests with the same key
      const promises = [
        cacheService.getOrFetch('test-key', fetcher),
        cacheService.getOrFetch('test-key', fetcher),
        cacheService.getOrFetch('test-key', fetcher)
      ]

      const results = await Promise.all(promises)

      // All should return the same data
      results.forEach(result => {
        expect(result).toEqual(testData)
      })

      // Fetcher should only be called once (singleflight)
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(fetchCount).toBe(1)
    })

    it('should handle fetcher errors gracefully', async () => {
      const error = new Error('Fetch failed')
      const fetcher = jest.fn().mockRejectedValue(error)

      await expect(cacheService.getOrFetch('test-key', fetcher)).rejects.toThrow('Fetch failed')

      // Should not cache errors
      expect(cacheService.get('test-key')).toBeNull()
    })
  })

  describe('Cache invalidation', () => {
    it('should invalidate specific keys', () => {
      cacheService.set('key1', 'value1')
      cacheService.set('key2', 'value2')

      cacheService.invalidate('key1')

      expect(cacheService.get('key1')).toBeNull()
      expect(cacheService.get('key2')).toBe('value2')
    })

    it('should invalidate patterns', () => {
      cacheService.set('user:123:transactions', [])
      cacheService.set('user:123:symbols', [])
      cacheService.set('user:456:transactions', [])
      cacheService.set('prices:AAPL', {})

      cacheService.invalidatePattern('user:123:*')

      expect(cacheService.get('user:123:transactions')).toBeNull()
      expect(cacheService.get('user:123:symbols')).toBeNull()
      expect(cacheService.get('user:456:transactions')).toEqual([])
      expect(cacheService.get('prices:AAPL')).toEqual({})
    })

    it('should invalidate user data', () => {
      cacheService.set('transactions:user123', [])
      cacheService.set('symbols:user123', [])
      cacheService.set('customPrices:user123:CUSTOM', {})
      cacheService.set('transactions:user456', [])

      cacheService.invalidateUserData('user123')

      expect(cacheService.get('transactions:user123')).toBeNull()
      expect(cacheService.get('symbols:user123')).toBeNull()
      expect(cacheService.get('customPrices:user123:CUSTOM')).toBeNull()
      expect(cacheService.get('transactions:user456')).toEqual([])
    })

    it('should invalidate symbol prices', () => {
      cacheService.set('historicalPrices:AAPL', {})
      cacheService.set('customPrices:user123:AAPL', {})
      cacheService.set('customPrices:user456:AAPL', {})
      cacheService.set('historicalPrices:MSFT', {})

      cacheService.invalidateSymbolPrices('AAPL')

      expect(cacheService.get('historicalPrices:AAPL')).toBeNull()
      expect(cacheService.get('customPrices:user123:AAPL')).toBeNull()
      expect(cacheService.get('customPrices:user456:AAPL')).toBeNull()
      expect(cacheService.get('historicalPrices:MSFT')).toEqual({})
    })
  })

  describe('Cache statistics', () => {
    it('should provide accurate statistics', () => {
      cacheService.set('transactions:user1', [])
      cacheService.set('transactions:user2', [])
      cacheService.set('symbols:user1', [])
      cacheService.set('historicalPrices:AAPL', {})

      const stats = cacheService.getStats()

      expect(stats.totalEntries).toBe(4)
      expect(stats.activePromises).toBe(0)
      expect(stats.entriesByPrefix).toEqual({
        transactions: 2,
        symbols: 1,
        historicalPrices: 1
      })
    })
  })

  describe('Cache key generators', () => {
    it('should generate consistent cache keys', () => {
      expect(cacheService.Keys.transactions('user123')).toBe('transactions:user123')
      expect(cacheService.Keys.symbols('user123')).toBe('symbols:user123')
      expect(cacheService.Keys.historicalPrices('AAPL')).toBe('historicalPrices:AAPL')
      expect(cacheService.Keys.customPrices('user123', 'CUSTOM')).toBe('customPrices:user123:CUSTOM')
      expect(cacheService.Keys.portfolioData('user123', 'USD')).toBe('portfolioData:user123:USD')
      expect(cacheService.Keys.historicalData('user123', 'EUR')).toBe('historicalData:user123:EUR')
    })
  })

  describe('TTL helpers', () => {
    it('should return appropriate TTL values', () => {
      expect(cacheService.getTTL('transactions')).toBe(15 * 60 * 1000) // 15 minutes
      expect(cacheService.getTTL('symbols')).toBe(15 * 60 * 1000) // 15 minutes
      expect(cacheService.getTTL('prices')).toBe(2 * 60 * 1000) // 2 minutes
      expect(cacheService.getTTL('portfolio')).toBe(5 * 60 * 1000) // 5 minutes
    })
  })
})