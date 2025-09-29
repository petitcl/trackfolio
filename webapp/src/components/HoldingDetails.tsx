'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import type { Transaction, Symbol } from '@/lib/supabase/types'
import { portfolioService, type PortfolioPosition, type PortfolioData, type AnnualizedReturnMetrics } from '@/lib/services/portfolio.service'
import ValueEvolutionChart from './charts/ValueEvolutionChart'
import TimeRangeSelector, { type TimeRange } from './TimeRangeSelector'
import type { HistoricalDataPoint } from '@/lib/mockData'
import QuickActions from './QuickActions'
import DemoModeBanner from './DemoModeBanner'
import ConfirmDialog from './ConfirmDialog'
import PriceManagement from './PriceManagement'
import TransactionManagement from './TransactionManagement'
import { currencyService, type SupportedCurrency } from '@/lib/services/currency.service'
import DetailedHoldingReturns from './DetailedHoldingReturns'
import Header from '@/components/Header'

interface HoldingDetailsProps {
  user: AuthUser
  symbol: string
  selectedCurrency?: SupportedCurrency
  onCurrencyChange?: (currency: SupportedCurrency) => void
}

interface HoldingData {
  position: PortfolioPosition | null
  symbol: Symbol | null
  transactions: Transaction[]
  historicalData: HistoricalDataPoint[]
  portfolioData: PortfolioData
  annualizedReturns: AnnualizedReturnMetrics | null
  detailedReturns: any | null
}

