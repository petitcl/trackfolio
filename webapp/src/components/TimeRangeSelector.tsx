'use client'

import { getTimeRanges, TimeRange } from '@/lib/utils/timeranges'
import React from 'react'

interface TimeRangeSelectorProps {
  selectedRange: TimeRange
  onRangeChange: (range: TimeRange) => void
  className?: string
}

const timeRanges: { key: TimeRange; label: string }[] = getTimeRanges()

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