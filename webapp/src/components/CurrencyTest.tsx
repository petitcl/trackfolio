'use client'

import React, { useState, useEffect } from 'react'
import { currencyService, type SupportedCurrency, CURRENCY_SYMBOLS } from '@/lib/services/currency.service'
import { clientAuthService } from '@/lib/auth/client.auth.service'
import { mockSymbols } from '@/lib/mockData'

export default function CurrencyTest() {
  const [user, setUser] = useState<any>(null)
  const [testAmounts, setTestAmounts] = useState<{ [key: string]: string }>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const initUser = async () => {
      const currentUser = await clientAuthService.getCurrentUser()
      setUser(currentUser)
    }
    initUser()
  }, [])

  const testConversion = async () => {
    if (!user) return

    setLoading(true)
    try {
      const testAmount = 1000 // $1000 USD
      const results: { [key: string]: string } = {}

      // Test conversion from USD to all supported currencies
      for (const currency of currencyService.getSupportedCurrencies()) {
        if (currency !== 'USD') {
          const converted = await currencyService.convertAmount(testAmount, 'USD', currency, user, mockSymbols)
          results[`USD_to_${currency}`] = `${CURRENCY_SYMBOLS.USD}${testAmount} → ${currencyService.formatCurrency(converted, currency)}`
        }
      }

      // Test reverse conversions
      for (const currency of currencyService.getSupportedCurrencies()) {
        if (currency !== 'USD') {
          const converted = await currencyService.convertAmount(testAmount, currency, 'USD', user, mockSymbols)
          results[`${currency}_to_USD`] = `${currencyService.formatCurrency(testAmount, currency)} → ${currencyService.formatCurrency(converted, 'USD')}`
        }
      }

      // Test cross-currency (EUR to GBP)
      const eurToGbp = await currencyService.convertAmount(1000, 'EUR', 'GBP', user, mockSymbols)
      results['EUR_to_GBP'] = `${currencyService.formatCurrency(1000, 'EUR')} → ${currencyService.formatCurrency(eurToGbp, 'GBP')}`

      setTestAmounts(results)
    } catch (error) {
      console.error('Currency test failed:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <div className="p-4 bg-gray-800 rounded-lg border border-gray-600 text-white">
      <h3 className="text-lg font-semibold mb-4">Currency Conversion Test</h3>
      
      <button
        onClick={testConversion}
        disabled={loading}
        className="mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test Currency Conversions'}
      </button>

      {Object.keys(testAmounts).length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-300">Conversion Results:</h4>
          {Object.entries(testAmounts).map(([key, value]) => (
            <div key={key} className="text-sm text-gray-300">
              <strong>{key.replace(/_/g, ' ')}:</strong> {value}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}