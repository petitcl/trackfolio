'use client'

import React from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js'
import { Pie } from 'react-chartjs-2'
import type { TimeRange } from '../TimeRangeSelector'
import { useTheme } from '@/lib/theme/theme.context'

ChartJS.register(ArcElement, Tooltip, Legend)

interface PortfolioRepartitionChartProps {
  data: Array<{ assetType: string; value: number; percentage: number }>
  timeRange: TimeRange
  className?: string
}

const assetTypeColors: Record<string, string> = {
  stock: '#3B82F6', // Blue
  etf: '#10B981',   // Green
  crypto: '#F59E0B', // Yellow
  real_estate: '#8B5CF6', // Purple
  other: '#F97316', // Orange
  cash: '#6B7280'   // Gray
}

const assetTypeLabels: Record<string, string> = {
  stock: 'Stocks',
  etf: 'ETFs',
  crypto: 'Crypto',
  real_estate: 'Real Estate',
  other: 'Other Assets',
  cash: 'Cash'
}

export default function PortfolioRepartitionChart({ 
  data, 
  timeRange, 
  className = '' 
}: PortfolioRepartitionChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  
  const chartData = {
    labels: data.map(item => assetTypeLabels[item.assetType] || item.assetType),
    datasets: [
      {
        data: data.map(item => item.percentage),
        backgroundColor: data.map(item => assetTypeColors[item.assetType] || '#9CA3AF'),
        borderColor: data.map(item => assetTypeColors[item.assetType] || '#9CA3AF'),
        borderWidth: 2,
      },
    ],
  }

  const options: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 15,
          usePointStyle: true,
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
            const label = context.label || ''
            const value = context.parsed
            const dataPoint = data[context.dataIndex]
            return `${label}: ${value.toFixed(1)}% ($${dataPoint.value.toLocaleString()})`
          }
        }
      }
    },
  }

  return (
    <div className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Portfolio Repartition
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Asset allocation by type ({timeRange.toUpperCase()})
        </p>
      </div>
      <div className="h-80">
        <Pie data={chartData} options={options} />
      </div>
    </div>
  )
}