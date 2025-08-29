'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { AssetType, Symbol } from '@/lib/supabase/database.types'
import { clientAuthService, type AuthUser } from '@/lib/auth/auth.service'
import { portfolioService, type PortfolioData } from '@/lib/services/portfolio.service'
import type { HistoricalDataPoint } from '@/lib/mockData'
import TimeRangeSelector, { type TimeRange } from '@/components/TimeRangeSelector'
import PortfolioRepartitionChart from '@/components/charts/PortfolioRepartitionChart'
import PortfolioHistoryChart from '@/components/charts/PortfolioHistoryChart'
import PortfolioValueEvolutionChart from '@/components/charts/PortfolioValueEvolutionChart'
import QuickActions from '@/components/QuickActions'

interface DashboardProps {
  user: AuthUser
}

export default function Dashboard({ user }: DashboardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('all')
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null)
  const [symbols, setSymbols] = useState<Symbol[]>([])
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([])
  const router = useRouter()

  // Load portfolio data on mount and when user changes
  useEffect(() => {
    const loadPortfolioData = async () => {
      try {
        setDataLoading(true)
        console.log('📊 Loading portfolio data for user:', user.email)
        
        const [portfolio, symbolsData, historical] = await Promise.all([
          portfolioService.getPortfolioData(user),
          portfolioService.getSymbols(user),
          portfolioService.getHistoricalData(user)
        ])
        
        setPortfolioData(portfolio)
        setSymbols(symbolsData)
        setHistoricalData(historical)
        
        console.log('✅ Portfolio data loaded successfully')
      } catch (error) {
        console.error('❌ Error loading portfolio data:', error)
        // Fallback to empty data
        setPortfolioData({
          totalValue: 0,
          cashBalance: 0,
          positions: [],
          dailyChange: { value: 0, percentage: 0 },
          totalPnL: { realized: 0, unrealized: 0, total: 0 }
        })
        setSymbols([])
        setHistoricalData([])
      } finally {
        setDataLoading(false)
      }
    }

    loadPortfolioData()
  }, [user])

  const handleSignOut = async () => {
    setIsLoading(true)
    await clientAuthService.signOut()
    router.push('/login')
  }

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

  const calculatePnLPercentage = (unrealizedPnL: number, avgCost: number, quantity: number) => {
    const totalCost = avgCost * quantity
    if (totalCost === 0) return 0
    return (unrealizedPnL / totalCost) * 100
  }

  // Prepare chart data
  const getPortfolioRepartitionData = () => {
    if (!portfolioData) return []
    
    const positionsByType = portfolioData.positions.reduce((groups, position) => {
      const symbol = symbols.find(s => s.symbol === position.symbol)
      const assetType = symbol?.asset_type || 'other'
      if (!groups[assetType]) {
        groups[assetType] = { value: 0, percentage: 0 }
      }
      groups[assetType].value += position.value
      return groups
    }, {} as Record<string, { value: number; percentage: number }>)

    // Add cash
    if (portfolioData.cashBalance > 0) {
      positionsByType['cash'] = { value: portfolioData.cashBalance, percentage: 0 }
    }

    // Calculate percentages
    const totalValue = Object.values(positionsByType).reduce((sum, group) => sum + group.value, 0)
    if (totalValue > 0) {
      Object.keys(positionsByType).forEach(assetType => {
        positionsByType[assetType].percentage = (positionsByType[assetType].value / totalValue) * 100
      })
    }

    return Object.entries(positionsByType).map(([assetType, data]) => ({
      assetType,
      value: data.value,
      percentage: data.percentage
    }))
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

  const getAssetTypeLabel = (assetType: string) => {
    const labels: Record<string, string> = {
      stock: 'Stocks',
      etf: 'ETFs',
      crypto: 'Crypto',
      cash: 'Cash',
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trackfolio</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Welcome back, {user.email}</p>
            </div>
            <div className="flex items-center space-x-3">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

          {/* Daily Change */}
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border dark:border-gray-700">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-2xl">📊</div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Daily Change</dt>
                    <dd className={`text-lg font-medium ${getPnLColor(portfolioData.dailyChange.value)}`}>
                      {formatCurrency(portfolioData.dailyChange.value)} ({formatPercent(portfolioData.dailyChange.percentage)})
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
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="mb-8 space-y-8">
          {/* Top Row - Pie Chart and Portfolio History */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <PortfolioRepartitionChart
              data={getPortfolioRepartitionData()}
              timeRange={selectedTimeRange}
            />
            <PortfolioHistoryChart
              data={historicalData}
              timeRange={selectedTimeRange}
            />
          </div>
          
          {/* Bottom Row - Portfolio Value Evolution */}
          <div className="grid grid-cols-1">
            <PortfolioValueEvolutionChart
              data={historicalData}
              timeRange={selectedTimeRange}
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
                  const typeOrder: AssetType[] = ['stock', 'etf', 'crypto', 'real_estate', 'other']
                  
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
                {/* Cash row - not clickable */}
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 bg-gray-25 dark:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 text-lg">{getAssetTypeIcon('cash')}</div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">CASH</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Available Cash</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">-</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">$1.00</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">$1.00</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {formatCurrency(portfolioData.cashBalance)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-300">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <QuickActions
          title="Quick Actions"
          actions={[
            {
              id: 'add-transaction',
              icon: '📈',
              label: 'Add Transaction',
              onClick: () => console.log('Add transaction')
            },
            {
              id: 'add-custom-asset',
              icon: '🏠',
              label: 'Add Custom Asset',
              onClick: () => console.log('Add custom asset')
            },
            {
              id: 'update-prices',
              icon: '💰',
              label: 'Update Prices',
              onClick: () => console.log('Update prices')
            }
          ]}
          columns={3}
          className="mt-8"
        />

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Demo Mode:</strong> This app is running with mock data for testing. 
              Connect your Supabase database to see real portfolio data.
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              Portfolio includes: Stocks, Crypto, Real Estate, Collectibles • Total: {formatCurrency(portfolioData.totalValue)}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}