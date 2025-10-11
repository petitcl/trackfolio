'use client'

import React, { useState, useEffect } from 'react'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import type { Symbol } from '@/lib/supabase/types'
import { accountHoldingService } from '@/lib/services/account-holding.service'
import { CURRENCY_SYMBOLS, type SupportedCurrency } from '@/lib/services/currency.service'

interface UpdateBalanceModalProps {
  isOpen: boolean
  user: AuthUser
  symbol: Symbol
  currentBalance: number
  onUpdateComplete?: () => void
  onCancel?: () => void
}

export default function UpdateBalanceModal({
  isOpen,
  user,
  symbol,
  currentBalance,
  onUpdateComplete,
  onCancel
}: UpdateBalanceModalProps) {
  const [newBalance, setNewBalance] = useState('')
  const [balanceDate, setBalanceDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get currency symbol
  const currencySymbol = CURRENCY_SYMBOLS[(symbol.currency as SupportedCurrency) || 'USD']

  // Calculate balance change
  const calculateBalanceChange = (): { amount: number; percentage: number } | null => {
    if (!newBalance || parseFloat(newBalance) <= 0) {
      return null
    }

    try {
      const newBalanceNum = parseFloat(newBalance)
      const change = newBalanceNum - currentBalance
      const percentage = currentBalance > 0 ? (change / currentBalance) * 100 : 0
      return { amount: change, percentage }
    } catch {
      return null
    }
  }

  const balanceChangeInfo = calculateBalanceChange()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!newBalance || parseFloat(newBalance) <= 0) {
      setError('Please enter a valid account balance')
      return
    }

    if (!balanceDate) {
      setError('Please select a date')
      return
    }

    setIsSubmitting(true)

    try {
      await accountHoldingService.updateAccountBalance(user, {
        symbol: symbol.symbol,
        newBalance: parseFloat(newBalance),
        date: balanceDate,
        notes: notes || undefined
      })

      onUpdateComplete?.()
    } catch (err) {
      console.error('Error updating account balance:', err)
      setError(err instanceof Error ? err.message : 'Failed to update account balance')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Update Account Balance
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {symbol.name} ({symbol.symbol})
        </p>
      </div>

      {/* Content */}
      <form onSubmit={handleSubmit} className="p-6">
        {/* Current Balance Info */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Current Account Balance
          </h3>
          <div className="text-sm">
            <p className="text-gray-900 dark:text-white font-semibold text-lg">
              {currencySymbol}{currentBalance.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </p>
          </div>
        </div>

        {/* New Balance Input */}
        <div className="mb-4">
          <label htmlFor="newBalance" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            New Account Balance *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
              {currencySymbol}
            </span>
            <input
              type="number"
              id="newBalance"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              step="0.01"
              min="0"
              className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter current account balance"
              required
            />
          </div>
        </div>

        {/* Date Input */}
        <div className="mb-4">
          <label htmlFor="balanceDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Balance Date *
          </label>
          <input
            type="date"
            id="balanceDate"
            value={balanceDate}
            onChange={(e) => setBalanceDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            required
          />
        </div>

        {/* Notes Input */}
        <div className="mb-6">
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notes (Optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="Add any notes about this balance update..."
          />
        </div>

        {/* Preview Section */}
        {balanceChangeInfo && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-3">
              Balance Change
            </h3>
            <div className="text-sm">
              <p className={`font-medium ${
                balanceChangeInfo.amount >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {balanceChangeInfo.amount >= 0 ? '+' : ''}
                {currencySymbol}{balanceChangeInfo.amount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
                {' '}
                ({balanceChangeInfo.amount >= 0 ? '+' : ''}
                {balanceChangeInfo.percentage.toFixed(2)}%)
              </p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting || !newBalance || parseFloat(newBalance) <= 0}
          >
            {isSubmitting ? 'Updating...' : 'Update Balance'}
          </button>
        </div>
      </form>
      </div>
    </div>
  )
}
