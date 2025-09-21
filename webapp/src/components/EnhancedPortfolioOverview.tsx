'use client'

import React from 'react'
import { type PortfolioSummaryV2, type AnnualizedReturnMetrics } from '@/lib/services/portfolio.service'
import { currencyService, type SupportedCurrency } from '@/lib/services/currency.service'

interface EnhancedPortfolioOverviewProps {
  summaryV2?: PortfolioSummaryV2
  annualizedReturns?: AnnualizedReturnMetrics
  totalValue: number
  totalCostBasis: number
  selectedCurrency: SupportedCurrency
}

export default function EnhancedPortfolioOverview({
  summaryV2,
  annualizedReturns,
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

  // Show basic overview if detailed data is not available
  if (!summaryV2 || !annualizedReturns) {
    return (
      <div className="space-y-6">
        {/* Basic Portfolio Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border dark:border-gray-700">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-2xl">💵</div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Cost Basis</dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-white">
                      {formatCurrency(totalCostBasis)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          📊 Detailed return metrics unavailable - insufficient historical data
        </div>
      </div>
    )
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
                    {formatCurrency(summaryV2.totalInvested)}
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
                  <dd className={`text-lg font-medium ${getPnLColor(summaryV2.totalPnL)}`}>
                    {formatCurrency(summaryV2.totalPnL)}
                  </dd>
                  <dd className={`text-xs ${getPnLColor(annualizedReturns.totalReturn)} mt-1`}>
                    {formatPercent(annualizedReturns.totalReturn)}
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
                  <dd className={`text-lg font-medium ${getPnLColor(annualizedReturns.timeWeightedReturn)}`}>
                    {formatPercent(annualizedReturns.timeWeightedReturn)}
                  </dd>
                  {annualizedReturns.periodYears > 0 && (
                    <dd className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {annualizedReturns.periodYears < 1 ?
                        `${Math.round(annualizedReturns.periodYears * 365)} days` :
                        `${annualizedReturns.periodYears.toFixed(1)} years`
                      }
                    </dd>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Simplified Return Details */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Return Breakdown</h3>
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
                <div className={`text-sm font-medium ${getPnLColor(summaryV2.capitalGains)}`}>
                  {formatCurrency(summaryV2.capitalGains)}
                </div>
              </div>
            </div>

            {/* Dividends */}
            {summaryV2.dividends > 0 && (
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">💰</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Dividends</span>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium ${getPnLColor(summaryV2.dividends)}`}>
                    {formatCurrency(summaryV2.dividends)}
                  </div>
                </div>
              </div>
            )}

            {/* Realized vs Unrealized */}
            <div className="border-t border-gray-200 dark:border-gray-600 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Realized P&L</span>
                <div className={`text-sm font-medium ${getPnLColor(summaryV2.realizedPnL)}`}>
                  {formatCurrency(summaryV2.realizedPnL)}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Unrealized P&L</span>
                <div className={`text-sm font-medium ${getPnLColor(summaryV2.unrealizedPnL)}`}>
                  {formatCurrency(summaryV2.unrealizedPnL)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}