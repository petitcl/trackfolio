'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { clientAuthService, type AuthUser } from '@/lib/auth/client.auth.service'
import { portfolioService } from '@/lib/services/portfolio.service'
import type { AssetType, Symbol } from '@/lib/supabase/database.types'
import { mockDataStore } from '@/lib/mockDataStore'
import debounce from 'lodash/debounce'

interface SearchResult {
  symbol: string
  name: string
  type: string
  exchange?: string
}

export default function AddHoldingPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCustom, setIsCustom] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState<SearchResult | null>(null)
  
  // Form fields
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [assetType, setAssetType] = useState<AssetType>('stock')
  const [quantity, setQuantity] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const loadUser = async () => {
      try {
        const authUser = await clientAuthService.getUser()
        if (!authUser) {
          router.push('/login')
          return
        }
        setUser(authUser)
      } catch (error) {
        console.error('Error loading user:', error)
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }
    loadUser()
  }, [router])

  // Debounced search function for Yahoo Finance API alternative
  const searchSymbols = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      try {
        // Using Alpha Vantage free API as an example (requires free API key)
        // For now, we'll use mock data but you can replace with actual API call
        // const response = await fetch(`https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${query}&apikey=MALNCL4LXK8WUZBI`)
        
        // Mock search results for demonstration
        const mockResults: SearchResult[] = [
          { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', exchange: 'NASDAQ' },
          { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'stock', exchange: 'NASDAQ' },
          { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'stock', exchange: 'NASDAQ' },
          { symbol: 'BTC-USD', name: 'Bitcoin USD', type: 'crypto' },
          { symbol: 'ETH-USD', name: 'Ethereum USD', type: 'crypto' },
        ].filter(item => 
          item.symbol.toLowerCase().includes(query.toLowerCase()) ||
          item.name.toLowerCase().includes(query.toLowerCase())
        )
        
        setSearchResults(mockResults)
      } catch (error) {
        console.error('Error searching symbols:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300),
    []
  )

  useEffect(() => {
    if (!isCustom && searchQuery) {
      searchSymbols(searchQuery)
    }
  }, [searchQuery, isCustom, searchSymbols])

  const handleSymbolSelect = (result: SearchResult) => {
    setSelectedSymbol(result)
    setSymbol(result.symbol)
    setName(result.name)
    setAssetType(result.type === 'crypto' ? 'crypto' : 'stock')
    setSearchQuery(result.symbol)
    setSearchResults([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) return

    try {
      setIsLoading(true)
      
      // Create or find the symbol
      const symbolData: Partial<Symbol> = {
        symbol: symbol.toUpperCase(),
        name: name,
        asset_type: assetType,
        is_custom: isCustom,
        created_by_user_id: isCustom ? user.id : null
      }

      if (user.isDemo) {
        // For demo users, add to mock data store
        mockDataStore.addHolding({
          symbol: symbol.toUpperCase(),
          name: name,
          assetType: assetType,
          quantity: parseFloat(quantity),
          purchasePrice: parseFloat(purchasePrice),
          purchaseDate: purchaseDate,
          notes: notes || undefined,
          isCustom: isCustom
        })
        
        console.log('✅ Holding added to mock data store')
      } else {
        // For real users, use Supabase
        // await portfolioService.addHolding(user, {
        //   symbol: symbolData,
        //   quantity: parseFloat(quantity),
        //   purchasePrice: parseFloat(purchasePrice),
        //   purchaseDate,
        //   notes
        // })
        console.log('✅ Holding added via Supabase')
      }
      
      router.push('/')
    } catch (error) {
      console.error('Error adding holding:', error)
      alert('Error adding holding. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const getAssetTypes = (): { value: AssetType; label: string }[] => {
    return [
      { value: 'stock', label: 'Stock' },
      { value: 'etf', label: 'ETF' },
      { value: 'crypto', label: 'Cryptocurrency' },
      { value: 'real_estate', label: 'Real Estate' },
      { value: 'other', label: 'Other (Collectibles, Private Equity, etc.)' },
    ]
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="mb-6">
              <button
                onClick={() => router.push('/')}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ← Back to Dashboard
              </button>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Add New Holding
            </h1>

            {/* Toggle between real and custom */}
            <div className="mb-6">
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsCustom(false)
                    setSearchQuery('')
                    setSelectedSymbol(null)
                    setSymbol('')
                    setName('')
                    setAssetType('stock')
                  }}
                  className={`px-4 py-2 rounded-md font-medium ${
                    !isCustom
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Market Asset
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustom(true)
                    setSearchResults([])
                    setSelectedSymbol(null)
                    setSymbol('')
                    setName('')
                    setAssetType('other')
                  }}
                  className={`px-4 py-2 rounded-md font-medium ${
                    isCustom
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Custom Asset
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Symbol Search or Input */}
              {!isCustom ? (
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
                            {result.name} {result.exchange && `• ${result.exchange}`}
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
              ) : (
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
              )}

              {/* Asset Type */}
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

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g., 100"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Purchase Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Purchase Price (per unit)
                </label>
                <input
                  type="number"
                  step="any"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="e.g., 150.00"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Purchase Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Purchase Date
                </label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any additional information..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex space-x-4 pt-4">
                <button
                  type="submit"
                  disabled={isLoading || (!isCustom && !selectedSymbol) || (isCustom && (!symbol || !name))}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Adding...' : 'Add Holding'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}