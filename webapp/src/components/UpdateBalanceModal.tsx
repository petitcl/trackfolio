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
  currentQuantity: number
  currentPricePerUnit: number
  onUpdateComplete?: () => void
  onCancel?: () => void
}

export default function UpdateBalanceModal({
  isOpen,
  user,
  symbol,
  currentQuantity,
  currentPricePerUnit,
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

  // Calculate current value
  const currentValue = currentQuantity * currentPricePerUnit

  // Calculate new price per unit preview
  const calculateNewPricePerUnit = (): number | null => {
    if (!newBalance || parseFloat(newBalance) <= 0) {
      return null
    }

    try {
      return accountHoldingService.calculateNewPricePerUnit(
        parseFloat(newBalance),
        currentQuantity
      )
    } catch {
      return null
    }
  }

  const newPricePerUnit = calculateNewPricePerUnit()
  const balanceChange = newBalance ? parseFloat(newBalance) - currentValue : 0

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

    if (currentQuantity <= 0) {
      setError('Cannot update balance: current quantity is zero')
      return
    }

    setIsSubmitting(true)

    try {
      await accountHoldingService.updateAccountBalance(user, {
        symbol: symbol.symbol,
        currentQuantity: currentQuantity,
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
        {/* Current Holdings Info */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Current Holdings
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600 dark:text-gray-400">Quantity (Units)</p>
              <p className="text-gray-900 dark:text-white font-medium">
                {currentQuantity.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Price per Unit</p>
              <p className="text-gray-900 dark:text-white font-medium">
                {currencySymbol}{currentPricePerUnit.toLocaleString(undefined, {
                  minimumFractionDigits: 4,
                  maximumFractionDigits: 4
                })}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-600 dark:text-gray-400">Current Value</p>
              <p className="text-gray-900 dark:text-white font-semibold text-lg">
                {currencySymbol}{currentValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </p>
            </div>
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
        {newPricePerUnit !== null && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-3">
              Preview
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-blue-700 dark:text-blue-400">New Price per Unit</p>
                <p className="text-blue-900 dark:text-blue-200 font-medium">
                  {currencySymbol}{newPricePerUnit.toLocaleString(undefined, {
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 4
                  })}
                </p>
              </div>
              <div>
                <p className="text-blue-700 dark:text-blue-400">Balance Change</p>
                <p className={`font-medium ${
                  balanceChange >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {balanceChange >= 0 ? '+' : ''}
                  {currencySymbol}{balanceChange.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                  {' '}
                  ({balanceChange >= 0 ? '+' : ''}
                  {((balanceChange / currentValue) * 100).toFixed(2)}%)
                </p>
              </div>
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
