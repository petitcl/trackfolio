'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { type AuthUser } from '@/lib/auth/client.auth.service'
import { portfolioService } from '@/lib/services/portfolio.service'
import { accountHoldingService, type CreateAccountHoldingParams } from '@/lib/services/account-holding.service'
import type { AssetType } from '@/lib/supabase/types'
import debounce from 'lodash/debounce'

type HoldingType = 'market' | 'custom' | 'account'
type AccountType = 'crypto_exchange' | 'stock_broker' | 'retirement' | 'bank'

interface SearchResult {
  symbol: string
  name: string
  type: string
  exchange?: string
  currency?: string
}

interface AddHoldingModalProps {
  user: AuthUser
  onHoldingAdded?: (symbol: string) => void
  onCancel?: () => void
}

export default function AddHoldingModal({
  user,
  onHoldingAdded,
  onCancel
}: AddHoldingModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [holdingType, setHoldingType] = useState<HoldingType>('market')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState<SearchResult | null>(null)

  // Form fields - regular holdings
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [assetType, setAssetType] = useState<AssetType>('stock')
  const [currency, setCurrency] = useState('USD')

  // Form fields - account holdings
  const [accountSymbol, setAccountSymbol] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('crypto_exchange')
  const [accountProvider, setAccountProvider] = useState('')
  const [accountCurrency, setAccountCurrency] = useState('USD')
  const [initialValue, setInitialValue] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])

  // Debounced search function using the symbols API
  const searchSymbols = useMemo(
    () => debounce(async (query: string) => {
      if (query.length < 2) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      try {
        const response = await fetch(`/api/symbols/search?q=${encodeURIComponent(query)}`)
        if (!response.ok) {
          throw new Error('Failed to search symbols')
        }

        const data = await response.json()
        setSearchResults(data.results || [])
      } catch (error) {
        console.error('Error searching symbols:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300),
    [setSearchResults, setIsSearching]
  )

  useEffect(() => {
    if (holdingType === 'market' && searchQuery) {
      searchSymbols(searchQuery)
    }
  }, [searchQuery, holdingType, searchSymbols])

  const handleSymbolSelect = (result: SearchResult) => {
    setSelectedSymbol(result)
    setSymbol(result.symbol)
    setName(result.name)
    setAssetType(result.type === 'crypto' ? 'crypto' : 'stock')
    setCurrency(result.currency || 'USD')
    setSearchQuery(result.symbol)
    setSearchResults([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setIsLoading(true)

      if (holdingType === 'account') {
        // Handle account holding creation
        const params: CreateAccountHoldingParams = {
          symbol: accountSymbol.toUpperCase(),
          displayName: accountName,
          accountType: accountType,
          provider: accountProvider || undefined,
          currency: accountCurrency,
          initialValue: parseFloat(initialValue),
          startDate: startDate
        }

        await accountHoldingService.createAccountHolding(user, params)

        console.log('✅ Account holding added successfully')
        onHoldingAdded?.(accountSymbol.toUpperCase())
      } else {
        // Handle market or custom asset
        const isCustom = holdingType === 'custom'

        // Create or get the symbol first
        const symbolResult = await portfolioService.createOrGetSymbol({
          symbol: symbol.toUpperCase(),
          name: name,
          asset_type: assetType,
          currency: currency,
          is_custom: isCustom,
          created_by_user_id: isCustom ? user.id : null,
          last_price: null
        })

        if (!symbolResult) {
          throw new Error('Failed to create or get symbol')
        }

        // Add the position using the new addPosition method
        const result = await portfolioService.addPosition(user, symbol.toUpperCase())

        if (!result.success) {
          throw new Error(result.error || 'Failed to add position')
        }

        console.log('✅ Position added successfully')
        onHoldingAdded?.(symbol.toUpperCase())
      }
    } catch (error) {
      console.error('Error adding position:', error)
      alert(`Error adding position: ${error instanceof Error ? error.message : 'Please try again.'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const getAssetTypes = (): { value: AssetType; label: string }[] => {
    return [
      { value: 'stock', label: 'Stock' },
      { value: 'crypto', label: 'Cryptocurrency' },
      { value: 'real_estate', label: 'Real Estate' },
      { value: 'other', label: 'Other (Collectibles, Private Equity, etc.)' },
    ]
  }

  const getCurrencies = (): { value: string; label: string }[] => {
    return [
      { value: 'USD', label: 'USD - US Dollar' },
      { value: 'EUR', label: 'EUR - Euro' },
      { value: 'GBP', label: 'GBP - British Pound' },
      { value: 'JPY', label: 'JPY - Japanese Yen' },
      { value: 'CAD', label: 'CAD - Canadian Dollar' },
      { value: 'AUD', label: 'AUD - Australian Dollar' },
      { value: 'CHF', label: 'CHF - Swiss Franc' },
      { value: 'CNY', label: 'CNY - Chinese Yuan' },
      { value: 'BTC', label: 'BTC - Bitcoin' },
      { value: 'ETH', label: 'ETH - Ethereum' },
    ]
  }

  const getAccountTypes = (): { value: AccountType; label: string }[] => {
    return [
      { value: 'crypto_exchange', label: 'Crypto Exchange' },
      { value: 'stock_broker', label: 'Stock Broker' },
      { value: 'retirement', label: 'Retirement Account' },
      { value: 'bank', label: 'Bank Account' },
    ]
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Add New Position
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Add a new position to your portfolio
        </p>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="px-6 py-4">
        <div className="space-y-4">
          {/* Holding Type Selector - First Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Holding Type
            </label>
            <select
              value={holdingType}
              onChange={(e) => {
                const newType = e.target.value as HoldingType
                setHoldingType(newType)
                // Reset form fields when switching types
                setSearchQuery('')
                setSelectedSymbol(null)
                setSymbol('')
                setName('')
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="market">Market Asset</option>
              <option value="custom">Custom Asset</option>
              <option value="account">Account Holding</option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {holdingType === 'market' && 'Track stocks, ETFs, or crypto from public markets'}
              {holdingType === 'custom' && 'Track custom investments like real estate or collectibles'}
              {holdingType === 'account' && 'Track external account balances (exchanges, brokerages, etc.)'}
            </p>
          </div>

          {/* Symbol Search or Input */}
          {holdingType === 'market' ? (
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Search Symbol
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for a stock, ETF, or crypto..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                />
                {isSearching && (
                  <div className="absolute right-3 top-2.5">
                    <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  </div>
                )}
              </div>

              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute z-10 mt-1 left-0 right-0 bg-white dark:bg-gray-700 shadow-lg rounded-md border border-gray-200 dark:border-gray-600 max-h-60 overflow-auto">
                  {searchResults.map((result) => (
                    <button
                      key={result.symbol}
                      type="button"
                      onClick={() => handleSymbolSelect(result)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600"
                    >
                      <div className="font-medium text-gray-900 dark:text-white">
                        {result.symbol}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {result.name} {result.exchange && `• ${result.exchange}`} {result.currency && `• ${result.currency}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedSymbol && (
                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded-md">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Selected: <strong>{selectedSymbol.symbol}</strong> - {selectedSymbol.name}
                  </p>
                </div>
              )}
            </div>
          ) : holdingType === 'custom' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Symbol/Code
                </label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="e.g., MY-HOUSE, VINTAGE-WATCH"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., My Primary Residence, 1965 Rolex Submariner"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </>
          ) : (
            /* Account Holding Form */
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Symbol/Name
                </label>
                <input
                  type="text"
                  value={accountSymbol}
                  onChange={(e) => setAccountSymbol(e.target.value)}
                  placeholder="e.g., BINANCE_TRADING"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  This will be used as the symbol identifier
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g., Binance Trading Account"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Account Type
                </label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as AccountType)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                >
                  {getAccountTypes().map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Provider (Optional)
                </label>
                <input
                  type="text"
                  value={accountProvider}
                  onChange={(e) => setAccountProvider(e.target.value)}
                  placeholder="e.g., Binance, Coinbase, Fidelity..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Currency
                </label>
                <select
                  value={accountCurrency}
                  onChange={(e) => setAccountCurrency(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                >
                  {getCurrencies().map((curr) => (
                    <option key={curr.value} value={curr.value}>
                      {curr.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Current Account Value
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={initialValue}
                  onChange={(e) => setInitialValue(e.target.value)}
                  placeholder="10000.00"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Starting Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </>
          )}

          {/* Asset Type and Currency for non-account holdings */}
          {holdingType !== 'account' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Asset Type
                </label>
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value as AssetType)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                >
                  {getAssetTypes().map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                >
                  {getCurrencies().map((curr) => (
                    <option key={curr.value} value={curr.value}>
                      {curr.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        {/* Submit Buttons */}
        <div className="flex space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              isLoading ||
              (holdingType === 'market' && !selectedSymbol) ||
              (holdingType === 'custom' && (!symbol || !name)) ||
              (holdingType === 'account' && (!accountSymbol || !accountName || !initialValue || !startDate))
            }
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Adding...' : holdingType === 'account' ? 'Create Account Holding' : 'Add Position'}
          </button>
        </div>
      </form>
    </div>
  )
}
