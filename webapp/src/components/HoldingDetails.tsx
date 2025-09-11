'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import type { Transaction, Symbol } from '@/lib/supabase/types'
import { portfolioService, type PortfolioPosition, type PortfolioData } from '@/lib/services/portfolio.service'
import ValueEvolutionChart from './charts/ValueEvolutionChart'
import TimeRangeSelector, { type TimeRange } from './TimeRangeSelector'
import type { HistoricalDataPoint } from '@/lib/mockData'
import QuickActions from './QuickActions'
import DemoModeBanner from './DemoModeBanner'
import ConfirmDialog from './ConfirmDialog'
import PriceManagement from './PriceManagement'
import TransactionManagement from './TransactionManagement'

interface HoldingDetailsProps {
  user: AuthUser
  symbol: string
}

interface HoldingData {
  position: PortfolioPosition | null
  symbol: Symbol | null
  transactions: Transaction[]
  historicalData: HistoricalDataPoint[]
  portfolioData: PortfolioData
}

export default function HoldingDetails({ user, symbol }: HoldingDetailsProps) {
  const [loading, setLoading] = useState(true)
  const [holdingData, setHoldingData] = useState<HoldingData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
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
          historicalData,
          portfolioData
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

  const formatPercentageOnly = (percent: number) => {
    return `${percent.toFixed(2)}%`
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

  const handleDeleteHolding = async () => {
    if (!holdingData) return
    
    setIsDeleting(true)
    try {
      const result = await portfolioService.deleteHolding(user, symbol)
      
      if (result.success) {
        console.log(`✅ Successfully deleted holding: ${symbol}`)
        router.push('/')
      } else {
        console.error('Failed to delete holding:', result.error)
        setError(result.error || 'Failed to delete holding')
        setIsDeleting(false)
      }
    } catch (err) {
      console.error('Error deleting holding:', err)
      setError('An unexpected error occurred while deleting the holding')
      setIsDeleting(false)
    }
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

  const { position, symbol: symbolData, transactions, portfolioData } = holdingData

  // Calculate realized P&L from sell transactions
  const realizedPnL = transactions
    .filter(t => t.type === 'sell')
    .reduce((total, t) => {
      // Simplified calculation - in reality you'd track cost basis more precisely
      return total + ((t.price_per_unit - (position?.avgCost || 0)) * t.quantity) - (t.fees || 0)
    }, 0)

  const totalReturn = position ? position.unrealizedPnL + realizedPnL : realizedPnL

  // Calculate portfolio weight
  const portfolioWeight = position && portfolioData.totalValue > 0 
    ? (position.value / portfolioData.totalValue) * 100 
    : 0

  // Calculate time-range specific performance metrics
  const calculateTimeRangeMetrics = () => {
    if (timeRange === 'all') {
      return {
        realizedPnL,
        unrealizedPnL: position?.unrealizedPnL || 0,
        totalReturn
      }
    }

    // Filter transactions based on time range
    const now = new Date()
    let startDate: Date
    
    switch (timeRange) {
      case '5d':
        startDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
        break
      case '1m':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '6m':
        startDate = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000)
        break
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      case '5y':
        startDate = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000) // Default to 6m
    }

    const startDateString = startDate.toISOString().split('T')[0]
    
    // Calculate realized P&L for the time range
    const timeRangeRealizedPnL = transactions
      .filter(t => t.type === 'sell' && t.date >= startDateString)
      .reduce((total, t) => {
        return total + ((t.price_per_unit - (position?.avgCost || 0)) * t.quantity) - (t.fees || 0)
      }, 0)

    // Find position value at start of time range from historical data
    const startPointData = holdingData.historicalData.find(point => point.date >= startDateString)
    const currentValue = position?.value || 0
    const startValue = startPointData?.totalValue || currentValue
    
    // Calculate unrealized P&L change over the time range
    const valueChange = currentValue - startValue
    
    return {
      realizedPnL: timeRangeRealizedPnL,
      unrealizedPnL: valueChange,
      totalReturn: timeRangeRealizedPnL + valueChange
    }
  }

  const timeRangeMetrics = calculateTimeRangeMetrics()

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
          </div>
        </div>
      </header>

      {/* Demo Mode Banner */}
      <DemoModeBanner />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Time Range Selector */}
        <div className="mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{symbol} Analytics</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Performance and value evolution over time</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Last Updated: {symbolData?.last_updated ? 
                    new Date(symbolData.last_updated).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    }) : 
                    'Never'
                  }
                </p>
              </div>
              <TimeRangeSelector
                selectedRange={timeRange}
                onRangeChange={setTimeRange}
              />
            </div>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Current Position */}
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border dark:border-gray-700">
            <div className="p-5">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Current Position</h3>
              <div className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Price</dt>
                  <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(symbolData?.last_price || 0)}
                  </dd>
                </div>
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
                    {formatPercentageOnly(portfolioWeight)}
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
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Performance</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                {timeRange === 'all' ? 'All-time performance' : `Performance over ${timeRange.toUpperCase()}`}
              </p>
              <div className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {timeRange === 'all' ? 'Unrealized P&L' : 'Value Change'}
                  </dt>
                  <dd className={`text-lg font-semibold ${timeRangeMetrics.unrealizedPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(timeRangeMetrics.unrealizedPnL)}
                    {position && timeRange === 'all' && (
                      <span className="text-sm ml-2">
                        ({formatPercent((position.unrealizedPnL / (position.avgCost * position.quantity)) * 100)})
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {timeRange === 'all' ? 'Realized P&L' : 'Realized P&L (Period)'}
                  </dt>
                  <dd className={`text-lg font-semibold ${timeRangeMetrics.realizedPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(timeRangeMetrics.realizedPnL)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Return</dt>
                  <dd className={`text-lg font-semibold ${timeRangeMetrics.totalReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(timeRangeMetrics.totalReturn)}
                  </dd>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Value Evolution Chart */}
        {holdingData.historicalData.length > 0 && (
          <div className="mb-8">
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

        {/* Transaction Management */}
        <div className="mb-8">
          <TransactionManagement
            user={user}
            symbol={symbol}
            symbolName={symbolData?.name || 'Unknown Asset'}
            transactions={transactions}
            onTransactionUpdated={() => {
              // Reload the holding data when transactions are updated
              window.location.reload() // Temporary solution - in production this should be more elegant
            }}
          />
        </div>

        {/* Price Management (for custom assets only) */}
        {symbolData?.is_custom && (
          <div className="mb-8">
            <PriceManagement user={user} symbol={symbol} />
          </div>
        )}

        {/* Quick Actions */}
        <QuickActions
          title={`${symbol} Actions`}
          actions={[
            {
              id: 'export-data',
              icon: '📤', 
              label: 'Export Data',
              onClick: () => console.log('Export data for', symbol)
            },
            {
              id: 'delete-holding',
              icon: '🗑️',
              label: 'Delete Holding',
              onClick: () => setShowDeleteConfirm(true)
            }
          ]}
          columns={2}
          className="mt-8"
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteHolding}
          title="Delete Holding"
          message={`Are you sure you want to delete ${symbol}? This will permanently delete all transactions${holdingData?.symbol?.is_custom ? ', custom prices, and the custom symbol' : ' and custom prices'} associated with this holding. This action cannot be undone.`}
          confirmText="Delete Holding"
          confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
          isLoading={isDeleting}
          loadingText="Deleting..."
        />

      </main>
    </div>
  )
}