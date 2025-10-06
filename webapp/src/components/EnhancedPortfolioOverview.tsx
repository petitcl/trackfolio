'use client'

import React from 'react'
import { type ReturnMetrics } from '@/lib/services/portfolio.service'
import { currencyService, type SupportedCurrency } from '@/lib/services/currency.service'
import ProfitDisplay from './ProfitDisplay'

interface EnhancedPortfolioOverviewProps {
  returns: ReturnMetrics
  selectedCurrency: SupportedCurrency
}

export default function EnhancedPortfolioOverview({
  returns,
  selectedCurrency
}: EnhancedPortfolioOverviewProps) {

  const formatCurrency = (amount: number) => {
    return currencyService.formatCurrency(amount, selectedCurrency)
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
                    {formatCurrency(returns.totalValue)}
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
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Cost Basis</dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {formatCurrency(returns.costBasis)}
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
                  <dd>
                    <ProfitDisplay value={returns.totalPnL} format="currency" currency={selectedCurrency} className="text-lg font-medium" />
                  </dd>
                  <dd className="mt-1">
                    <ProfitDisplay value={returns.totalReturnPercentage} format="percentage" className="text-xs" />
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
                  <dd>
                    <ProfitDisplay value={returns.moneyWeightedReturn} format="percentage" className="text-lg font-medium" />
                  </dd>
                  {returns.periodYears > 0 && (
                    <dd className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {returns.periodYears < 1 ?
                        `${Math.round(returns.periodYears * 365)} days` :
                        `${returns.periodYears.toFixed(1)} years`
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
                <ProfitDisplay value={returns.capitalGains} format="currency" currency={selectedCurrency} className="text-sm font-medium" />
              </div>
            </div>

            {/* Dividends */}
            <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">💰</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Dividends</span>
                </div>
                <div className="text-right">
                  <ProfitDisplay value={returns.dividends} format="currency" currency={selectedCurrency} className="text-sm font-medium" />
                </div>
              </div>

            {/* Realized vs Unrealized */}
            <div className="border-t border-gray-200 dark:border-gray-600 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Realized P&L</span>
                <ProfitDisplay value={returns.realizedPnL} format="currency" currency={selectedCurrency} className="text-sm font-medium" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Unrealized P&L</span>
                <ProfitDisplay value={returns.unrealizedPnL} format="currency" currency={selectedCurrency} className="text-sm font-medium" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}