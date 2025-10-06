'use client'

import React, { useState, useEffect, useCallback } from 'react'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import type { UserSymbolPrice } from '@/lib/supabase/types'
import { portfolioService } from '@/lib/services/portfolio.service'
import AddPriceForm, { type PriceFormData } from './AddPriceForm'
import ConfirmDialog from './ConfirmDialog'
import { currencyService, type SupportedCurrency } from '@/lib/services/currency.service'
import ProfitDisplay from './ProfitDisplay'

interface ManualPriceHistoryProps {
  user: AuthUser
  symbol: string
  onPriceUpdated?: () => void
  selectedCurrency?: SupportedCurrency
  symbolCurrency?: string
}

export default function ManualPriceHistory({ user, symbol, onPriceUpdated, selectedCurrency = 'USD', symbolCurrency = 'USD' }: ManualPriceHistoryProps) {
  const [prices, setPrices] = useState<UserSymbolPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [displayedCount, setDisplayedCount] = useState(20)
  const [hasMore, setHasMore] = useState(false)
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [priceToDelete, setPriceToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadPriceHistory = useCallback(async () => {
    try {
      setLoading(true)
      const priceHistory = await portfolioService.getUserSymbolPrices(user, symbol)
      setPrices(priceHistory)
      setHasMore(priceHistory.length > 20)
    } catch (err) {
      console.error('Error loading price history:', err)
      setError('Failed to load price history')
    } finally {
      setLoading(false)
    }
  }, [user, symbol])

  useEffect(() => {
    loadPriceHistory()
  }, [loadPriceHistory])

  const handleEditPrice = async (priceData: PriceFormData) => {
    if (!editingPriceId) return
    
    setIsUpdating(true)
    try {
      await portfolioService.updateUserSymbolPrice(user, editingPriceId, {
        symbol,
        manual_price: priceData.price,
        price_date: priceData.date,
        notes: priceData.notes.trim() || null
      })
      setEditingPriceId(null)
      await loadPriceHistory()
      onPriceUpdated?.()
    } catch (err) {
      console.error('Error updating price:', err)
      alert('Failed to update price')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeletePrice = async () => {
    if (!priceToDelete) return
    
    setIsDeleting(true)
    try {
      await portfolioService.deleteUserSymbolPrice(user, priceToDelete)
      setShowDeleteConfirm(false)
      setPriceToDelete(null)
      await loadPriceHistory()
      onPriceUpdated?.()
    } catch (err) {
      console.error('Error deleting price:', err)
      alert('Failed to delete price entry')
    } finally {
      setIsDeleting(false)
    }
  }

  const initiateDeletePrice = (priceId: string) => {
    setPriceToDelete(priceId)
    setShowDeleteConfirm(true)
  }

  const getEditFormData = (price: UserSymbolPrice): PriceFormData => {
    return {
      price: price.manual_price,
      date: price.price_date,
      notes: price.notes || ''
    }
  }

  const formatCurrency = (amount: number) => {
    return currencyService.formatCurrency(amount, selectedCurrency)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const calculatePriceChange = (currentPrice: number, previousPrice: number | null) => {
    if (!previousPrice) return null
    const change = ((currentPrice - previousPrice) / previousPrice) * 100
    return change
  }

  const displayedPrices = prices.slice(0, displayedCount)
  const remainingCount = Math.max(0, prices.length - displayedCount)

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border dark:border-gray-700">
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4 w-48"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border dark:border-gray-700">
        <div className="p-6">
          <div className="text-red-600 dark:text-red-400">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg border dark:border-gray-700">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Price History</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manual price updates for {symbol}
        </p>
      </div>

      {prices.length === 0 ? (
        <div className="p-6 text-center">
          <div className="text-gray-500 dark:text-gray-400">
            <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No price history</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Add manual price updates to track historical values.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Change
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {displayedPrices.map((price, index) => {
                const previousPrice = index < displayedPrices.length - 1 ? displayedPrices[index + 1].manual_price : null
                const priceChange = calculatePriceChange(price.manual_price, previousPrice)
                const isEditing = editingPriceId === price.id
                
                if (isEditing) {
                  return (
                    <React.Fragment key={price.id}>
                      <tr>
                        <td colSpan={5} className="px-0 py-0">
                          <div className="p-4 bg-gray-50 dark:bg-gray-900 border-l-4 border-blue-500">
                            <AddPriceForm
                              user={user}
                              symbol={symbol}
                              symbolCurrency={symbolCurrency}
                              onPriceAdded={handleEditPrice}
                              onCancel={() => setEditingPriceId(null)}
                              onDelete={() => initiateDeletePrice(price.id)}
                              editMode={true}
                              initialData={getEditFormData(price)}
                              isInline={true}
                              isLoading={isUpdating}
                            />
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  )
                }
                
                return (
                  <tr key={price.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatDate(price.price_date)}
                      {index === 0 && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Latest
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(price.manual_price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {priceChange !== null ? (
                        <span className="inline-flex items-center">
                          <ProfitDisplay value={Math.abs(priceChange)} format="percentage" showSign={false} />
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="max-w-xs truncate" title={price.notes || ''}>
                        {price.notes || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button
                        onClick={() => setEditingPriceId(price.id)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                        title="Edit price entry"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => initiateDeletePrice(price.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
                        title="Delete price entry"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          
          {remainingCount > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setDisplayedCount(prev => prev + 20)}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
              >
                Load More ({remainingCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false)
          setPriceToDelete(null)
        }}
        onConfirm={handleDeletePrice}
        title="Delete Price Entry"
        message="Are you sure you want to delete this price entry? This action cannot be undone."
        confirmText="Delete"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
        isLoading={isDeleting}
        loadingText="Deleting..."
      />
    </div>
  )
}