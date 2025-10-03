'use client'

import PortfolioRepartitionChart from '@/components/charts/PortfolioRepartitionChart'
import PortfolioRepartitionHistoryChart from '@/components/charts/PortfolioRepartitionHistoryChart'
import PortfolioValueEvolutionChart from '@/components/charts/PortfolioValueEvolutionChart'
import DemoModeBanner from '@/components/DemoModeBanner'
import EnhancedPortfolioOverview from '@/components/EnhancedPortfolioOverview'
import Header from '@/components/Header'
import MultiBulkImportModal from '@/components/MultiBulkImportModal'
import QuickActions from '@/components/QuickActions'
import TimeRangeSelector, { type TimeRange } from '@/components/TimeRangeSelector'
import { type AuthUser } from '@/lib/auth/client.auth.service'
import type { HistoricalDataPoint } from '@/lib/mockData'
import { currencyService, type SupportedCurrency } from '@/lib/services/currency.service'
import { portfolioService, type EnhancedPortfolioData, type PortfolioData } from '@/lib/services/portfolio.service'
import type { AssetType, Symbol } from '@/lib/supabase/types'
import { formatPercent, getAssetTypeIcon, getAssetTypeLabel, getPnLColor, makeFormatCurrency } from '@/lib/utils/formatting'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'

interface DashboardProps {
  user: AuthUser
}

const defaultPortfolioData = ()=> ({
  totalValue: 0,
  totalCostBasis: 0,
  positions: [],
  totalPnL: { realized: 0, unrealized: 0, total: 0, totalPercentage: 0 }
})

