'use client'

import React, { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import type { TimeRange } from '../TimeRangeSelector'
import type { HistoricalDataPoint } from '../../lib/mockData'
import { CHART_COLORS, CHART_CONFIGS } from '../../lib/constants/chartColors'
import { portfolioService } from '../../lib/services/portfolio.service'
import type { AuthUser } from '../../lib/auth/client.auth.service'
import { currencyService, type SupportedCurrency, CURRENCY_SYMBOLS } from '../../lib/services/currency.service'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

interface PortfolioRepartitionHistoryChartProps {
  user: AuthUser
  timeRange: TimeRange
  selectedCurrency: SupportedCurrency
  className?: string
}

const getAssetTypeColor = (assetType: string): string => {
  const color = CHART_COLORS[assetType as keyof typeof CHART_COLORS]
  return (typeof color === 'string' ? color : CHART_COLORS.other) as string
}

const assetTypeLabels: Record<string, string> = {
  stock: 'Stocks',
  etf: 'ETFs', 
  crypto: 'Crypto',
  real_estate: 'Real Estate',
  other: 'Other Assets',
  cash: 'Cash',
  currency: 'Currency',
}

export default function PortfolioRepartitionHistoryChart({ 
  user, 
  timeRange,
  selectedCurrency,
  className = '' 
}: PortfolioRepartitionHistoryChartProps) {
  const [data, setData] = useState<HistoricalDataPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch data when timeRange changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        console.log('📊 Fetching historical data for timeRange:', timeRange)
        const historicalData = await portfolioService.getPortfolioHistoricalDataByTimeRange(user, timeRange, selectedCurrency)
        setData(historicalData)
      } catch (error) {
        console.error('❌ Error fetching historical data:', error)
        setData([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [user, timeRange, selectedCurrency])

  // Loading state
  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700 ${className}`}>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Portfolio Repartition History
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Loading data...
          </p>
        </div>
      </div>
    )
  }

  // Early return if no data
  if (!data || data.length === 0) {
    console.log('⚠️ PortfolioRepartitionHistoryChart - No data available')
    return (
      <div className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700 ${className}`}>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Portfolio Repartition History
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No historical data available for the selected time range
          </p>
        </div>
      </div>
    )
  }

  // Data is already processed by the service - create chart data directly using assetTypeValues
  const assetTypes = ['stock', 'etf', 'crypto', 'real_estate', 'cash', 'currency', 'other']

  // Create datasets for stacked bar chart using absolute values directly
  const datasets = assetTypes.map(assetType => {
    const dataPoints = data.map(point => {
      // Use absolute values directly from service calculation
      return point.assetTypeValues?.[assetType] || 0
    })
    
    return {
      label: assetTypeLabels[assetType],
      data: dataPoints,
      backgroundColor: getAssetTypeColor(assetType),
      borderColor: getAssetTypeColor(assetType),
      borderWidth: 1,
    }
  })

  const chartData = {
    labels: data.map(point => {
      const date = new Date(point.date)
      // Format based on time range and aggregation level
      if (timeRange === '5d') {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      } else if (timeRange === '1m') {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      } else if (timeRange === '6m' || timeRange === 'ytd' || timeRange === '1y') {
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      } else if (timeRange === '5y') {
        const quarter = Math.floor(date.getMonth() / 3) + 1
        return `Q${quarter} ${date.getFullYear().toString().slice(-2)}`
      } else {
        return date.getFullYear().toString()
      }
    }),
    datasets,
  }

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    scales: {
      x: {
        display: true,
        stacked: true,
        title: {
          display: true,
          text: 'Date',
          ...CHART_CONFIGS.scales.x.title,
        },
        ticks: {
          maxTicksLimit: 10,
          ...CHART_CONFIGS.scales.x.ticks,
        },
        grid: {
          ...CHART_CONFIGS.scales.x.grid,
        },
      },
      y: {
        display: true,
        stacked: true,
        title: {
          display: true,
          text: `Portfolio Value (${CURRENCY_SYMBOLS[selectedCurrency]})`,
          ...CHART_CONFIGS.scales.y.title,
        },
        min: 0,
        ticks: {
          ...CHART_CONFIGS.scales.y.ticks,
          callback: function(value) {
            return currencyService.formatCurrency(Number(value), selectedCurrency)
          }
        },
        grid: {
          ...CHART_CONFIGS.scales.y.grid,
        },
      },
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          ...CHART_CONFIGS.legend,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        ...CHART_CONFIGS.tooltip,
        borderWidth: 1,
        callbacks: {
          label: function(context) {
            const value = currencyService.formatCurrency(Number(context.parsed.y), selectedCurrency)
            return `${context.dataset.label}: ${value}`
          },
          footer: function(tooltipItems) {
            const total = tooltipItems.reduce((sum, item) => sum + Number(item.parsed.y), 0)
            return `Total: ${currencyService.formatCurrency(total, selectedCurrency)}`
          }
        }
      }
    },
  }

  return (
    <div className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Portfolio Repartition History
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Asset allocation over time ({timeRange.toUpperCase()})
        </p>
      </div>
      <div className="h-80">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  )
}