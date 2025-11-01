'use client'

import PortfolioRepartitionChart from '@/components/charts/PortfolioRepartitionChart'
import PortfolioRepartitionHistoryChart from '@/components/charts/PortfolioRepartitionHistoryChart'
import PortfolioValueEvolutionChart from '@/components/charts/PortfolioValueEvolutionChart'
import BucketedReturnsChart from '@/components/BucketedReturnsChart'
import DemoModeBanner from '@/components/DemoModeBanner'
import EnhancedPortfolioOverview from '@/components/EnhancedPortfolioOverview'
import Header from '@/components/Header'
import MultiBulkImportModal from '@/components/MultiBulkImportModal'
import AddHoldingModal from '@/components/AddHoldingModal'
import Modal from '@/components/Modal'
import QuickActions from '@/components/QuickActions'
import TimeRangeSelector from '@/components/TimeRangeSelector'
import { type AuthUser } from '@/lib/auth/client.auth.service'
import type { HistoricalDataPoint } from '@/lib/mockData'
import { currencyService, type SupportedCurrency } from '@/lib/services/currency.service'
import { portfolioService, type PortfolioData, type ReturnMetrics, type BucketedReturnMetrics } from '@/lib/services/portfolio.service'
import type { AssetType, Symbol } from '@/lib/supabase/types'
import { formatPercent, getAssetTypeIcon, getAssetTypeLabel, getPnLColor, makeFormatCurrency } from '@/lib/utils/formatting'
import { type TimeRange } from '@/lib/utils/timeranges'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'
import ProfitDisplay from './ProfitDisplay'
import { portfolioCalculationService } from '@/lib/services/portfolio-calculation.service'

interface DashboardProps {
  user: AuthUser
}

const defaultPortfolioData = (): PortfolioData => ({
  positions: [],
  returns: {
    totalValue: 0,
    totalPnL: 0,
    realizedPnL: 0,
    unrealizedPnL: 0,
    unrealizedPnlPercentage: 0,
    capitalGains: 0,
    dividends: 0,
    costBasis: 0,
    totalInvested: 0,
    timeWeightedReturn: 0,
    moneyWeightedReturn: 0,
    totalReturnPercentage: 0,
    startDate: '',
    endDate: '',
    periodYears: 0
  }
})

const defaultSymbolData: Symbol = {
  asset_type: "other",
  created_at: "",
  created_by_user_id: "",
  currency: "",
  holding_type: "",
  is_custom: false,
  last_price: 0,
  last_updated: "",
  metadata: {},
  name: "",
  symbol: ""
};

