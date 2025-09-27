'use client'

import React, { useState } from 'react'

interface BrokerSelectProps {
  value?: string
  onChange: (value: string) => void
  className?: string
}

const POPULAR_BROKERS = [
  'Degiro',
  'Revolut',
  'Trading 212',
  'Interactive Brokers',
  'E*TRADE',
  'eToro',
  'Charles Schwab',
  'Fidelity',
  'TD Ameritrade',
  'Robinhood',
  'Vanguard',
  'Merrill Lynch',
  'Morgan Stanley',
  'Wells Fargo Advisors',
  'Ally Invest',
  'Webull',
  'M1 Finance',
  'Public',
  'SoFi',
  'Firstrade',
  'TradeStation',
  'Tastytrade',
  'Think or Swim',
  'Plus500',
  'Freetrade'
]

export default function BrokerSelect({ value = '', onChange, className = '' }: BrokerSelectProps) {
  const [isCustom, setIsCustom] = useState(() => {
    // If current value is not in the predefined list, it's custom
    return value && !POPULAR_BROKERS.includes(value)
  })
  const [customValue, setCustomValue] = useState(() => {
    // If current value is not in the predefined list, use it as custom value
    return value && !POPULAR_BROKERS.includes(value) ? value : ''
  })

  const handleSelectChange = (selectedValue: string) => {
    if (selectedValue === 'custom') {
      setIsCustom(true)
      onChange(customValue)
    } else {
      setIsCustom(false)
      onChange(selectedValue)
    }
  }

  const handleCustomInputChange = (customInputValue: string) => {
    setCustomValue(customInputValue)
    onChange(customInputValue)
  }

  const baseClassName = `w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${className}`

  return (
    <div className="space-y-2">
      {!isCustom ? (
        <select
          value={POPULAR_BROKERS.includes(value) ? value : ''}
          onChange={(e) => handleSelectChange(e.target.value)}
          className={baseClassName}
        >
          <option value="">Select a broker</option>
          {POPULAR_BROKERS.map(broker => (
            <option key={broker} value={broker}>
              {broker}
            </option>
          ))}
          <option value="custom">Other (custom)</option>
        </select>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            value={customValue}
            onChange={(e) => handleCustomInputChange(e.target.value)}
            placeholder="Enter your broker name"
            className={baseClassName}
          />
          <button
            type="button"
            onClick={() => {
              setIsCustom(false)
              setCustomValue('')
              onChange('')
            }}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Back to broker list
          </button>
        </div>
      )}
    </div>
  )
}