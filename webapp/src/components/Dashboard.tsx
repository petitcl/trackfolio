'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { AssetType, Symbol } from '@/lib/supabase/types'
import { clientAuthService, type AuthUser } from '@/lib/auth/client.auth.service'
import { portfolioService, type PortfolioData, type EnhancedPortfolioData } from '@/lib/services/portfolio.service'
import type { HistoricalDataPoint } from '@/lib/mockData'
import TimeRangeSelector, { type TimeRange } from '@/components/TimeRangeSelector'
import PortfolioRepartitionChart from '@/components/charts/PortfolioRepartitionChart'
import PortfolioRepartitionHistoryChart from '@/components/charts/PortfolioRepartitionHistoryChart'
import PortfolioValueEvolutionChart from '@/components/charts/PortfolioValueEvolutionChart'
import QuickActions from '@/components/QuickActions'
import DemoModeBanner from '@/components/DemoModeBanner'
import CurrencySelector from '@/components/CurrencySelector'
import MultiBulkImportModal from '@/components/MultiBulkImportModal'
import { currencyService, type SupportedCurrency } from '@/lib/services/currency.service'
import EnhancedPortfolioOverview from '@/components/EnhancedPortfolioOverview'

interface DashboardProps {
  user: AuthUser
}

export default function Dashboard({ user }: DashboardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('all')
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null)
  const [enhancedPortfolioData, setEnhancedPortfolioData] = useState<EnhancedPortfolioData | null>(null)
  const [symbols, setSymbols] = useState<Symbol[]>([])
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([])
  const [repartitionData, setRepartitionData] = useState<Array<{ assetType: string; value: number; percentage: number }>>([])
  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>(
    currencyService.getPreferredCurrency()
  )
  const [showBulkImport, setShowBulkImport] = useState(false)
  const router = useRouter()

  // Unified loader for portfolio data
  const loadPortfolioData = useCallback(async (currency: SupportedCurrency) => {
    try {
      setDataLoading(true)
      console.log('📊 Loading portfolio data for user:', user.email, 'currency:', currency)

      const [portfolio, enhancedPortfolio, symbolsData, historical, repartition] = await Promise.all([
        portfolioService.getPortfolioData(user, currency),
        portfolioService.getEnhancedPortfolioData(user, currency),
        portfolioService.getSymbols(user),
        portfolioService.getPortfolioHistoricalData(user, currency),
        portfolioService.getPortfolioRepartitionData(user, currency)
      ])

      setPortfolioData(portfolio)
      setEnhancedPortfolioData(enhancedPortfolio)
      setSymbols(symbolsData)
      setHistoricalData(historical)
      setRepartitionData(repartition)

      console.log("portfolio", portfolio);
      console.log("enhancedPortfolio", enhancedPortfolio);
      console.log("historical last point", historical.at(-1));
      console.log("repartition", repartition);

      console.log('✅ Portfolio data loaded successfully')
    } catch (error) {
      console.error('❌ Error loading portfolio data:', error)
      setPortfolioData({
        totalValue: 0,
        totalCostBasis: 0,
        positions: [],
        totalPnL: { realized: 0, unrealized: 0, total: 0, totalPercentage: 0 }
      })
      setEnhancedPortfolioData({
        totalValue: 0,
        totalCostBasis: 0,
        positions: [],
        totalPnL: { realized: 0, unrealized: 0, total: 0, totalPercentage: 0 }
      })
      setSymbols([])
      setHistoricalData([])
      setRepartitionData([])
    } finally {
      setDataLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadPortfolioData(selectedCurrency)
  }, [loadPortfolioData, selectedCurrency])

  const handleCurrencyChange = (newCurrency: SupportedCurrency) => {
    setSelectedCurrency(newCurrency)
  }

  const handleSignOut = async () => {
    setIsLoading(true)
    await clientAuthService.signOut()
    router.push('/login')
  }

  const handleBulkImport = () => {
    setShowBulkImport(true)
  }

  const handleBulkImportComplete = () => {
    setShowBulkImport(false)
    // Refresh portfolio data after import
    window.location.reload()
  }

  const handleBulkImportCancel = () => {
    setShowBulkImport(false)
  }

  const formatCurrency = (amount: number) => {
    // Data is already pre-converted to the selected currency by the services
    return currencyService.formatCurrency(amount, selectedCurrency)
  }

  const formatPercent = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`
  }

  const calculatePnLPercentage = (unrealizedPnL: number, avgCost: number, quantity: number) => {
    const totalCost = avgCost * quantity
    if (totalCost === 0) return 0
    return (unrealizedPnL / totalCost) * 100
  }


  const getAssetTypeIcon = (assetType: string) => {
    const icons: Record<string, string> = {
      stock: '📈',
      crypto: '₿',
      cash: '💵',
      currency: '💱',
      real_estate: '🏠',
      other: '💎'
    }
    return icons[assetType] || '❓'
  }

  const getAssetTypeLabel = (assetType: string) => {
    const labels: Record<string, string> = {
      stock: 'Stocks',
      crypto: 'Crypto',
      cash: 'Cash',
      currency: 'Currency',
      real_estate: 'Real Estate',
      other: 'Other Assets'
    }
    return labels[assetType] || 'Unknown'
  }

  const getPnLColor = (pnl: number) => {
    if (pnl > 0) return 'text-green-600 dark:text-green-400'
    if (pnl < 0) return 'text-red-600 dark:text-red-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  // Show loading state
  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading portfolio data...</p>
        </div>
      </div>
    )
  }

  if (!portfolioData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Failed to load portfolio data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <img
                src="/icon-192x192.png"
                alt="Trackfolio Logo"
                className="w-10 h-10 mr-3 rounded-lg"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trackfolio</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Welcome back, {user.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <CurrencySelector
                selectedCurrency={selectedCurrency}
                onCurrencyChange={handleCurrencyChange}
                className="hidden sm:flex"
              />
              <button
                onClick={handleSignOut}
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 disabled:opacity-50"
              >
                {isLoading ? 'Signing out...' : 'Sign out'}
              </button>
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
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Portfolio Analytics</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Visualize your portfolio performance and allocation</p>
              </div>
              <TimeRangeSelector
                selectedRange={selectedTimeRange}
                onRangeChange={setSelectedTimeRange}
              />
            </div>
          </div>
        </div>
        {/* Portfolio Overview */}
        {(enhancedPortfolioData?.summaryV2 || enhancedPortfolioData?.annualizedReturns) ? (
          <div className="mb-8">
            <EnhancedPortfolioOverview
              summaryV2={enhancedPortfolioData.summaryV2}
              annualizedReturns={enhancedPortfolioData.annualizedReturns}
              totalValue={enhancedPortfolioData.totalValue}
              totalCostBasis={enhancedPortfolioData.totalCostBasis}
              selectedCurrency={selectedCurrency}
            />
          </div>
        ) : (
          /* Fallback to basic overview if detailed returns not available */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
                        {formatCurrency(portfolioData.totalValue)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Cost Basis */}
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
                        {formatCurrency(portfolioData.totalCostBasis)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Total P&L */}
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border dark:border-gray-700">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="text-2xl">🎯</div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total P&L</dt>
                      <dd className={`text-lg font-medium ${getPnLColor(portfolioData.totalPnL.total)}`}>
                        {formatCurrency(portfolioData.totalPnL.total)}
                      </dd>
                      <dd className={`text-xs ${getPnLColor(portfolioData.totalPnL.totalPercentage)} mt-1`}>
                        {formatPercent(portfolioData.totalPnL.totalPercentage)}
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
                    <div className="text-2xl">📈</div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Annualized Return</dt>
                      <dd className={`text-lg font-medium ${portfolioData.annualizedReturns ? getPnLColor(portfolioData.annualizedReturns.timeWeightedReturn) : 'text-gray-600 dark:text-gray-400'}`}>
                        {portfolioData.annualizedReturns ?
                          `${formatPercent(portfolioData.annualizedReturns.timeWeightedReturn)}` :
                          'Calculating...'
                        }
                      </dd>
                      {portfolioData.annualizedReturns && portfolioData.annualizedReturns.periodYears > 0 && (
                        <dd className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {portfolioData.annualizedReturns.periodYears < 1 ?
                            `${Math.round(portfolioData.annualizedReturns.periodYears * 365)} days` :
                            `${portfolioData.annualizedReturns.periodYears.toFixed(1)} years`
                          }
                        </dd>
                      )}
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Charts Section */}
        <div className="mb-8 space-y-8">
          {/* Top Row - Pie Chart and Portfolio History */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <PortfolioRepartitionChart
              data={repartitionData}
              timeRange={selectedTimeRange}
            />
            <PortfolioRepartitionHistoryChart
              user={user}
              timeRange={selectedTimeRange}
              selectedCurrency={selectedCurrency}
            />
          </div>

          {/* Bottom Row - Portfolio Value Evolution */}
          <div className="grid grid-cols-1">
            <PortfolioValueEvolutionChart
              data={historicalData}
              timeRange={selectedTimeRange}
              selectedCurrency={selectedCurrency}
            />
          </div>
        </div>

        {/* Holdings Table */}
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md border dark:border-gray-700">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Current Holdings</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              Your portfolio positions grouped by asset type
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Asset
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Avg Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Current Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Market Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    P&L (Amount/%%)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {(() => {
                  // Group positions by asset type
                  const positionsByType = portfolioData.positions.reduce((groups, position) => {
                    // Find the asset type from symbols
                    const symbol = symbols.find(s => s.symbol === position.symbol)
                    const assetType = symbol?.asset_type || 'other'
                    if (!groups[assetType]) {
                      groups[assetType] = []
                    }
                    groups[assetType].push(position)
                    return groups
                  }, {} as Record<string, typeof portfolioData.positions>)

                  const rows: React.ReactElement[] = []

                  // Define order for asset types
                  const typeOrder: AssetType[] = ['stock', 'crypto', 'real_estate', 'other']

                  typeOrder.forEach(assetType => {
                    const positions = positionsByType[assetType]
                    if (!positions || positions.length === 0) return

                    // Calculate totals for this asset type
                    const typeTotalValue = positions.reduce((sum, pos) => sum + pos.value, 0)
                    const typeTotalPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0)
                    const typeTotalCost = positions.reduce((sum, pos) => sum + (pos.avgCost * pos.quantity), 0)
                    const typePnLPercentage = typeTotalCost > 0 ? (typeTotalPnL / typeTotalCost) * 100 : 0

                    // Add individual positions
                    positions.forEach(position => {
                      const pnlPercentage = calculatePnLPercentage(position.unrealizedPnL, position.avgCost, position.quantity)
                      rows.push(
                        <tr key={position.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onClick={() => router.push(`/holdings/${encodeURIComponent(position.symbol)}`)}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 text-lg">
                                {getAssetTypeIcon(assetType)}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">{position.symbol}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {symbols.find(s => s.symbol === position.symbol)?.name || 'Unknown'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                            {position.quantity.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                            {formatCurrency(position.avgCost)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                            {formatCurrency(position.currentPrice)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency(position.value)}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${getPnLColor(position.unrealizedPnL)}`}>
                            <div>{formatCurrency(position.unrealizedPnL)}</div>
                            <div className="text-xs">{formatPercent(pnlPercentage)}</div>
                          </td>
                        </tr>
                      )
                    })

                    // Add category total row
                    rows.push(
                      <tr key={`${assetType}-total`} className="bg-gray-100 dark:bg-gray-700 font-semibold">
                        <td className="px-6 py-2 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 text-sm">
                              {getAssetTypeIcon(assetType)}
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-bold text-gray-900 dark:text-white">{getAssetTypeLabel(assetType)} Total</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">-</td>
                        <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">-</td>
                        <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">-</td>
                        <td className="px-6 py-2 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                          {formatCurrency(typeTotalValue)}
                        </td>
                        <td className={`px-6 py-2 whitespace-nowrap text-sm font-bold ${getPnLColor(typeTotalPnL)}`}>
                          <div>{formatCurrency(typeTotalPnL)}</div>
                          <div className="text-xs">{formatPercent(typePnLPercentage)}</div>
                        </td>
                      </tr>
                    )
                  })

                  return rows
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <QuickActions
          title="Quick Actions"
          actions={[
            {
              id: 'add-holding',
              icon: '📈',
              label: 'Add Holding',
              onClick: () => router.push('/add-holding')
            },
            {
              id: 'bulk-import',
              icon: '📊',
              label: 'Bulk Import',
              onClick: handleBulkImport
            }
          ]}
          columns={3}
          className="mt-8"
        />

        {/* Bulk Import Modal */}
        {showBulkImport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={handleBulkImportCancel}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <MultiBulkImportModal
                user={user}
                onImportComplete={handleBulkImportComplete}
                onCancel={handleBulkImportCancel}
              />
            </div>
          </div>
        )}

      </main>
    </div>
  )
}