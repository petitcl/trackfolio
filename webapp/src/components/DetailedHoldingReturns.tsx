'use client'

import React, { useState, useEffect } from 'react'
import { portfolioService, type ReturnMetrics } from '@/lib/services/portfolio.service'
import { type AuthUser } from '@/lib/auth/client.auth.service'
import { currencyService, type SupportedCurrency } from '@/lib/services/currency.service'
import { type TimeRange } from '@/lib/utils/timeranges'

interface DetailedHoldingReturnsProps {
  user: AuthUser
  symbol: string
  selectedCurrency: SupportedCurrency
  timeRange?: TimeRange
  className?: string
}

export default function DetailedHoldingReturns({
  user,
  symbol,
  selectedCurrency,
  timeRange = 'all',
  className = ''
}: DetailedHoldingReturnsProps) {
  const [detailedReturns, setDetailedReturns] = useState<ReturnMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDetailedReturns = async () => {
      try {
        setIsLoading(true)
        setError(null)
        console.log('📊 Loading detailed returns for holding:', symbol)

        const returns = await portfolioService.getHoldingReturnMetrics(
          user,
          symbol,
          selectedCurrency,
          timeRange
        )

        setDetailedReturns(returns)
      } catch (err) {
        console.error('❌ Failed to load detailed returns:', err)
        setError('Failed to load detailed return analysis')
      } finally {
        setIsLoading(false)
      }
    }

    loadDetailedReturns()
  }, [user, symbol, selectedCurrency, timeRange])

  const formatCurrency = (amount: number) => {
    return currencyService.formatCurrency(amount, selectedCurrency)
  }

  const formatPercent = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`
  }

  const getPnLColor = (value: number) => {
    if (value > 0) return 'text-green-600 dark:text-green-400'
    if (value < 0) return 'text-red-600 dark:text-red-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 shadow rounded-lg border dark:border-gray-700 ${className}`}>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !detailedReturns) {
    return (
      <div className={`bg-white dark:bg-gray-800 shadow rounded-lg border dark:border-gray-700 ${className}`}>
        <div className="p-6 text-center">
          <div className="text-gray-500 dark:text-gray-400">
            {error || 'No detailed return data available'}
          </div>
        </div>
      </div>
    )
  }


  return (
    <div className={`bg-white dark:bg-gray-800 shadow rounded-lg border dark:border-gray-700 ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          📊 Performance Breakdown - {symbol}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Detailed return analysis {timeRange !== 'all' ? `for ${timeRange}` : 'for all time'}
        </p>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          {/* Capital Gains */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="text-xl">📈</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">Capital Gains</span>
            </div>
            <div className="text-right">
              <div className={`text-sm font-medium ${getPnLColor(detailedReturns.capitalGains)}`}>
                {formatCurrency(detailedReturns.capitalGains)}
              </div>
            </div>
          </div>

          {/* Dividends */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="text-xl">💰</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">Dividends</span>
            </div>
            <div className="text-right">
              <div className={`text-sm font-medium ${getPnLColor(detailedReturns.dividends)}`}>
                {formatCurrency(detailedReturns.dividends)}
              </div>
            </div>
          </div>

          {/* Realized vs Unrealized */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Realized P&L</span>
              <div className={`text-sm font-medium ${getPnLColor(detailedReturns.realizedPnL)}`}>
                {formatCurrency(detailedReturns.realizedPnL)}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Unrealized P&L</span>
              <div className={`text-sm font-medium ${getPnLColor(detailedReturns.unrealizedPnL)}`}>
                {formatCurrency(detailedReturns.unrealizedPnL)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}