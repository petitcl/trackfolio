'use client'

import React from 'react'
import { currencyService, SUPPORTED_CURRENCIES, CURRENCY_SYMBOLS, CURRENCY_NAMES, type SupportedCurrency } from '@/lib/services/currency.service'

interface CurrencySelectorProps {
  selectedCurrency: SupportedCurrency
  onCurrencyChange: (currency: SupportedCurrency) => void
  className?: string
}

export default function CurrencySelector({ selectedCurrency, onCurrencyChange, className = '' }: CurrencySelectorProps) {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newCurrency = event.target.value as SupportedCurrency
    currencyService.setPreferredCurrency(newCurrency)
    onCurrencyChange(newCurrency)
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <span className="text-sm text-gray-400">Currency:</span>
      <select
        value={selectedCurrency}
        onChange={handleChange}
        className="bg-gray-800 text-gray-200 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {SUPPORTED_CURRENCIES.map(currency => (
          <option key={currency} value={currency}>
            {CURRENCY_SYMBOLS[currency]} {currency} - {CURRENCY_NAMES[currency]}
          </option>
        ))}
      </select>
    </div>
  )
}