'use client'

import React from 'react'
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
import type { TimePeriod } from '@/lib/utils/timeranges'
import { CHART_COLORS } from '@/lib/constants/chartColors'
import { CURRENCY_SYMBOLS } from '@/lib/services/currency.service'
import { BucketedReturnMetrics } from '@/lib/services/portfolio-calculation.service'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

interface BucketedReturnsChartProps {
  data: BucketedReturnMetrics
  currency?: string
}

const formatPeriodLabel = (periodKey: string, timePeriod: TimePeriod): string => {
  // For years: "2021"
  if (timePeriod === 'year') {
    return periodKey
  }

  // For quarters: "Q1 '24"
  if (timePeriod === 'quarter') {
    const match = periodKey.match(/(\d{4})-Q(\d)/)
    if (match) {
      const [, year, quarter] = match
      return `Q${quarter} '${year.slice(2)}`
    }
  }

  // For months: "Jan '24"
  if (timePeriod === 'month') {
    const match = periodKey.match(/(\d{4})-(\d{2})/)
    if (match) {
      const [, year, month] = match
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return `${monthNames[parseInt(month) - 1]} '${year.slice(2)}`
    }
  }

  // For weeks: "Jan 15" (week starting date)
  if (timePeriod === 'week') {
    const date = new Date(periodKey)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${monthNames[date.getMonth()]} ${date.getDate()}`
  }

  // For days: "Jan 15"
  if (timePeriod === 'day') {
    const date = new Date(periodKey)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${monthNames[date.getMonth()]} ${date.getDate()}`
  }

  return periodKey
}

const formatCurrency = (value: number, currency: string = 'USD'): string => {
  const symbol = CURRENCY_SYMBOLS[currency as keyof typeof CURRENCY_SYMBOLS] || currency
  return `${symbol}${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}

const formatPercentage = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export default function BucketedReturnsChart({ data, currency = 'USD' }: BucketedReturnsChartProps) {
  if (!data.buckets || data.buckets.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        No data available for the selected time range
      </div>
    )
  }

  // Prepare labels
  const labels = data.buckets.map(bucket => formatPeriodLabel(bucket.periodKey, data.timePeriod))

  // Prepare datasets
  const dividendsData = data.buckets.map(bucket => bucket.dividends)
  const capitalGainsData = data.buckets.map(bucket => bucket.capitalGains)

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Dividends',
        data: dividendsData,
        backgroundColor: CHART_COLORS.primary,
        borderColor: CHART_COLORS.primary,
        borderWidth: 1,
        stack: 'returns'
      },
      {
        label: 'Capital Gains',
        data: capitalGainsData,
        backgroundColor: capitalGainsData.map(value => value >= 0 ? CHART_COLORS.accent : CHART_COLORS.danger),
        borderColor: capitalGainsData.map(value => value >= 0 ? CHART_COLORS.accent : CHART_COLORS.danger),
        borderWidth: 1,
        stack: 'returns'
      }
    ]
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
        stacked: true,
        grid: {
          display: false
        },
        ticks: {
          autoSkip: false,
          // maxRotation: 45,
          // minRotation: 45,
          color: CHART_COLORS.text.secondary
        }
      },
      y: {
        stacked: true,
        grid: {
          color: CHART_COLORS.grid
        },
        ticks: {
          callback: function(value) {
            return formatCurrency(value as number, currency)
          },
          color: CHART_COLORS.text.secondary
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: CHART_COLORS.text.secondary,
          usePointStyle: true,
          padding: 15
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        callbacks: {
          title: (tooltipItems) => {
            const index = tooltipItems[0].dataIndex
            const bucket = data.buckets[index]
            return bucket.periodKey
          },
          afterTitle: (tooltipItems) => {
            const index = tooltipItems[0].dataIndex
            const bucket = data.buckets[index]
            return [
              `Total P&L: ${formatCurrency(bucket.totalPnL, currency)} (${formatPercentage(bucket.totalReturnPercentage)})`,
              ''
            ]
          },
          label: (context) => {
            const label = context.dataset.label || ''
            const value = context.parsed.y
            return `${label}: ${formatCurrency(value, currency)}`
          },
          afterBody: (tooltipItems) => {
            const index = tooltipItems[0].dataIndex
            const bucket = data.buckets[index]
            return [
              '',
              `Net Inflows: ${formatCurrency(bucket.netInflows, currency)}`,
              `Start Value: ${formatCurrency(bucket.startValue, currency)}`,
              `End Value: ${formatCurrency(bucket.endValue, currency)}`
            ]
          }
        }
      }
    }
  }

  return (
    <div className="w-full" style={{ height: '400px' }}>
      <Bar data={chartData} options={options} />
    </div>
  )
}
