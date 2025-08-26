'use client'

import React from 'react'

export type TimeRange = '1d' | '5d' | '1m' | '6m' | 'ytd' | '1y' | '5y' | 'all'

interface TimeRangeSelectorProps {
  selectedRange: TimeRange
  onRangeChange: (range: TimeRange) => void
  className?: string
}

const timeRanges: { key: TimeRange; label: string }[] = [
  { key: '1d', label: '1D' },
  { key: '5d', label: '5D' },
  { key: '1m', label: '1M' },
  { key: '6m', label: '6M' },
  { key: 'ytd', label: 'YTD' },
  { key: '1y', label: '1Y' },
  { key: '5y', label: '5Y' },
  { key: 'all', label: 'ALL' },
]

export default function TimeRangeSelector({ 
  selectedRange, 
  onRangeChange, 
  className = '' 
}: TimeRangeSelectorProps) {
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {timeRanges.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onRangeChange(key)}
          className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
            selectedRange === key
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}