'use client'

import { useState } from 'react'
import { cacheService } from '@/lib/services/cache.service'

/**
 * Demo component to show cache functionality in action
 * This can be temporarily added to a page to demonstrate caching
 */
export function CacheDemo() {
  const [output, setOutput] = useState<string[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const log = (message: string) => {
    setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const simulateDataFetching = async () => {
    setIsRunning(true)
    setOutput([])

    log('🚀 Starting cache demonstration...')

    // Simulate fetching user transactions multiple times
    const mockFetcher = async () => {
      log('📡 Simulating expensive API call...')
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate 1s API call
      return ['transaction1', 'transaction2', 'transaction3']
    }

    try {
      // First call - should hit the API
      log('🔄 First call to getTransactions...')
      const result1 = await cacheService.getOrFetch('transactions:demo-user', mockFetcher)
      log(`✅ First call result: ${result1.length} transactions`)

      // Second call - should use cache
      log('🔄 Second call to getTransactions (should be cached)...')
      const result2 = await cacheService.getOrFetch('transactions:demo-user', mockFetcher)
      log(`✅ Second call result: ${result2.length} transactions`)

      // Multiple concurrent calls - should singleflight
      log('🔄 Making 3 concurrent calls...')
      const promises = [
        cacheService.getOrFetch('symbols:demo-user', async () => {
          log('📡 Fetching symbols from API...')
          await new Promise(resolve => setTimeout(resolve, 800))
          return ['AAPL', 'MSFT', 'GOOGL']
        }),
        cacheService.getOrFetch('symbols:demo-user', async () => {
          log('📡 This should not be called (singleflight)...')
          return ['Should not see this']
        }),
        cacheService.getOrFetch('symbols:demo-user', async () => {
          log('📡 This should also not be called (singleflight)...')
          return ['Should not see this either']
        })
      ]

      const results = await Promise.all(promises)
      log(`✅ Concurrent calls completed: ${results[0].length} symbols each`)

      // Show cache stats
      const stats = cacheService.getStats()
      log(`📊 Cache stats: ${stats.totalEntries} entries, ${stats.activePromises} active promises`)
      log(`📊 Cache breakdown: ${JSON.stringify(stats.entriesByPrefix)}`)

      // Invalidate and show effect
      log('🗑️ Invalidating user data...')
      cacheService.invalidateUserData('demo-user')

      const statsAfterInvalidation = cacheService.getStats()
      log(`📊 Cache stats after invalidation: ${statsAfterInvalidation.totalEntries} entries`)

    } catch (error) {
      log(`❌ Error: ${error}`)
    }

    setIsRunning(false)
    log('✅ Cache demonstration completed!')
  }

  return (
    <div className="bg-gray-50 p-6 rounded-lg border">
      <h3 className="text-lg font-semibold mb-4">Cache Service Demo</h3>

      <button
        onClick={simulateDataFetching}
        disabled={isRunning}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 mb-4"
      >
        {isRunning ? 'Running Demo...' : 'Run Cache Demo'}
      </button>

      <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-64 overflow-y-auto">
        {output.length === 0 ? (
          <div className="text-gray-500">Click "Run Cache Demo" to see caching in action...</div>
        ) : (
          output.map((line, index) => (
            <div key={index}>{line}</div>
          ))
        )}
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p><strong>What this demo shows:</strong></p>
        <ul className="list-disc ml-5 space-y-1">
          <li>First API call takes ~1 second, subsequent calls are instant (cached)</li>
          <li>Multiple concurrent calls with same key are deduplicated (singleflight)</li>
          <li>Cache statistics show active entries and breakdowns</li>
          <li>Cache invalidation removes entries as expected</li>
        </ul>
      </div>
    </div>
  )
}