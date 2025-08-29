'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { AuthUser } from '@/lib/auth/auth.service'
import type { Transaction, Symbol } from '@/lib/supabase/database.types'
import { portfolioService, type PortfolioPosition } from '@/lib/services/portfolio.service'
import ValueEvolutionChart from './charts/ValueEvolutionChart'
import TimeRangeSelector, { type TimeRange } from './TimeRangeSelector'
import type { HistoricalDataPoint } from '@/lib/mockData'

interface HoldingDetailsProps {
  user: AuthUser
  symbol: string
}

interface HoldingData {
  position: PortfolioPosition | null
  symbol: Symbol | null
  transactions: Transaction[]
  historicalData: HistoricalDataPoint[]
}

export default function HoldingDetails({ user, symbol }: HoldingDetailsProps) {
  const [loading, setLoading] = useState(true)
  const [holdingData, setHoldingData] = useState<HoldingData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('6m')
  const router = useRouter()

  useEffect(() => {
    const loadHoldingData = async () => {
      try {
        setLoading(true)
        console.log(`🔍 Loading holding data for symbol: ${symbol}`)

        // Get all portfolio data and filter for this symbol
        const [portfolioData, symbols, transactions, historicalData] = await Promise.all([
          portfolioService.getPortfolioData(user),
          portfolioService.getSymbols(user),
          portfolioService.getTransactions(user),
          portfolioService.getHoldingHistoricalData(user, symbol)
        ])

        const symbolData = symbols.find(s => s.symbol === symbol)
        const symbolTransactions = transactions.filter(t => t.symbol === symbol)
        const position = portfolioData.positions.find(p => p.symbol === symbol) || null

        if (!symbolData && !position) {
          setError(`Holding "${symbol}" not found`)
          return
        }

        setHoldingData({
          position,
          symbol: symbolData || null,
          transactions: symbolTransactions,
          historicalData
        })

        console.log(`✅ Loaded ${symbolTransactions.length} transactions for ${symbol}`)
      } catch (err) {
        console.error('Error loading holding data:', err)
        setError('Failed to load holding data')
      } finally {
        setLoading(false)
      }
    }

    loadHoldingData()
  }, [user, symbol])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatPercent = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`
  }

  const getAssetTypeIcon = (assetType: string) => {
    const icons: Record<string, string> = {
      stock: '📈',
      etf: '📊',
      crypto: '₿',
      cash: '💵',
      real_estate: '🏠',
      other: '💎'
    }
    return icons[assetType] || '❓'
  }

  const getTransactionTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      buy: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
      sell: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
      dividend: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
      bonus: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20',
      deposit: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20',
      withdrawal: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20'
    }
    return colors[type] || 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading holding details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Link 
            href="/" 
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (!holdingData) {
    return null
  }

  const { position, symbol: symbolData, transactions } = holdingData

  // Calculate realized P&L from sell transactions
  const realizedPnL = transactions
    .filter(t => t.type === 'sell')
    .reduce((total, t) => {
      // Simplified calculation - in reality you'd track cost basis more precisely
      return total + ((t.price_per_unit - (position?.avgCost || 0)) * t.quantity) - t.fees
    }, 0)

  const totalReturn = position ? position.unrealizedPnL + realizedPnL : realizedPnL

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Link 
                href="/" 
                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center"
              >
                ← Dashboard
              </Link>
              <div>
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getAssetTypeIcon(symbolData?.asset_type || 'other')}</span>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{symbol}</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {symbolData?.name || 'Unknown Asset'}
                      {symbolData?.is_custom && (
                        <span className="ml-2 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                          Custom Asset
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatCurrency(symbolData?.last_price || 0)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Last updated: {symbolData?.last_updated ? 
                  new Date(symbolData.last_updated).toLocaleDateString() : 
                  'Never'
                }
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Current Position */}
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border dark:border-gray-700">
            <div className="p-5">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Current Position</h3>
              <div className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Quantity</dt>
                  <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                    {position?.quantity.toLocaleString() || '0'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Market Value</dt>
                  <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(position?.value || 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Portfolio Weight</dt>
                  <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                    2.5% {/* TODO: Calculate actual percentage */}
                  </dd>
                </div>
              </div>
            </div>
          </div>

          {/* Cost Basis */}
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border dark:border-gray-700">
            <div className="p-5">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Cost Basis</h3>
              <div className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Average Cost</dt>
                  <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(position?.avgCost || 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Invested</dt>
                  <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatCurrency((position?.avgCost || 0) * (position?.quantity || 0))}
                  </dd>
                </div>
              </div>
            </div>
          </div>

          {/* Performance */}
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border dark:border-gray-700">
            <div className="p-5">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Performance</h3>
              <div className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Unrealized P&L</dt>
                  <dd className={`text-lg font-semibold ${position && position.unrealizedPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(position?.unrealizedPnL || 0)}
                    {position && (
                      <span className="text-sm ml-2">
                        ({formatPercent((position.unrealizedPnL / (position.avgCost * position.quantity)) * 100)})
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Realized P&L</dt>
                  <dd className={`text-lg font-semibold ${realizedPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(realizedPnL)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Return</dt>
                  <dd className={`text-lg font-semibold ${totalReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(totalReturn)}
                  </dd>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Value Evolution Chart */}
        {holdingData.historicalData.length > 0 && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {symbol} Value Over Time
              </h3>
              <TimeRangeSelector
                value={timeRange}
                onChange={setTimeRange}
              />
            </div>
            <ValueEvolutionChart
              data={holdingData.historicalData}
              timeRange={timeRange}
              title={`${symbol} Value Evolution`}
              description={`Holding value vs. cost basis in EUR (${timeRange.toUpperCase()})`}
              valueLabel={`${symbol} Value`}
              investedLabel="Cost Basis"
              currency="EUR"
              showInvested={true}
            />
          </div>
        )}

        {/* Manual Price Update (for custom assets only) */}
        {symbolData?.is_custom && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg border dark:border-gray-700 mb-8">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Manual Price Update</h3>
              <div className="flex items-center space-x-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={symbolData.last_price || 0}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <button className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800">
                  Update Price
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transaction History */}
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md border dark:border-gray-700">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Transaction History</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              All transactions for {symbol}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fees</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {transactions.map((transaction) => {
                  const total = transaction.quantity * transaction.price_per_unit + transaction.fees
                  return (
                    <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                        {new Date(transaction.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTransactionTypeColor(transaction.type)}`}>
                          {transaction.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                        {transaction.quantity.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                        {formatCurrency(transaction.price_per_unit)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                        {formatCurrency(transaction.fees)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {formatCurrency(total)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {transaction.notes || '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap gap-4">
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm bg-white dark:bg-gray-700 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800">
            📈 Add Transaction
          </button>
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm bg-white dark:bg-gray-700 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800">
            📥 Import Transactions
          </button>
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm bg-white dark:bg-gray-700 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800">
            📤 Export Data
          </button>
        </div>
      </main>
    </div>
  )
}