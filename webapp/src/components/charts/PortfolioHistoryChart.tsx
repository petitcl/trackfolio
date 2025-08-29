'use client'

import React from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { TimeRange } from '../TimeRangeSelector'
import type { HistoricalDataPoint } from '../../lib/mockData'
import { CHART_COLORS, CHART_CONFIGS } from '../../lib/constants/chartColors'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface PortfolioHistoryChartProps {
  data: HistoricalDataPoint[]
  timeRange: TimeRange
  className?: string
}

const getAssetTypeColor = (assetType: string): string => {
  return CHART_COLORS[assetType as keyof typeof CHART_COLORS] || CHART_COLORS.other
}

const assetTypeLabels: Record<string, string> = {
  stock: 'Stocks',
  etf: 'ETFs', 
  crypto: 'Crypto',
  real_estate: 'Real Estate',
  other: 'Other Assets',
}

export default function PortfolioHistoryChart({ 
  data, 
  timeRange, 
  className = '' 
}: PortfolioHistoryChartProps) {
  // Filter data based on time range
  const filterDataByTimeRange = (data: HistoricalDataPoint[], range: TimeRange) => {
    const now = new Date()
    let startDate: Date
    
    switch (range) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
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
      case 'all':
      default:
        return data
    }
    
    return data.filter(point => new Date(point.date) >= startDate)
  }

  const filteredData = filterDataByTimeRange(data, timeRange)
  const assetTypes = ['stock', 'etf', 'crypto', 'real_estate', 'other']

  const datasets = assetTypes.map(assetType => ({
    label: assetTypeLabels[assetType],
    data: filteredData.map(point => point.assetTypeAllocations[assetType] || 0),
    borderColor: getAssetTypeColor(assetType),
    backgroundColor: `${getAssetTypeColor(assetType)}20`, // 20% opacity
    fill: false,
    tension: 0.1,
  }))

  const chartData = {
    labels: filteredData.map(point => {
      const date = new Date(point.date)
      // Format based on time range
      if (timeRange === '1d' || timeRange === '5d') {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      } else if (timeRange === '1m' || timeRange === '6m') {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      }
    }),
    datasets,
  }

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    scales: {
      x: {
        display: true,
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
        title: {
          display: true,
          text: 'Allocation (%)',
          ...CHART_CONFIGS.scales.y.title,
        },
        min: 0,
        max: 100,
        ticks: {
          ...CHART_CONFIGS.scales.y.ticks,
        },
        grid: {
          ...CHART_CONFIGS.scales.y.grid,
        },
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
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
            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`
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
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}