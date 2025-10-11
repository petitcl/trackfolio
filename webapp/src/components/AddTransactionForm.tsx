'use client'

import React, { useState } from 'react'
import type { TransactionType } from '@/lib/supabase/types'
import BrokerSelect from './BrokerSelect'

interface AddTransactionFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (transactionData: TransactionFormData) => void
  onDelete?: () => void
  symbol: string
  symbolName: string
  symbolCurrency?: string
  isLoading?: boolean
  editMode?: boolean
  initialData?: TransactionFormData
  isInline?: boolean
  isAccountHolding?: boolean
}

export interface TransactionFormData {
  type: TransactionType
  quantity: number
  pricePerUnit: number
  date: string
  fees: number
  broker?: string
  currency: string
  notes?: string
  amount?: number // For bonus transactions
}

const TRANSACTION_TYPES: { value: TransactionType; label: string; description: string }[] = [
  { value: 'buy', label: 'Buy', description: 'Purchase shares/units' },
  { value: 'sell', label: 'Sell', description: 'Sell shares/units' },
  { value: 'dividend', label: 'Dividend', description: 'Dividend payment received' },
  { value: 'bonus', label: 'Bonus', description: 'Bonus shares received' },
  { value: 'deposit', label: 'Deposit', description: 'Cash deposit' },
  { value: 'withdrawal', label: 'Withdrawal', description: 'Cash withdrawal' },
]

export default function AddTransactionForm({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  symbol,
  symbolName,
  symbolCurrency = 'USD',
  isLoading = false,
  editMode = false,
  initialData,
  isInline = false,
  isAccountHolding = false,
}: AddTransactionFormProps) {
  const [formData, setFormData] = useState<TransactionFormData>(
    initialData || {
      type: 'buy',
      quantity: 0,
      pricePerUnit: 0,
      date: new Date().toISOString().split('T')[0],
      fees: 0,
      broker: '',
      currency: symbolCurrency,
      notes: '',
      amount: undefined,
    }
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // For bonus transactions with amount field, calculate price_per_unit
    const submitData = { ...formData }
    if (formData.type === 'bonus' && formData.amount && formData.quantity > 0) {
      submitData.pricePerUnit = formData.amount / formData.quantity
    }

    // For account holdings deposit/withdrawal, quantity = amount (simplified model)
    if (isAccountHolding && (formData.type === 'deposit' || formData.type === 'withdrawal')) {
      if (formData.amount && formData.amount > 0) {
        submitData.quantity = formData.amount
        submitData.pricePerUnit = 1
      }
    }

    onSubmit(submitData)
  }

  const handleChange = (field: keyof TransactionFormData, value: string | number | undefined) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }

      // When changing to bonus type, set price and amount to 0
      if (field === 'type' && value === 'bonus') {
        updated.pricePerUnit = 0
        updated.amount = 0
      }

      // When changing to dividend type, set quantity and price to 0
      if (field === 'type' && value === 'dividend') {
        updated.quantity = 0
        updated.pricePerUnit = 0
      }

      // When changing to deposit/withdrawal type for account holdings
      if (isAccountHolding && field === 'type' && (value === 'deposit' || value === 'withdrawal')) {
        updated.quantity = 0
        updated.pricePerUnit = 1
        updated.amount = 0
      }

      return updated
    })
  }

  if (!isOpen) return null

  // Filter transaction types based on whether it's an account holding
  const availableTransactionTypes = isAccountHolding
    ? TRANSACTION_TYPES.filter(t => ['deposit', 'withdrawal', 'dividend'].includes(t.value))
    : TRANSACTION_TYPES.filter(t => !['deposit', 'withdrawal'].includes(t.value))

  const formContent = (
    <div className={isInline ? 'bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700' : 'bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto'}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {editMode ? 'Edit Transaction' : 'Add Transaction'}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {editMode ? `Update transaction for ${symbolName}` : `Add a new transaction for ${symbolName}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <span className="sr-only">Close</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Form Content */}
      <div className="px-6 py-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transaction Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Transaction Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value as TransactionType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              required
            >
              {availableTransactionTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label} - {type.description}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity, Price per Unit, and Amount */}
          {isAccountHolding && (formData.type === 'deposit' || formData.type === 'withdrawal') ? (
            /* For account holdings deposit/withdrawal: Show only Amount field */
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {formData.type === 'deposit' ? 'Deposit Amount' : 'Withdrawal Amount'} *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount === 0 ? '0' : (formData.amount || '')}
                  onChange={(e) => handleChange('amount', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                  className="w-full pl-4 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  min="0"
                  required
                  placeholder="Enter amount"
                />
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Enter the {formData.type === 'deposit' ? 'deposit' : 'withdrawal'} amount in {symbolCurrency}
              </p>
            </div>
          ) : (
            /* Standard fields for other transaction types */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  step="0.00001"
                  value={formData.quantity === 0 ? '0' : (formData.quantity || '')}
                  onChange={(e) => handleChange('quantity', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                  className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${(formData.type === 'dividend') ? 'disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed' : ''}`}
                  required={formData.type !== 'dividend'}
                  min="0"
                  disabled={formData.type === 'bonus' || formData.type === 'dividend'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Price per Unit
                </label>
                <input
                  type="number"
                  step="0.00001"
                  value={formData.pricePerUnit === 0 ? '0' : (formData.pricePerUnit || '')}
                  onChange={(e) => handleChange('pricePerUnit', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                  className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${(formData.type === 'bonus' || formData.type === 'dividend') ? 'disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed' : ''}`}
                  required={formData.type !== 'bonus' && formData.type !== 'dividend' || (!formData.amount || formData.amount <= 0)}
                  min="0"
                  disabled={formData.type === 'bonus' || formData.type === 'dividend'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.00001"
                  value={formData.amount === 0 ? '0' : (formData.amount || '')}
                  onChange={(e) => handleChange('amount', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                  className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${formData.type === 'bonus' ? 'disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed' : ''}`}
                  min="0"
                  disabled={formData.type === 'bonus'}
                />
              </div>
            </div>
          )}

          {/* Date and Fees */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Fees
              </label>
              <input
                type="number"
                step="0.00001"
                value={formData.fees === 0 ? '0' : (formData.fees || '')}
                onChange={(e) => handleChange('fees', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                min="0"
              />
            </div>
          </div>

          {/* Currency and Broker */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                disabled={true}
                title="Currency is set based on the holding's currency"
              >
                <option value={symbolCurrency}>{symbolCurrency}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Broker
              </label>
              <BrokerSelect
                value={formData.broker || ''}
                onChange={(value) => handleChange('broker', value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes
            </label>
            <textarea
              rows={3}
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Optional notes about this transaction"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4">
            <div className="flex space-x-3">
              {editMode && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  Delete
                </button>
              )}
            </div>
            
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : (editMode ? 'Update Transaction' : 'Add Transaction')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )

  return isInline ? formContent : (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      {formContent}
    </div>
  )
}