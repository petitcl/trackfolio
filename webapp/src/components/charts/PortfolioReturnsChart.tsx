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
import type { TimeRange } from '../TimeRangeSelector'
import type { HistoricalDataPoint } from '../../lib/mockData'
import { CHART_COLORS, CHART_CONFIGS } from '../../lib/constants/chartColors'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

interface PortfolioReturnsChartProps {
  data: HistoricalDataPoint[]
  timeRange: TimeRange
  className?: string
}

const assetTypeLabels: Record<string, string> = {
  stock: 'Stocks',
  etf: 'ETFs',
  crypto: 'Crypto',
  real_estate: 'Real Estate',
  other: 'Other Assets',
}

export default function PortfolioReturnsChart({ 
  data, 
  timeRange, 
  className = '' 
}: PortfolioReturnsChartProps) {
  
  // Get the latest data point for current returns
  const latestData = data[data.length - 1]
  
  if (!latestData) {
    return <div>No data available</div>
  }

  const assetTypes = ['stock', 'etf', 'crypto', 'real_estate', 'other']
  
  const getAssetTypeColor = (assetType: string): string => {
    return CHART_COLORS[assetType as keyof typeof CHART_COLORS] || CHART_COLORS.other
  }
  
  // Create a single stacked bar showing returns by asset type
  const chartData = {
    labels: ['Portfolio Returns'],
    datasets: assetTypes.map(assetType => ({
      label: assetTypeLabels[assetType],
      data: [(latestData.assetTypeReturns[assetType] || 0) * 100], // Convert to percentage
      backgroundColor: getAssetTypeColor(assetType),
      borderColor: getAssetTypeColor(assetType),
      borderWidth: 1,
    })),
  }

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        display: false, // Hide x-axis since we only have one bar
      },
      y: {
        stacked: true,
        title: {
          display: true,
          text: 'Returns (%)',
          ...CHART_CONFIGS.scales.y.title,
        },
        ticks: {
          ...CHART_CONFIGS.scales.y.ticks,
          callback: function(value) {
            return value + '%'
          }
        },
        grid: {
          ...CHART_CONFIGS.scales.y.grid,
        },
      },
    },
    indexAxis: 'y' as const, // Horizontal bar
    plugins: {
      legend: {
        position: 'right' as const,
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
            const value = context.parsed.x
            return `${context.dataset.label}: ${value.toFixed(2)}%`
          },
          afterLabel: function(context) {
            // Calculate approximate dollar value
            const percentage = context.parsed.x
            const approximateValue = (percentage / 100) * 50000 // Rough estimate
            return `≈ $${approximateValue.toLocaleString()}`
          }
        }
      }
    },
  }

  // Calculate total return
  const totalReturn = assetTypes.reduce((sum, assetType) => {
    return sum + ((latestData.assetTypeReturns[assetType] || 0) * 100)
  }, 0)

  return (
    <div className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Portfolio Returns by Asset Type
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Cumulative returns breakdown ({timeRange.toUpperCase()})
        </p>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1">
          Total Return: {totalReturn.toFixed(2)}%
        </p>
      </div>
      <div className="h-32">
        <Bar data={chartData} options={options} />
      </div>
      
      {/* Additional metrics table */}
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 text-gray-600 dark:text-gray-400 font-medium">Asset Type</th>
              <th className="text-right py-2 text-gray-600 dark:text-gray-400 font-medium">Return %</th>
              <th className="text-right py-2 text-gray-600 dark:text-gray-400 font-medium">Contribution</th>
            </tr>
          </thead>
          <tbody>
            {assetTypes.map(assetType => {
              const returnPct = (latestData.assetTypeReturns[assetType] || 0) * 100
              const contribution = (returnPct / totalReturn) * 100
              return (
                <tr key={assetType} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: getAssetTypeColor(assetType) }}
                    ></div>
                    {assetTypeLabels[assetType]}
                  </td>
                  <td className={`text-right py-2 font-medium ${returnPct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {returnPct.toFixed(2)}%
                  </td>
                  <td className="text-right py-2 text-gray-600 dark:text-gray-400">
                    {contribution.toFixed(1)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}