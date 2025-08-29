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
import { useTheme } from 'next-themes'

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

// Mock EUR/USD exchange rate (in real app, this would come from an API)
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
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  
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
  
  // Calculate cumulative invested amount (mock calculation)
  const calculateCumulativeInvested = (filteredData: HistoricalDataPoint[]) => {
    // Check if we have real cost basis data (from holding-specific data)
    const firstPoint = filteredData[0] as HistoricalDataPoint & { costBasis?: number }
    if (firstPoint && 'costBasis' in firstPoint) {
      // Use real cost basis data for holdings
      return filteredData.map(point => {
        const extendedPoint = point as HistoricalDataPoint & { costBasis?: number }
        return extendedPoint.costBasis || 0
      })
    }

    // Fallback to mock calculation for portfolio-level data
    const startValue = filteredData[0]?.totalValue || 0
    const investmentFlow = []
    let cumulativeInvested = startValue * USD_TO_EUR_RATE
    
    for (let i = 0; i < filteredData.length; i++) {
      // Simulate periodic investments/withdrawals
      const currentValue = filteredData[i].totalValue * USD_TO_EUR_RATE
      const previousValue = i > 0 ? filteredData[i-1].totalValue * USD_TO_EUR_RATE : startValue * USD_TO_EUR_RATE
      
      // If significant value increase without market gains, assume new investment
      const marketGrowth = previousValue * 0.0002 // Assume 0.02% daily growth
      const actualChange = currentValue - previousValue
      
      if (actualChange > marketGrowth * 2) {
        // Likely new investment
        cumulativeInvested += (actualChange - marketGrowth)
      } else if (actualChange < -marketGrowth * 2 && actualChange < -1000) {
        // Likely withdrawal
        cumulativeInvested += actualChange // This will reduce the cumulative
      }
      
      investmentFlow.push(cumulativeInvested)
    }
    
    return investmentFlow
  }

  const values = filteredData.map(point => point.totalValue * USD_TO_EUR_RATE)
  const cumulativeInvested = showInvested ? calculateCumulativeInvested(filteredData) : []

  const datasets = [
    {
      label: `${valueLabel} (${currency})`,
      data: values,
      borderColor: '#3B82F6', // Blue
      backgroundColor: '#3B82F640', // Blue with opacity
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
      borderColor: '#EF4444', // Red
      backgroundColor: '#EF444440', // Red with opacity
      fill: false,
      tension: 0.1,
      pointRadius: 0,
      pointHoverRadius: 5,
      borderDash: [5, 5], // Dashed line
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
          color: isDark ? '#E5E7EB' : '#374151',
        },
        ticks: {
          maxTicksLimit: 10,
          color: isDark ? '#D1D5DB' : '#6B7280',
        },
        grid: {
          color: isDark ? '#374151' : '#E5E7EB',
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: `Value (${currency})`,
          color: isDark ? '#E5E7EB' : '#374151',
        },
        ticks: {
          color: isDark ? '#D1D5DB' : '#6B7280',
          callback: function(value) {
            return formatCurrency(Number(value))
          }
        },
        grid: {
          color: isDark ? '#374151' : '#E5E7EB',
        },
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          color: isDark ? '#E5E7EB' : '#374151',
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        titleColor: isDark ? '#F9FAFB' : '#111827',
        bodyColor: isDark ? '#E5E7EB' : '#374151',
        backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
        borderColor: isDark ? '#374151' : '#E5E7EB',
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
            <div className="w-3 h-0.5 bg-blue-500 mr-2"></div>
            <span className="text-gray-600 dark:text-gray-300">Current {valueLabel}: {formatCurrency(currentValue)}</span>
          </div>
          {showInvested && (
            <>
              <div className="flex items-center">
                <div className="w-3 h-0.5 bg-red-500 border-dashed mr-2" style={{borderTop: '2px dashed #EF4444', height: '0px'}}></div>
                <span className="text-gray-600 dark:text-gray-300">Invested: {formatCurrency(currentInvested)}</span>
              </div>
              <div className={`font-medium ${currentPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
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