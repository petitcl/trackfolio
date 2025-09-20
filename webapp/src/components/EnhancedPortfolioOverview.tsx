'use client'

import React from 'react'
import { type DetailedReturnMetrics } from '@/lib/services/return-calculation.service'
import { currencyService, type SupportedCurrency } from '@/lib/services/currency.service'

interface EnhancedPortfolioOverviewProps {
  detailedReturns: DetailedReturnMetrics
  totalValue: number
  totalCostBasis: number
  selectedCurrency: SupportedCurrency
}

export default function EnhancedPortfolioOverview({
  detailedReturns,
  totalValue,
  totalCostBasis,
  selectedCurrency
}: EnhancedPortfolioOverviewProps) {

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

  const getIconForCategory = (category: string) => {
    const icons: Record<string, string> = {
      total: '💰',
      invested: '💵',
      capitalGains: '📈',
      dividends: '💰',
      realized: '✅',
      unrealized: '📋'
    }
    return icons[category] || '❓'
  }

  return (
    <div className="space-y-6">
      {/* Main Portfolio Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Total Portfolio Value */}
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl">💰</div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Portfolio</dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {formatCurrency(totalValue)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Total Invested */}
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl">💵</div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Invested</dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {formatCurrency(detailedReturns.investmentSummary.totalInvested)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Total Return */}
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl">🎯</div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Return</dt>
                  <dd className={`text-lg font-medium ${getPnLColor(detailedReturns.totalReturn)}`}>
                    {formatCurrency(totalValue - detailedReturns.investmentSummary.totalInvested)}
                  </dd>
                  <dd className={`text-xs ${getPnLColor(detailedReturns.totalReturn)} mt-1`}>
                    {formatPercent(detailedReturns.totalReturn)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Annualized Return */}
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border dark:border-gray-700">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl">📊</div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Annualized Return</dt>
                  <dd className={`text-lg font-medium ${getPnLColor(detailedReturns.timeWeightedReturn)}`}>
                    {formatPercent(detailedReturns.timeWeightedReturn)}
                  </dd>
                  {detailedReturns.periodYears > 0 && (
                    <dd className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {detailedReturns.periodYears < 1 ?
                        `${Math.round(detailedReturns.periodYears * 365)} days` :
                        `${detailedReturns.periodYears.toFixed(1)} years`
                      }
                    </dd>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Return Breakdown */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">📊 Return Breakdown</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Detailed analysis of your portfolio performance</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Capital Gains vs Dividend Income */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Capital Gains */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <span className="text-xl">📈</span>
                <h4 className="text-md font-medium text-gray-900 dark:text-white">Capital Gains</h4>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Realized Gains</span>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${getPnLColor(detailedReturns.capitalGains.realized)}`}>
                      {formatCurrency(detailedReturns.capitalGains.realized)}
                    </div>
                    <div className={`text-xs ${getPnLColor(detailedReturns.capitalGains.realizedPercentage)}`}>
                      {formatPercent(detailedReturns.capitalGains.realizedPercentage)}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Unrealized Gains</span>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${getPnLColor(detailedReturns.capitalGains.unrealized)}`}>
                      {formatCurrency(detailedReturns.capitalGains.unrealized)}
                    </div>
                    <div className={`text-xs ${getPnLColor(detailedReturns.capitalGains.unrealizedPercentage)}`}>
                      {formatPercent(detailedReturns.capitalGains.unrealizedPercentage)}
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Capital Gains</span>
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${getPnLColor(detailedReturns.capitalGains.realized + detailedReturns.capitalGains.unrealized)}`}>
                        {formatCurrency(detailedReturns.capitalGains.realized + detailedReturns.capitalGains.unrealized)}
                      </div>
                      <div className={`text-xs ${getPnLColor(detailedReturns.capitalGains.annualizedRate)}`}>
                        {formatPercent(detailedReturns.capitalGains.annualizedRate)} annual
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dividend Income */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <span className="text-xl">💰</span>
                <h4 className="text-md font-medium text-gray-900 dark:text-white">Dividend Income</h4>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Dividends</span>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${getPnLColor(detailedReturns.dividendIncome.total)}`}>
                      {formatCurrency(detailedReturns.dividendIncome.total)}
                    </div>
                    <div className={`text-xs ${getPnLColor(detailedReturns.dividendIncome.percentage)}`}>
                      {formatPercent(detailedReturns.dividendIncome.percentage)}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Annualized Yield</span>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${getPnLColor(detailedReturns.dividendIncome.annualizedYield)}`}>
                      {formatPercent(detailedReturns.dividendIncome.annualizedYield)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Realized vs Unrealized Summary */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-xl">⚖️</span>
              <h4 className="text-md font-medium text-gray-900 dark:text-white">Realized vs Unrealized Summary</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">✅ Realized Returns</span>
                <div className="text-right">
                  <div className={`text-sm font-medium ${getPnLColor(detailedReturns.realizedVsUnrealized.totalRealized)}`}>
                    {formatCurrency(detailedReturns.realizedVsUnrealized.totalRealized)}
                  </div>
                  <div className={`text-xs ${getPnLColor(detailedReturns.realizedVsUnrealized.realizedPercentage)}`}>
                    {formatPercent(detailedReturns.realizedVsUnrealized.realizedPercentage)} of total
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">📋 Unrealized Returns</span>
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

          {/* Investment Summary */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-xl">📋</span>
              <h4 className="text-md font-medium text-gray-900 dark:text-white">Investment Summary</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-gray-500 dark:text-gray-400">Money Invested</div>
                <div className="text-lg font-medium text-gray-900 dark:text-white">
                  {formatCurrency(detailedReturns.investmentSummary.totalInvested)}
                </div>
              </div>

              <div className="text-center">
                <div className="text-gray-500 dark:text-gray-400">Current Value</div>
                <div className="text-lg font-medium text-gray-900 dark:text-white">
                  {formatCurrency(detailedReturns.investmentSummary.currentValue)}
                </div>
              </div>

              <div className="text-center">
                <div className="text-gray-500 dark:text-gray-400">Money Withdrawn</div>
                <div className="text-lg font-medium text-gray-900 dark:text-white">
                  {formatCurrency(detailedReturns.investmentSummary.totalWithdrawn)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}