export default function Dashboard({ user }: DashboardProps) {
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
  const [showClosedPositions, setShowClosedPositions] = useState(false)
  const router = useRouter()

  // Unified loader for portfolio data
  const loadPortfolioData = useCallback(async (currency: SupportedCurrency) => {
    try {
      setDataLoading(true)
      const startTime = performance.now()
      console.log('📊 Loading portfolio data for user:', user.email, 'currency:', currency)

      const apiStartTime = performance.now()
      const [portfolio, enhancedPortfolio, symbolsData, historical, repartition] = await Promise.all([
        portfolioService.getPortfolioData(user, currency, true),
        portfolioService.getEnhancedPortfolioData(user, currency, true),
        portfolioService.getSymbols(user),
        portfolioService.getPortfolioHistoricalData(user, currency),
        portfolioService.getPortfolioRepartitionData(user, currency, selectedTimeRange)
      ])
      const apiEndTime = performance.now()

      const calculationStartTime = performance.now()
      setPortfolioData(portfolio)
      setEnhancedPortfolioData(enhancedPortfolio)
      setSymbols(symbolsData)
      setHistoricalData(historical)
      setRepartitionData(repartition)
      const calculationEndTime = performance.now()

      console.log("portfolio", portfolio);
      console.log("enhancedPortfolio", enhancedPortfolio);
      console.log("historical last point", historical.at(-1));
      console.log("repartition", repartition);

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
  }, [user, selectedTimeRange])

  useEffect(() => {
    loadPortfolioData(selectedCurrency)
  }, [loadPortfolioData, selectedCurrency])

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

  const formatCurrency = makeFormatCurrency(selectedCurrency)

  const calculatePnLPercentage = (unrealizedPnL: number, avgCost: number, quantity: number) => {
    const totalCost = avgCost * quantity
    if (totalCost === 0) return 0
    return (unrealizedPnL / totalCost) * 100
  }

  const calculateRealizedPnLPercentage = (realizedPnL: number, realizedCostBasis: number) => {
    if (realizedCostBasis === 0) return 0
    return (realizedPnL / realizedCostBasis) * 100
  }

  const calculateTotalReturn = (unrealizedPnL: number, dividendIncome: number) => {
    return unrealizedPnL + dividendIncome
  }

  const calculateTotalReturnPercentage = (unrealizedPnL: number, dividendIncome: number, avgCost: number, quantity: number) => {
    const totalCost = avgCost * quantity
    if (totalCost === 0) return 0
    return ((unrealizedPnL + dividendIncome) / totalCost) * 100
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

  const holdingPeriod = portfolioData.annualizedReturns && portfolioData.annualizedReturns.periodYears > 0  ? (portfolioData.annualizedReturns.periodYears < 1 ?
    `${Math.round(portfolioData.annualizedReturns.periodYears * 365)} days` :
    `${portfolioData.annualizedReturns.periodYears.toFixed(1)} years`) : null
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
                        {formatCurrency(enhancedPortfolioData?.totalCostBasis ?? 0)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* P&L Breakdown */}
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border dark:border-gray-700">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="text-2xl">🎯</div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl className="space-y-2">
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Unrealized P&L</dt>
                        <dd className={`text-lg font-medium ${getPnLColor(portfolioData.totalPnL.unrealized)}`}>
                          {formatCurrency(portfolioData.totalPnL.unrealized)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Return</dt>
                        <dd className={`text-lg font-medium ${getPnLColor(portfolioData.totalPnL.total)}`}>
                          {formatCurrency(portfolioData.totalPnL.total)}
                        </dd>
                        <dd className={`text-xs ${getPnLColor(portfolioData.totalPnL.totalPercentage)} mt-1`}>
                          {formatPercent(portfolioData.totalPnL.totalPercentage)}
                        </dd>
                      </div>
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
                      {holdingPeriod && (
                        <dd className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {holdingPeriod}
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
                    <div className={`block bg-gray-300 dark:bg-gray-600 w-12 h-6 rounded-full transition-colors duration-200 ${
                      showClosedPositions ? 'bg-blue-600 dark:bg-blue-500' : ''
                    }`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ${
                      showClosedPositions ? 'transform translate-x-6' : ''
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
                      .filter(p => {
                          if (showClosedPositions) return true
                          return p.quantity > 0
                      })
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

                    // Calculate totals for this asset type (only include active positions in totals)
                    const activePositions = positions.filter(pos => pos.quantity > 0)
                    const typeTotalValue = activePositions.reduce((sum, pos) => sum + pos.value, 0)
                    const typeTotalPnL = activePositions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0)
                    const typeTotalDividends = activePositions.reduce((sum, pos) => sum + pos.dividendIncome, 0)
                    const typeTotalReturn = typeTotalPnL + typeTotalDividends
                    const typeTotalRealizedPnL = positions.reduce((sum, pos) => sum + (pos.realizedPnL || 0), 0)
                    const typeTotalRealizedCostBasis = positions.reduce((sum, pos) => sum + (pos.realizedCostBasis || 0), 0)
                    const typeTotalCost = activePositions.reduce((sum, pos) => sum + (pos.avgCost * pos.quantity), 0)
                    const typePnLPercentage = typeTotalCost > 0 ? (typeTotalPnL / typeTotalCost) * 100 : 0
                    const typeTotalReturnPercentage = typeTotalCost > 0 ? (typeTotalReturn / typeTotalCost) * 100 : 0
                    const typeRealizedPnLPercentage = typeTotalRealizedCostBasis > 0 ? (typeTotalRealizedPnL / typeTotalRealizedCostBasis) * 100 : 0

                    // Add individual positions
                    positions.forEach(position => {
                      const pnlPercentage = calculatePnLPercentage(position.unrealizedPnL, position.avgCost, position.quantity)
                      const realizedPnLPercentage = calculateRealizedPnLPercentage(position.realizedPnL, position.realizedCostBasis)
                      const isClosed = position.quantity === 0
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
                                  {symbols.find(s => s.symbol === position.symbol)?.name || 'Unknown'}
                                </div>
                              </div>
                            </a>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${isClosed ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-300'}`}>
                            <a href={`/holdings/${encodeURIComponent(position.symbol)}`} className="block w-full">
                              {isClosed ? '-' : position.quantity.toLocaleString()}
                            </a>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${isClosed ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-300'}`}>
                            <a href={`/holdings/${encodeURIComponent(position.symbol)}`} className="block w-full">
                              {isClosed ? '-' : formatCurrency(position.avgCost)}
                            </a>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${isClosed ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-300'}`}>
                            <a href={`/holdings/${encodeURIComponent(position.symbol)}`} className="block w-full">
                              {isClosed ? '-' : formatCurrency(position.currentPrice)}
                            </a>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isClosed ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                            <a href={`/holdings/${encodeURIComponent(position.symbol)}`} className="block w-full">
                              {isClosed ? '-' : formatCurrency(position.value)}
                            </a>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isClosed ? 'text-gray-500 dark:text-gray-400' : getPnLColor(position.unrealizedPnL)}`}>
                            <a href={`/holdings/${encodeURIComponent(position.symbol)}`} className="block w-full">
                              <div>{isClosed ? '-' : formatCurrency(position.unrealizedPnL)}</div>
                              <div className="text-xs">{isClosed ? '-' : formatPercent(pnlPercentage)}</div>
                            </a>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isClosed ? getPnLColor(position.realizedPnL) : getPnLColor(calculateTotalReturn(position.unrealizedPnL, position.dividendIncome))}`}>
                            <a href={`/holdings/${encodeURIComponent(position.symbol)}`} className="block w-full">
                              <div>{isClosed ? formatCurrency(position.realizedPnL) : formatCurrency(calculateTotalReturn(position.unrealizedPnL, position.dividendIncome))}</div>
                              <div className="text-xs">{isClosed ? formatPercent(realizedPnLPercentage) : formatPercent(calculateTotalReturnPercentage(position.unrealizedPnL, position.dividendIncome, position.avgCost, position.quantity))}</div>
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
                          <td className={`px-6 py-2 whitespace-nowrap text-sm font-bold ${activePositions.length > 0 ? getPnLColor(typeTotalPnL) : 'text-gray-500 dark:text-gray-400'}`}>
                            <div>
                              {activePositions.length > 0 ? formatCurrency(typeTotalPnL) : '-'}
                            </div>
                            <div className="text-xs">
                              {activePositions.length > 0 ? formatPercent(typePnLPercentage) : '-'}
                            </div>
                          </td>
                          <td className={`px-6 py-2 whitespace-nowrap text-sm font-bold ${activePositions.length > 0 ? getPnLColor(typeTotalReturn) : (typeTotalRealizedPnL !== 0 ? getPnLColor(typeTotalRealizedPnL) : 'text-gray-500 dark:text-gray-400')}`}>
                            <div>
                              {activePositions.length > 0 ? formatCurrency(typeTotalReturn) :
                               (typeTotalRealizedPnL !== 0 ? formatCurrency(typeTotalRealizedPnL) : '-')}
                            </div>
                            <div className="text-xs">
                              {activePositions.length > 0 ? formatPercent(typeTotalReturnPercentage) :
                               (typeTotalRealizedPnL !== 0 ? formatPercent(typeRealizedPnLPercentage) : 'No Activity')}
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