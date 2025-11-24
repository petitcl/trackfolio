'use client'

import React, { useState } from 'react'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import { portfolioService } from '@/lib/services/portfolio.service'
import NumberInput from './NumberInput'

export interface BalanceFormData {
  balance: number
  date: string
  notes: string
}

interface AddBalanceFormProps {
  user: AuthUser
  symbol: string
  symbolCurrency?: string
  onBalanceAdded?: (balanceData: BalanceFormData) => void
  onCancel?: () => void
  onDelete?: () => void
  editMode?: boolean
  initialData?: BalanceFormData
  isInline?: boolean
  isLoading?: boolean
}

export default function AddBalanceForm({
  user,
  symbol,
  symbolCurrency = 'USD',
  onBalanceAdded,
  onCancel,
  onDelete,
  editMode = false,
  initialData,
  isInline = false,
  isLoading = false
}: AddBalanceFormProps) {
  const [formData, setFormData] = useState({
    balance: initialData?.balance || undefined,
    date: initialData?.date || new Date().toISOString().split('T')[0],
    notes: initialData?.notes || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleBalanceChange = (value: number | undefined) => {
    setFormData(prev => ({
      ...prev,
      balance: value
    }))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (formData.balance === undefined || formData.balance < 0) {
      setError('Please enter a valid balance (can be 0 or positive)')
      return
    }

    if (!formData.date) {
      setError('Please select a date')
      return
    }

    const selectedDate = new Date(formData.date)
    const today = new Date()
    today.setHours(23, 59, 59, 999) // End of today

    if (selectedDate > today) {
      setError('Balance date cannot be in the future')
      return
    }

    try {
      setLoading(true)

      const balanceData: BalanceFormData = {
        balance: formData.balance,
        date: formData.date,
        notes: formData.notes.trim()
      }

      if (editMode) {
        // Call the parent handler for edit mode
        onBalanceAdded?.(balanceData)
      } else {
        // Add new balance for create mode
        await portfolioService.addUserSymbolPrice(user, {
          symbol: symbol,
          manual_price: balanceData.balance,
          price_date: balanceData.date,
          notes: balanceData.notes || null
        })

        // Reset form only in create mode
        setFormData({
          balance: undefined,
          date: new Date().toISOString().split('T')[0],
          notes: ''
        })

        onBalanceAdded?.(balanceData)
      }
    } catch (err) {
      console.error('Error adding balance:', err)
      setError('Failed to add balance. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const formContent = (
    <div className={isInline ? 'bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700' : 'bg-white dark:bg-gray-800 shadow rounded-lg border dark:border-gray-700'}>
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          {editMode ? 'Edit Balance Entry' : 'Add Balance Entry'}
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {editMode ? `Update balance for ${symbol}` : `Add a balance entry for ${symbol}`}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4">
            <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <NumberInput
            label={`Balance (${symbolCurrency})`}
            value={formData.balance}
            onChange={handleBalanceChange}
            required={true}
            decimals={2}
            min={0}
            placeholder="Enter balance"
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes (Optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows={3}
            placeholder="Add any notes about this balance update..."
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div className="flex justify-between">
          <div className="flex space-x-3">
            {editMode && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || isLoading}
              >
                Delete
              </button>
            )}
          </div>

          <div className="flex space-x-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                disabled={loading || isLoading}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading || isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading || isLoading ? 'Saving...' : (editMode ? 'Update Balance' : 'Add Balance')}
            </button>
          </div>
        </div>
      </form>
    </div>
  )

  return formContent
}
