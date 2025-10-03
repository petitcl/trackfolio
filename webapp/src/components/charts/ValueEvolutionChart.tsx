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
import { type SupportedCurrency, CURRENCY_SYMBOLS } from '../../lib/services/currency.service'
import { getStartDateForTimeRange } from '@/lib/utils/timeranges'

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
  currency?: SupportedCurrency
  showInvested?: boolean
}


export default function ValueEvolutionChart({ 
  data, 
  timeRange, 
  title,
  description,
  className = '',
  valueLabel = 'Value',
  investedLabel = 'Cumulative Invested',
  currency = 'USD',
  showInvested = true
}: ValueEvolutionChartProps) {
  
  // Filter data based on time range
  const filterDataByTimeRange = (data: HistoricalDataPoint[], range: TimeRange) => {
    const startDate: Date = getStartDateForTimeRange(range)
    
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
        return extendedPoint.costBasis || 0
      })
    }

    // Fallback for legacy data without cost basis
    console.warn('No cost basis data found in historical data, using fallback calculation')
    const initialInvested = filteredData[0]?.totalValue || 0
    return filteredData.map(() => initialInvested)
  }

  const values = filteredData.map(point => point.totalValue)
  const cumulativeInvested = showInvested ? calculateCumulativeInvested(filteredData) : []
  const totalReturnValues = filteredData.map(point => {
    const dividends = point.cumulativeDividends || 0
    return point.totalValue + dividends
  })

  const datasets: any[] = []

  // Line 1: Cost Basis (Gray)
  if (showInvested) {
    datasets.push({
      label: `${investedLabel} (${currency})`,
      data: cumulativeInvested,
      borderColor: 'rgb(156, 163, 175)', // gray-400
      backgroundColor: 'rgba(156, 163, 175, 0.1)',
      pointBackgroundColor: 'rgb(156, 163, 175)',
      pointBorderColor: '#fff',
      fill: false,
      tension: 0.1,
      pointRadius: 0,
      pointHoverRadius: 5,
    })
  }

  // Line 2: Market Value (Blue) - excludes dividends
  datasets.push({
    label: `${valueLabel} (${currency})`,
    data: values,
    borderColor: CHART_CONFIGS.lineChart.primaryLine.borderColor,
    backgroundColor: CHART_CONFIGS.lineChart.primaryLine.backgroundColor,
    pointBackgroundColor: CHART_CONFIGS.lineChart.primaryLine.pointBackgroundColor,
    pointBorderColor: CHART_CONFIGS.lineChart.primaryLine.pointBorderColor,
    fill: false,
    tension: 0.1,
    pointRadius: 0,
    pointHoverRadius: 5,
  })

  // Line 3: Total Return (Red) - includes dividends
  datasets.push({
    label: `Total Return (${currency})`,
    data: totalReturnValues,
    borderColor: 'rgb(239, 68, 68)', // red-500
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    pointBackgroundColor: 'rgb(239, 68, 68)',
    pointBorderColor: '#fff',
    fill: false,
    tension: 0.1,
    pointRadius: 0,
    pointHoverRadius: 5,
  })

  const chartData = {
    labels: filteredData.map(point => {
      const date = new Date(point.date)
      // Format based on time range
      if (timeRange === '5d') {
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
        min: 0,
        title: {
          display: true,
          text: `Value (${CURRENCY_SYMBOLS[currency]})`,
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
          title: function(tooltipItems) {
            // Show exact date for tooltip title instead of the chart label
            const dataIndex = tooltipItems[0].dataIndex
            const date = new Date(filteredData[dataIndex].date)
            return date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })
          },
          label: function(context) {
            const value = Number(context.parsed.y)
            return `${context.dataset.label}: ${formatCurrency(value)}`
          },
          afterBody: function(tooltipItems) {
            if (showInvested && tooltipItems.length >= 2) {
              // tooltipItems order: [0] = Cost Basis, [1] = Market Value, [2] = Total Return
              const invested = Number(tooltipItems[0].parsed.y)
              const marketValue = Number(tooltipItems[1].parsed.y)
              const totalReturn = tooltipItems.length >= 3 ? Number(tooltipItems[2].parsed.y) : marketValue

              const unrealizedPnL = marketValue - invested
              const dividends = totalReturn - marketValue
              const totalPnL = totalReturn - invested
              const totalPnLPercentage = invested > 0 ? (totalPnL / invested) * 100 : 0

              return [
                `Unrealized P&L: ${formatCurrency(unrealizedPnL)}`,
                `Dividends: ${formatCurrency(dividends)}`,
                `Total P&L: ${formatCurrency(totalPnL)} (${totalPnLPercentage >= 0 ? '+' : ''}${totalPnLPercentage.toFixed(2)}%)`
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
  const currentTotalReturn = totalReturnValues[totalReturnValues.length - 1] || 0
  const currentDividends = currentTotalReturn - currentValue
  const unrealizedPnL = currentValue - currentInvested
  const totalPnL = currentTotalReturn - currentInvested
  const totalPnLPercentage = showInvested && currentInvested > 0 ? (totalPnL / currentInvested) * 100 : 0

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
          {showInvested && (
            <div className="flex items-center">
              <div className="w-3 h-0.5 mr-2" style={{backgroundColor: 'rgb(156, 163, 175)'}}></div>
              <span className="text-gray-600 dark:text-gray-300">Invested: {formatCurrency(currentInvested)}</span>
            </div>
          )}
          <div className="flex items-center">
            <div className="w-3 h-0.5 mr-2" style={{backgroundColor: CHART_COLORS.primary}}></div>
            <span className="text-gray-900 dark:text-gray-300">Market Value: {formatCurrency(currentValue)}</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-0.5 mr-2" style={{backgroundColor: 'rgb(239, 68, 68)'}}></div>
            <span className="text-gray-900 dark:text-gray-300">Total Return: {formatCurrency(currentTotalReturn)}</span>
          </div>
          {showInvested && (
            <>
              <div className="flex items-center">
                <span className="text-gray-600 dark:text-gray-400">Dividends: {formatCurrency(currentDividends)}</span>
              </div>
              <div className={`font-medium ${totalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                Total P&L: {formatCurrency(totalPnL)} ({totalPnLPercentage >= 0 ? '+' : ''}{totalPnLPercentage.toFixed(2)}%)
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