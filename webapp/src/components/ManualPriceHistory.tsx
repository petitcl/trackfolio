'use client'

import React, { useState, useEffect } from 'react'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import type { UserSymbolPrice } from '@/lib/supabase/database.types'
import { portfolioService } from '@/lib/services/portfolio.service'

interface ManualPriceHistoryProps {
  user: AuthUser
  symbol: string
  onPriceUpdated?: () => void
}

export default function ManualPriceHistory({ user, symbol, onPriceUpdated }: ManualPriceHistoryProps) {
  const [prices, setPrices] = useState<UserSymbolPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [displayedCount, setDisplayedCount] = useState(20)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    loadPriceHistory()
  }, [user, symbol]) // loadPriceHistory is stable, doesn't need to be in deps

  const loadPriceHistory = async () => {
    try {
      setLoading(true)
      const priceHistory = await portfolioService.getUserSymbolPrices(user, symbol)
      setPrices(priceHistory)
      setHasMore(priceHistory.length > 20)
    } catch (err) {
      console.error('Error loading price history:', err)
      setError('Failed to load price history')
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePrice = async (priceId: string) => {
    if (!confirm('Are you sure you want to delete this price entry?')) {
      return
    }

    try {
      await portfolioService.deleteUserSymbolPrice(user, priceId)
      await loadPriceHistory() // Refresh the list
      onPriceUpdated?.()
    } catch (err) {
      console.error('Error deleting price:', err)
      alert('Failed to delete price entry')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const calculatePriceChange = (currentPrice: number, previousPrice: number | null) => {
    if (!previousPrice) return null
    const change = ((currentPrice - previousPrice) / previousPrice) * 100
    return change
  }

  const displayedPrices = prices.slice(0, displayedCount)
  const remainingCount = Math.max(0, prices.length - displayedCount)

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border dark:border-gray-700">
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4 w-48"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border dark:border-gray-700">
        <div className="p-6">
          <div className="text-red-600 dark:text-red-400">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg border dark:border-gray-700">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Price History</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manual price updates for {symbol}
        </p>
      </div>

      {prices.length === 0 ? (
        <div className="p-6 text-center">
          <div className="text-gray-500 dark:text-gray-400">
            <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No price history</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Add manual price updates to track historical values.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Change
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {displayedPrices.map((price, index) => {
                const previousPrice = index < displayedPrices.length - 1 ? displayedPrices[index + 1].manual_price : null
                const priceChange = calculatePriceChange(price.manual_price, previousPrice)
                
                return (
                  <tr key={price.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatDate(price.price_date)}
                      {index === 0 && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Latest
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(price.manual_price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {priceChange !== null ? (
                        <span className={`inline-flex items-center ${
                          priceChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {priceChange >= 0 ? '↗' : '↘'} {Math.abs(priceChange).toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="max-w-xs truncate" title={price.notes || ''}>
                        {price.notes || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <button
                        onClick={() => handleDeletePrice(price.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        title="Delete this price entry"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          
          {remainingCount > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setDisplayedCount(prev => prev + 20)}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
              >
                Load More ({remainingCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}