export default function Dashboard({ user }: DashboardProps) {
  const [dataLoading, setDataLoading] = useState(true)
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('all')
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null)
  const [symbols, setSymbols] = useState<Symbol[]>([])
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([])
  const [repartitionData, setRepartitionData] = useState<Array<{ assetType: string; value: number; percentage: number }>>([])
  const [bucketedReturnMetrics, setBucketedReturnMetrics] = useState<BucketedReturnMetrics | null>(null)
  const [returnMetricsByHolding, setReturnsMetricsByHolding] = useState<Map<string, ReturnMetrics>>(new Map())
  const [returnMetricsByAssetType, setReturnMetricsByAssetType] = useState<Map<string, ReturnMetrics>>(new Map())
  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>(
    currencyService.getPreferredCurrency()
  )
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [showAddHolding, setShowAddHolding] = useState(false)
  const [showClosedPositions, setShowClosedPositions] = useState(false)
  const router = useRouter()

  // Unified loader for portfolio data
  const loadPortfolioData = useCallback(async (selectedCurrency: SupportedCurrency, includeClosedPositions: boolean) => {
    try {
      setDataLoading(true)
      const startTime = performance.now()
      console.log('📊 Loading portfolio data for user:', user.email, 'currency:', selectedCurrency, 'includeClosedPositions:', includeClosedPositions)

      const apiStartTime = performance.now()
      const [
        portfolio,
        symbolsData,
        historical,
        returnMetricsByHolding,
        portfolioBucketedReturnMetrics,
        returnsMetricsByAssetType,
      ] = await Promise.all([
        portfolioService.getPortfolioData(user, selectedCurrency, selectedTimeRange, includeClosedPositions),
        portfolioService.getSymbols(user),
        portfolioService.getPortfolioHistoricalData(user, selectedCurrency),
        portfolioService.getReturnsMetricsByHolding(user, selectedCurrency, selectedTimeRange),
        portfolioService.getPortfolioBucketedReturnMetrics(user, selectedTimeRange, selectedCurrency),
        portfolioService.getReturnMetricsByAssetType(user, selectedCurrency, selectedTimeRange),
      ])
      const apiEndTime = performance.now()

      const calculationStartTime = performance.now()

      // Calculate current repartition from positions (real-time data)
      const repartition = portfolioService.getCurrentPortfolioRepartition(portfolio.positions, symbolsData)

      setPortfolioData(portfolio)
      setSymbols(symbolsData)
      setHistoricalData(historical)
      setRepartitionData(repartition)
      setReturnsMetricsByHolding(returnMetricsByHolding)
      setBucketedReturnMetrics(portfolioBucketedReturnMetrics)
      setReturnMetricsByAssetType(returnsMetricsByAssetType)
      const calculationEndTime = performance.now()

      console.log("portfolio", portfolio);
      console.log("symbols", symbolsData);
      console.log("historical last point", historical.at(-1));
      console.log("repartition", repartition);
      console.log("portfolio bucketed return metrics", portfolioBucketedReturnMetrics);

      console.log("return metrics by holding", returnMetricsByHolding);
      console.log("return metrics by asset type", returnsMetricsByAssetType);

      const totalTime = performance.now() - startTime
      const apiTime = apiEndTime - apiStartTime
      const calculationTime = calculationEndTime - calculationStartTime

      console.log('⏱️ Performance metrics:')
      console.log(`  - API fetch time: ${apiTime.toFixed(2)}ms`)
      console.log(`  - Calculation/setState time: ${calculationTime.toFixed(2)}ms`)
      console.log(`  - Total loading time: ${totalTime.toFixed(2)}ms`)
      console.log('✅ Portfolio data loaded successfully')
    } catch (error) {
      console.error('❌ Error loading portfolio data:', error)
      setPortfolioData(defaultPortfolioData())
      setSymbols([])
      setHistoricalData([])
      setRepartitionData([])
      setReturnsMetricsByHolding(new Map())
      setBucketedReturnMetrics(null)
      setReturnMetricsByAssetType(new Map())
    } finally {
      setDataLoading(false)
    }
  }, [user, selectedTimeRange])

  useEffect(() => {
    loadPortfolioData(selectedCurrency, showClosedPositions)
  }, [loadPortfolioData, selectedCurrency, showClosedPositions])

  const handleCurrencyChange = (newCurrency: SupportedCurrency) => {
    setSelectedCurrency(newCurrency)
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

  const handleAddHolding = () => {
    setShowAddHolding(true)
  }

  const handleAddHoldingComplete = (symbol: string) => {
    setShowAddHolding(false)
    // Navigate to the newly created holding
    router.push(`/holdings/${symbol}`)
  }

  const handleAddHoldingCancel = () => {
    setShowAddHolding(false)
  }

  const formatCurrency = makeFormatCurrency(selectedCurrency)

  // Helper to get symbol metrics with fallback
  const getHoldingMetrics = (symbol: string): ReturnMetrics => {
    const metrics = returnMetricsByHolding.get(symbol)
    if (!metrics) {
      console.warn("Holding metrics now found for symbol", symbol)
      return portfolioCalculationService.getEmptyReturnMetrics()
    }

    return metrics
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
      <Header
        user={user}
        showCurrencySelector={true}
        selectedCurrency={selectedCurrency}
        onCurrencyChange={handleCurrencyChange}
      />

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
        {/* Enhanced Portfolio Overview */}
        <div className="mb-8">
          <EnhancedPortfolioOverview
            returns={portfolioData.returns}
            selectedCurrency={selectedCurrency}
          />
        </div>

        {/* Charts Section */}
        <div className="mb-8 space-y-8">
          {/* Top Row - Pie Chart and Portfolio History */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <PortfolioRepartitionChart
              data={repartitionData}
              timeRange={selectedTimeRange}
              selectedCurrency={selectedCurrency}
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

          {/* Returns Performance by Period */}
          {bucketedReturnMetrics && bucketedReturnMetrics.buckets.length > 0 && (
            <div className="grid grid-cols-1">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Returns by Period
                </h3>
                <BucketedReturnsChart data={bucketedReturnMetrics} currency={selectedCurrency} />
              </div>
            </div>
          )}
        </div>

        {/* Holdings Table */}
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md border dark:border-gray-700">
          <div className="px-4 py-5 sm:px-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                  {showClosedPositions ? 'All Holdings' : 'Current Holdings'}
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                  {showClosedPositions
                    ? 'Your portfolio positions including closed positions grouped by asset type'
                    : 'Your portfolio positions grouped by asset type'
                  }
                </p>
              </div>
              <div className="flex items-center">
                <label className="flex items-center cursor-pointer">
                  <span className="text-sm text-gray-700 dark:text-gray-300 mr-3">Show closed positions</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={showClosedPositions}
                      onChange={(e) => setShowClosedPositions(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`block bg-gray-300 dark:bg-gray-600 w-12 h-6 rounded-full transition-colors duration-200 ${showClosedPositions ? 'bg-blue-600 dark:bg-blue-500' : ''
                      }`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ${showClosedPositions ? 'transform translate-x-6' : ''
                      }`}></div>
                  </div>
                </label>
              </div>
            </div>
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
                    Unrealized P&L
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total Return
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {(() => {
                  // Group positions by asset type
                  const positionsByType = portfolioData.positions
                    .reduce((groups, position) => {
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

                    const assetTypeReturnMetrics = returnMetricsByAssetType.get(assetType)
                    if (!assetTypeReturnMetrics) {
                      return
                    }

                    // Calculate totals for this asset type (only include active positions in totals)
                    const activePositions = positions.filter(pos => !pos.isClosed)

                    const typeTotalValue = assetTypeReturnMetrics.totalValue
                    const typeTotalUnrealizedPnL = assetTypeReturnMetrics.unrealizedPnL
                    const typeTotalDividends = assetTypeReturnMetrics.dividends
                    const typeTotalReturn = typeTotalUnrealizedPnL + typeTotalDividends
                    const typeTotalRealizedPnL = assetTypeReturnMetrics.realizedPnL
                    const typeTotalCost = assetTypeReturnMetrics.costBasis
                    const typePnLPercentage = assetTypeReturnMetrics.unrealizedPnlPercentage
                    const typeTotalReturnPercentage = assetTypeReturnMetrics.totalReturnPercentage

                    // console.log({
                    //   assetType,
                    //   typeTotalValue,
                    //   typeTotalCost,
                    //   typeTotalUnrealizedPnL,
                    //   typeTotalReturn,
                    //   typeTotalDividends,
                    // });

                    // Add individual positions
                    positions.forEach(position => {
                      const symbol = symbols.find(s => s.symbol === position.symbol) || defaultSymbolData
                      const metrics = getHoldingMetrics(position.symbol)
                      const isAccountHolding = position.isAccount
                      const isClosed = position.isClosed
                      const unrealizedPnlPercentage = metrics.unrealizedPnlPercentage
                      const totalReturn = metrics.totalPnL
                      const totalReturnPercentage = metrics.totalReturnPercentage

                      // console.log("isAccountHolding", isAccountHolding, position.symbol);

                      if (!showClosedPositions && isClosed) {
                        return
                      }

                      rows.push(
                        <tr key={position.symbol} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${isClosed ? 'opacity-60' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <a href={`/holdings/${encodeURIComponent(position.symbol)}`} className="flex items-center w-full">
                              <div className="flex-shrink-0 text-lg">
                                {getAssetTypeIcon(assetType)}
                              </div>
                              <div className="ml-4">
                                <div className={`text-sm font-medium hover:text-blue-600 dark:hover:text-blue-400 flex items-center ${isClosed ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                  {position.symbol}
                                  {isClosed && <span className="ml-2 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">CLOSED</span>}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {symbol.name || 'Unknown'}
                                </div>
                              </div>
                            </a>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${isClosed ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-300'}`}>
                            <a href={`/holdings/${encodeURIComponent(position.symbol)}`} className="block w-full">
                              {isClosed || isAccountHolding ? '-' : position.quantity.toLocaleString()}
                            </a>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${isClosed ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-300'}`}>
                            <a href={`/holdings/${encodeURIComponent(position.symbol)}`} className="block w-full">
                              {isClosed || isAccountHolding ? '-' : formatCurrency(position.avgCost)}
                            </a>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${isClosed ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-300'}`}>
                            <a href={`/holdings/${encodeURIComponent(position.symbol)}`} className="block w-full">
                              {isClosed || isAccountHolding ? '-' : formatCurrency(position.currentPrice)}
                            </a>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isClosed ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                            <a href={`/holdings/${encodeURIComponent(position.symbol)}`} className="block w-full">
                              {isClosed ? '-' : formatCurrency(position.value)}
                            </a>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isClosed ? 'text-gray-500 dark:text-gray-400' : ''}`}>
                            <a href={`/holdings/${encodeURIComponent(position.symbol)}`} className="block w-full">
                              <div>{isClosed ? '-' : <ProfitDisplay value={metrics.unrealizedPnL} format="currency" currency={selectedCurrency} />}</div>
                              <div className="text-xs">{isClosed ? '-' : <ProfitDisplay value={unrealizedPnlPercentage} format="percentage" />}</div>
                            </a>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isClosed ? '' : ''}`}>
                            <a href={`/holdings/${encodeURIComponent(position.symbol)}`} className="block w-full">
                              <div>{isClosed ? <ProfitDisplay value={metrics.realizedPnL} format="currency" currency={selectedCurrency} /> : <ProfitDisplay value={totalReturn} format="currency" currency={selectedCurrency} />}</div>
                              <div className="text-xs">{isClosed ? <ProfitDisplay value={metrics.totalReturnPercentage} format="percentage" /> : <ProfitDisplay value={totalReturnPercentage} format="percentage" />}</div>
                            </a>
                          </td>
                        </tr>
                      )
                    })

                    // Add category total row (only if there are active positions or if showing all positions)
                    if (activePositions.length > 0 || showClosedPositions) {
                      rows.push(
                        <tr key={`${assetType}-total`} className="bg-gray-100 dark:bg-gray-700 font-semibold">
                          <td className="px-6 py-2 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 text-sm">
                                {getAssetTypeIcon(assetType)}
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-bold text-gray-900 dark:text-white">
                                  {getAssetTypeLabel(assetType)} Total
                                  {showClosedPositions && activePositions.length === 0 && (
                                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(All Closed)</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">-</td>
                          <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">-</td>
                          <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">-</td>
                          <td className="px-6 py-2 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                            {activePositions.length > 0 ? formatCurrency(typeTotalValue) : '-'}
                          </td>
                          <td className={`px-6 py-2 whitespace-nowrap text-sm font-bold ${activePositions.length === 0 ? 'text-gray-500 dark:text-gray-400' : ''}`}>
                            <div>
                              {activePositions.length > 0 ? <ProfitDisplay value={typeTotalUnrealizedPnL} format="currency" currency={selectedCurrency} className="font-bold" /> : '-'}
                            </div>
                            <div className="text-xs">
                              {activePositions.length > 0 ? <ProfitDisplay value={typePnLPercentage} format="percentage" className="font-bold" /> : '-'}
                            </div>
                          </td>
                          <td className={`px-6 py-2 whitespace-nowrap text-sm font-bold ${activePositions.length === 0 && typeTotalRealizedPnL === 0 ? 'text-gray-500 dark:text-gray-400' : ''}`}>
                            <div>
                              {activePositions.length > 0 ? <ProfitDisplay value={typeTotalReturn} format="currency" currency={selectedCurrency} className="font-bold" /> :
                                (typeTotalRealizedPnL !== 0 ? <ProfitDisplay value={typeTotalRealizedPnL} format="currency" currency={selectedCurrency} className="font-bold" /> : '-')}
                            </div>
                            <div className="text-xs">
                              {activePositions.length > 0 ? <ProfitDisplay value={typeTotalReturnPercentage} format="percentage" className="font-bold" /> :
                                (typeTotalRealizedPnL !== 0 ? `${formatPercent(typeTotalRealizedPnL > 0 ? 100 : -100)} (closed)` : 'No Activity')}
                            </div>
                          </td>
                        </tr>
                      )
                    }
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
              onClick: handleAddHolding
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
        <Modal
          isOpen={showBulkImport}
          onClose={handleBulkImportCancel}
          maxWidth="max-w-4xl"
        >
          <MultiBulkImportModal
            user={user}
            onImportComplete={handleBulkImportComplete}
            onCancel={handleBulkImportCancel}
          />
        </Modal>

        {/* Add Holding Modal */}
        <Modal
          isOpen={showAddHolding}
          onClose={handleAddHoldingCancel}
          maxWidth="max-w-2xl"
        >
          <AddHoldingModal
            user={user}
            onHoldingAdded={handleAddHoldingComplete}
            onCancel={handleAddHoldingCancel}
          />
        </Modal>

      </main>
    </div>
  )
}