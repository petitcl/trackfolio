'use client'

import React, { useState } from 'react'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import { portfolioService } from '@/lib/services/portfolio.service'

export interface PriceFormData {
  price: number
  date: string
  notes: string
}

interface AddPriceFormProps {
  user: AuthUser
  symbol: string
  onPriceAdded?: (priceData: PriceFormData) => void
  onCancel?: () => void
  onDelete?: () => void
  editMode?: boolean
  initialData?: PriceFormData
  isInline?: boolean
  isLoading?: boolean
}

export default function AddPriceForm({ 
  user, 
  symbol, 
  onPriceAdded, 
  onCancel, 
  onDelete,
  editMode = false,
  initialData,
  isInline = false,
  isLoading = false
}: AddPriceFormProps) {
  const [formData, setFormData] = useState({
    price: initialData?.price?.toString() || '',
    date: initialData?.date || new Date().toISOString().split('T')[0],
    notes: initialData?.notes || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    if (!formData.price || parseFloat(formData.price) <= 0) {
      setError('Please enter a valid price greater than 0')
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
      setError('Price date cannot be in the future')
      return
    }

    try {
      setLoading(true)
      
      const priceData: PriceFormData = {
        price: parseFloat(formData.price),
        date: formData.date,
        notes: formData.notes.trim()
      }

      if (editMode) {
        // Call the parent handler for edit mode
        onPriceAdded?.(priceData)
      } else {
        // Add new price for create mode
        await portfolioService.addUserSymbolPrice(user, {
          symbol: symbol,
          manual_price: priceData.price,
          price_date: priceData.date,
          notes: priceData.notes || null
        })

        // Reset form only in create mode
        setFormData({
          price: '',
          date: new Date().toISOString().split('T')[0],
          notes: ''
        })
        
        onPriceAdded?.(priceData)
      }
    } catch (err) {
      console.error('Error adding price:', err)
      setError('Failed to add price. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const formContent = (
    <div className={isInline ? 'bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700' : 'bg-white dark:bg-gray-800 shadow rounded-lg border dark:border-gray-700'}>
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          {editMode ? 'Edit Price Entry' : 'Add Price Entry'}
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {editMode ? `Update price for ${symbol}` : `Add a manual price for ${symbol}`}
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

          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Price (USD) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleInputChange}
              step="0.01"
              min="0.01"
              placeholder="Enter price"
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>
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
            placeholder="Add any notes about this price update..."
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
              {loading || isLoading ? 'Saving...' : (editMode ? 'Update Price' : 'Add Price')}
            </button>
          </div>
        </div>
      </form>
    </div>
  )

  return formContent
}