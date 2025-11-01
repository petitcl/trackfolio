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
import { CHART_COLORS, CHART_CONFIGS } from '../../lib/constants/chartColors'
import { currencyService, type SupportedCurrency } from '../../lib/services/currency.service'
import { type TimeRange } from '@/lib/utils/timeranges'

ChartJS.register(ArcElement, Tooltip, Legend)

interface PortfolioRepartitionChartProps {
  data: Array<{ assetType: string; value: number; percentage: number }>
  timeRange: TimeRange
  selectedCurrency: SupportedCurrency
  className?: string
}

const assetTypeLabels: Record<string, string> = {
  stock: 'Stocks',
  crypto: 'Crypto',
  real_estate: 'Real Estate',
  other: 'Other Assets',
  cash: 'Cash',
  currency: 'Currency',
}

export default function PortfolioRepartitionChart({
  data,
  timeRange,
  selectedCurrency,
  className = ''
}: PortfolioRepartitionChartProps) {
  
  const getAssetTypeColor = (assetType: string): string => {
    const color = CHART_COLORS[assetType as keyof typeof CHART_COLORS]
    return (typeof color === 'string' ? color : CHART_COLORS.other) as string
  }
  
  // Define all possible asset types to ensure consistent legend
  const allAssetTypes = ['stock', 'crypto', 'real_estate', 'cash', 'other']
  
  // Create a map of existing data for quick lookup
  const dataMap = new Map(data.map(item => [item.assetType, item]))
  
  // Build complete dataset with all asset types (zero values for missing ones)
  const completeData = allAssetTypes.map(assetType => {
    const existingData = dataMap.get(assetType)
    return existingData || { assetType, value: 0, percentage: 0 }
  })
  
  const chartData = {
    labels: completeData.map(item => assetTypeLabels[item.assetType] || item.assetType),
    datasets: [
      {
        data: completeData.map(item => item.percentage),
        backgroundColor: completeData.map(item => getAssetTypeColor(item.assetType)),
        borderColor: completeData.map(item => getAssetTypeColor(item.assetType)),
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
            const label = context.label || ''
            const value = context.parsed
            const dataPoint = completeData[context.dataIndex]
            const formattedValue = currencyService.formatCurrency(dataPoint.value, selectedCurrency)
            return `${label}: ${value.toFixed(1)}% (${formattedValue})`
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
          Current asset allocation by type
        </p>
      </div>
      <div className="h-80">
        <Pie data={chartData} options={options} />
      </div>
    </div>
  )
}