export default function HoldingDetails({ user, symbol, selectedCurrency = 'USD', onCurrencyChange }: HoldingDetailsProps) {
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
        const [portfolioData, symbols, transactions, historicalData, annualizedReturns, detailedReturns] = await Promise.all([
          portfolioService.getPortfolioData(user, selectedCurrency),
          portfolioService.getSymbols(user),
          portfolioService.getTransactions(user),
          portfolioService.getHoldingHistoricalData(user, symbol, selectedCurrency),
          portfolioService.getHoldingAnnualizedReturns(user, symbol, selectedCurrency, timeRange),
          portfolioService.getHoldingDetailedReturns(user, symbol, selectedCurrency, timeRange)
        ])

        const symbolData = symbols.find(s => s.symbol === symbol)
        const symbolTransactions = transactions.filter(t => t.symbol === symbol)
        const position = portfolioData.positions.find(p => p.symbol === symbol) || null
        
        const lastHistoricalDataPoint = historicalData.at(-1);
        console.log('HoldingDetails - symbolData', symbolData);
        console.log('HoldingDetails - portfolioData', portfolioData);
        console.log('HoldingDetails - lastHistoricalDataPoint', lastHistoricalDataPoint);
        console.log('HoldingDetails - position', position);
        console.log('HoldingDetails - annualizedReturns', annualizedReturns);
        console.log('HoldingDetails - detailedReturns', detailedReturns);

        if (!symbolData && !position) {
          setError(`Holding "${symbol}" not found`)
          return
        }

        setHoldingData({
          position,
          symbol: symbolData || null,
          transactions: symbolTransactions,
          historicalData,
          portfolioData,
          annualizedReturns,
          detailedReturns
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
  }, [user, symbol, selectedCurrency, timeRange])

  const formatCurrency = (amount: number) => {
    return currencyService.formatCurrency(amount, selectedCurrency)
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

  const { position, symbol: symbolData, transactions, portfolioData, detailedReturns } = holdingData

  // Use detailed returns data for consistent calculations
  const currentValue = detailedReturns?.summaryV2
    ? detailedReturns.summaryV2.costBasis + detailedReturns.summaryV2.unrealizedPnL
    : position?.value || 0

  const costBasis = detailedReturns?.summaryV2?.costBasis || (position ? position.quantity * position.avgCost : 0)
  const currentPrice = currentValue && position?.quantity ? currentValue / position.quantity : position?.currentPrice || 0
  const quantity = position?.quantity || 0

  // Use detailed returns data for P&L calculations
  const realizedPnL = detailedReturns?.summaryV2?.realizedPnL || 0
  const unrealizedPnL = detailedReturns?.summaryV2?.unrealizedPnL || 0
  const totalReturn = detailedReturns?.summaryV2?.totalPnL || (unrealizedPnL + realizedPnL)
  const totalInvested = detailedReturns?.summaryV2?.totalInvested || 0

  // Calculate portfolio weight using consistent current value
  const portfolioWeight = currentValue && portfolioData.totalValue > 0
    ? (currentValue / portfolioData.totalValue) * 100
    : 0

  // Calculate time-range specific performance metrics
  const calculateTimeRangeMetrics = () => {
    // Now using time-range specific detailed returns data
    return {
      realizedPnL,
      unrealizedPnL,
      totalReturn
    }
  }

  const timeRangeMetrics = calculateTimeRangeMetrics()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <Header
        user={user}
        showCurrencySelector={true}
        selectedCurrency={selectedCurrency}
        onCurrencyChange={onCurrencyChange}
        backLink={{
          href: '/',
          label: 'Dashboard'
        }}
        title={symbol}
        subtitle={symbolData?.name || 'Unknown Asset'}
        icon={getAssetTypeIcon(symbolData?.asset_type || 'other')}
        badges={symbolData?.is_custom ? [{ text: 'Custom Asset' }] : []}
      />

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
                  {symbolData?.currency && (
                    <span> • Base Currency: {symbolData.currency}</span>
                  )}
                </p>
              </div>
              <TimeRangeSelector
                selectedRange={timeRange}
                onRangeChange={setTimeRange}
              />
            </div>
          </div>
        </div>

        {/* Currency Conversion Notice */}
        {symbolData?.currency && symbolData.currency !== selectedCurrency && (
          <div className="mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <div className="flex items-center">
                <span className="text-lg mr-2">💰</span>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Values converted from {symbolData.currency} to {selectedCurrency}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Current Position */}
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border dark:border-gray-700">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-2xl">💰</div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Current Position</dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-white">
                      {formatCurrency(currentValue)}
                    </dd>
                    <dd className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {quantity.toLocaleString()} × {formatCurrency(currentPrice)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Cost Basis */}
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
                      {formatCurrency(costBasis)}
                    </dd>
                    <dd className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {quantity > 0 ? `Avg: ${formatCurrency(costBasis / quantity)}` : 'Position closed'}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Performance */}
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border dark:border-gray-700">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-2xl">🎯</div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Performance</dt>
                    <dd className={`text-lg font-medium ${timeRangeMetrics.totalReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatCurrency(timeRangeMetrics.totalReturn)}
                    </dd>
                    {timeRange === 'all' && (costBasis > 0 || totalInvested > 0) && (
                      <dd className={`text-xs ${timeRangeMetrics.totalReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} mt-1`}>
                        {formatPercent((timeRangeMetrics.totalReturn / (costBasis > 0 ? costBasis : totalInvested)) * 100)}
                      </dd>
                    )}
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Annualized Returns */}
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border dark:border-gray-700">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-2xl">📈</div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Annualized Return</dt>
                    <dd className={`text-lg font-medium ${holdingData.annualizedReturns ? 
                      (holdingData.annualizedReturns.timeWeightedReturn >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') :
                      'text-gray-600 dark:text-gray-400'
                    }`}>
                      {holdingData.annualizedReturns ? 
                        formatPercent(holdingData.annualizedReturns.timeWeightedReturn) :
                        'Calculating...'
                      }
                    </dd>
                    {holdingData.annualizedReturns && holdingData.annualizedReturns.periodYears > 0 && (
                      <dd className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {holdingData.annualizedReturns.periodYears < 1 ? 
                          `${Math.round(holdingData.annualizedReturns.periodYears * 365)} days` :
                          `${holdingData.annualizedReturns.periodYears.toFixed(1)} years`
                        }
                      </dd>
                    )}
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Return Analysis */}
        <div className="mb-8">
          <DetailedHoldingReturns
            user={user}
            symbol={symbol}
            selectedCurrency={selectedCurrency}
            timeRange={timeRange}
          />
        </div>

        {/* Value Evolution Chart */}
        {holdingData.historicalData.length > 0 && (
          <div className="mb-8">
            <ValueEvolutionChart
              data={holdingData.historicalData}
              timeRange={timeRange}
              title={`${symbol} Value Evolution`}
              description={`Holding value vs. cost basis in ${selectedCurrency} (${timeRange.toUpperCase()})`}
              valueLabel={`${symbol} Value`}
              investedLabel="Cost Basis"
              currency={selectedCurrency}
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
            selectedCurrency={selectedCurrency}
            onTransactionUpdated={() => {
              // Reload the holding data when transactions are updated
              window.location.reload() // Temporary solution - in production this should be more elegant
            }}
          />
        </div>

        {/* Price Management (for custom assets only) */}
        {symbolData?.is_custom && (
          <div className="mb-8">
            <PriceManagement
              user={user}
              symbol={symbol}
              selectedCurrency={selectedCurrency}
              symbolCurrency={symbolData?.currency || 'USD'}
            />
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