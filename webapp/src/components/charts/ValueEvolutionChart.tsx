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
  Legend
)

interface ValueEvolutionChartProps {
  data: HistoricalDataPoint[]
  timeRange: TimeRange
  title: string
  description?: string
  className?: string
  valueLabel?: string
  investedLabel?: string
  currency?: string
  showInvested?: boolean
}

// EUR/USD exchange rate - in production this would come from a currency API
const USD_TO_EUR_RATE = 0.85

export default function ValueEvolutionChart({ 
  data, 
  timeRange, 
  title,
  description,
  className = '',
  valueLabel = 'Value',
  investedLabel = 'Cumulative Invested',
  currency = 'EUR',
  showInvested = true
}: ValueEvolutionChartProps) {
  
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
  
  // Calculate cumulative invested amount from real cost basis data
  const calculateCumulativeInvested = (filteredData: HistoricalDataPoint[]) => {
    // Check if we have cost basis data in the historical data points
    const firstPoint = filteredData[0] as HistoricalDataPoint & { costBasis?: number }
    if (firstPoint && typeof firstPoint.costBasis === 'number') {
      // Use the cost basis data from the service (works for both portfolio and holdings)
      return filteredData.map(point => {
        const extendedPoint = point as HistoricalDataPoint & { costBasis?: number }
        return (extendedPoint.costBasis || 0) * USD_TO_EUR_RATE
      })
    }

    // Fallback for legacy data without cost basis
    console.warn('No cost basis data found in historical data, using fallback calculation')
    const initialInvested = filteredData[0]?.totalValue * USD_TO_EUR_RATE || 0
    return filteredData.map(() => initialInvested)
  }

  const values = filteredData.map(point => point.totalValue * USD_TO_EUR_RATE)
  const cumulativeInvested = showInvested ? calculateCumulativeInvested(filteredData) : []

  const datasets = [
    {
      label: `${valueLabel} (${currency})`,
      data: values,
      ...CHART_CONFIGS.lineChart.primaryLine,
      fill: false,
      tension: 0.1,
      pointRadius: 0,
      pointHoverRadius: 5,
    }
  ]

  if (showInvested) {
    datasets.push({
      label: `${investedLabel} (${currency})`,
      data: cumulativeInvested,
      ...CHART_CONFIGS.lineChart.secondaryLine,
      fill: false,
      tension: 0.1,
      pointRadius: 0,
      pointHoverRadius: 5,
    })
  }

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
    datasets
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
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
        grid: CHART_CONFIGS.scales.x.grid,
      },
      y: {
        display: true,
        title: {
          display: true,
          text: `Value (${currency})`,
          ...CHART_CONFIGS.scales.y.title,
        },
        ticks: {
          ...CHART_CONFIGS.scales.y.ticks,
          callback: function(value) {
            return formatCurrency(Number(value))
          }
        },
        grid: CHART_CONFIGS.scales.y.grid,
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
            const value = Number(context.parsed.y)
            return `${context.dataset.label}: ${formatCurrency(value)}`
          },
          afterBody: function(tooltipItems) {
            if (showInvested && tooltipItems.length >= 2) {
              const portfolioValue = Number(tooltipItems[0].parsed.y)
              const invested = Number(tooltipItems[1].parsed.y)
              const pnl = portfolioValue - invested
              const pnlPercentage = invested > 0 ? (pnl / invested) * 100 : 0
              return [
                `P&L: ${formatCurrency(pnl)}`,
                `Return: ${pnlPercentage >= 0 ? '+' : ''}${pnlPercentage.toFixed(2)}%`
              ]
            }
            return []
          }
        }
      }
    },
  }

  // Calculate current metrics
  const currentValue = values[values.length - 1] || 0
  const currentInvested = showInvested ? (cumulativeInvested[cumulativeInvested.length - 1] || 0) : 0
  const currentPnL = showInvested ? (currentValue - currentInvested) : 0
  const currentPnLPercentage = showInvested && currentInvested > 0 ? (currentPnL / currentInvested) * 100 : 0

  return (
    <div className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
        <div className="flex flex-wrap gap-4 mt-2 text-sm">
          <div className="flex items-center">
            <div className="w-3 h-0.5 mr-2" style={{backgroundColor: CHART_COLORS.primary}}></div>
            <span className="text-gray-300">Current {valueLabel}: {formatCurrency(currentValue)}</span>
          </div>
          {showInvested && (
            <>
              <div className="flex items-center">
                <div className="w-3 h-0.5 mr-2" style={{backgroundColor: CHART_COLORS.secondary}}></div>
                <span className="text-gray-300">Invested: {formatCurrency(currentInvested)}</span>
              </div>
              <div className={`font-medium ${currentPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                P&L: {formatCurrency(currentPnL)} ({currentPnLPercentage >= 0 ? '+' : ''}{currentPnLPercentage.toFixed(2)}%)
              </div>
            </>
          )}
        </div>
      </div>
      <div className="h-80">
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}