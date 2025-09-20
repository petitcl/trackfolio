'use client'

import React, { useState, useEffect } from 'react'
import { type DetailedReturnMetrics } from '@/lib/services/return-calculation.service'
import { portfolioService } from '@/lib/services/portfolio.service'
import { type AuthUser } from '@/lib/auth/client.auth.service'
import { currencyService, type SupportedCurrency } from '@/lib/services/currency.service'
import { type TimeRange } from '@/components/TimeRangeSelector'

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
  const [detailedReturns, setDetailedReturns] = useState<DetailedReturnMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDetailedReturns = async () => {
      try {
        setIsLoading(true)
        setError(null)
        console.log('📊 Loading detailed returns for holding:', symbol)

        const returns = await portfolioService.getHoldingDetailedReturns(
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

  const hasRealizedGains = detailedReturns.capitalGains.realized !== 0
  const hasDividends = detailedReturns.dividendIncome.total > 0
  const hasWithdrawals = detailedReturns.investmentSummary.totalWithdrawn > 0

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
        <div className="space-y-6">
          {/* Main Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Return</div>
              <div className={`text-lg font-semibold ${getPnLColor(detailedReturns.totalReturn)}`}>
                {formatPercent(detailedReturns.totalReturn)}
              </div>
              <div className={`text-xs ${getPnLColor(detailedReturns.totalReturn)}`}>
                {formatCurrency(detailedReturns.investmentSummary.currentValue - detailedReturns.investmentSummary.totalInvested)}
              </div>
            </div>

            <div className="text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400">Annualized</div>
              <div className={`text-lg font-semibold ${getPnLColor(detailedReturns.timeWeightedReturn)}`}>
                {formatPercent(detailedReturns.timeWeightedReturn)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {detailedReturns.periodYears < 1 ?
                  `${Math.round(detailedReturns.periodYears * 365)}d` :
                  `${detailedReturns.periodYears.toFixed(1)}y`
                }
              </div>
            </div>

            <div className="text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400">Invested</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatCurrency(detailedReturns.investmentSummary.totalInvested)}
              </div>
            </div>

            <div className="text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400">Current Value</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatCurrency(detailedReturns.investmentSummary.currentValue)}
              </div>
            </div>
          </div>

          {/* Return Components */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
            <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Return Components</h4>

            <div className="space-y-4">
              {/* Capital Gains */}
              <div className="flex justify-between items-center py-2">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">📈</span>
                  <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Capital Gains</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Price appreciation</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium ${getPnLColor(detailedReturns.capitalGains.realized + detailedReturns.capitalGains.unrealized)}`}>
                    {formatCurrency(detailedReturns.capitalGains.realized + detailedReturns.capitalGains.unrealized)}
                  </div>
                  <div className={`text-xs ${getPnLColor(detailedReturns.capitalGains.annualizedRate)}`}>
                    {formatPercent(detailedReturns.capitalGains.annualizedRate)} annual
                  </div>
                </div>
              </div>

              {/* Dividends (if any) */}
              {hasDividends && (
                <div className="flex justify-between items-center py-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">💰</span>
                    <div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Dividend Income</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Cash distributions</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${getPnLColor(detailedReturns.dividendIncome.total)}`}>
                      {formatCurrency(detailedReturns.dividendIncome.total)}
                    </div>
                    <div className={`text-xs ${getPnLColor(detailedReturns.dividendIncome.annualizedYield)}`}>
                      {formatPercent(detailedReturns.dividendIncome.annualizedYield)} yield
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Realized vs Unrealized */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
            <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Realized vs Unrealized</h4>

            <div className="space-y-3">
              {hasRealizedGains ? (
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">✅</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Realized Returns</span>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${getPnLColor(detailedReturns.realizedVsUnrealized.totalRealized)}`}>
                      {formatCurrency(detailedReturns.realizedVsUnrealized.totalRealized)}
                    </div>
                    <div className={`text-xs ${getPnLColor(detailedReturns.realizedVsUnrealized.realizedPercentage)}`}>
                      {formatPercent(detailedReturns.realizedVsUnrealized.realizedPercentage)} of total
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2 text-gray-500 dark:text-gray-400 text-sm">
                  📋 All returns are unrealized (no sales yet)
                </div>
              )}

              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">📋</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Unrealized Returns</span>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium ${getPnLColor(detailedReturns.realizedVsUnrealized.totalUnrealized)}`}>
                    {formatCurrency(detailedReturns.realizedVsUnrealized.totalUnrealized)}
                  </div>
                  <div className={`text-xs ${getPnLColor(detailedReturns.realizedVsUnrealized.unrealizedPercentage)}`}>
                    {formatPercent(detailedReturns.realizedVsUnrealized.unrealizedPercentage)} of total
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Money Weighted Return (XIRR) */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-md font-medium text-gray-900 dark:text-white">Money-Weighted Return (XIRR)</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Includes timing of cash flows</p>
              </div>
              <div className="text-right">
                <div className={`text-lg font-semibold ${getPnLColor(detailedReturns.moneyWeightedReturn)}`}>
                  {formatPercent(detailedReturns.moneyWeightedReturn)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Investor experience</div>
              </div>
            </div>
          </div>

          {/* Cash Flow Summary */}
          {hasWithdrawals && (
            <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
              <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Cash Flow Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-center text-sm">
                <div>
                  <div className="text-gray-500 dark:text-gray-400">Money In</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(detailedReturns.investmentSummary.totalInvested)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-gray-400">Money Out</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(detailedReturns.investmentSummary.totalWithdrawn)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-gray-400">Net Invested</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(detailedReturns.investmentSummary.totalInvested - detailedReturns.investmentSummary.totalWithdrawn)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}