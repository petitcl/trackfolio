'use client'

import React, { useState } from 'react'
import type { Transaction } from '@/lib/supabase/types'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import AddTransactionForm, { type TransactionFormData } from './AddTransactionForm'
import { portfolioService } from '@/lib/services/portfolio.service'
import ConfirmDialog from './ConfirmDialog'
import { currencyService, type SupportedCurrency } from '@/lib/services/currency.service'

interface TransactionHistoryProps {
  transactions: Transaction[]
  symbol: string
  symbolName: string
  user: AuthUser
  onTransactionUpdated?: () => void
  selectedCurrency?: SupportedCurrency
}

export default function TransactionHistory({ transactions, symbol, symbolName, user, onTransactionUpdated, selectedCurrency = 'USD' }: TransactionHistoryProps) {
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleEditTransaction = async (transactionData: TransactionFormData) => {
    if (!editingTransactionId) return
    
    setIsUpdating(true)
    try {
      await portfolioService.updateTransaction(user, editingTransactionId, {
        ...transactionData,
        symbol
      })
      setEditingTransactionId(null)
      onTransactionUpdated?.()
    } catch (err) {
      console.error('Error updating transaction:', err)
      alert('Failed to update transaction')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteTransaction = async () => {
    if (!transactionToDelete) return
    
    setIsDeleting(true)
    try {
      await portfolioService.deleteTransaction(user, transactionToDelete)
      setShowDeleteConfirm(false)
      setTransactionToDelete(null)
      onTransactionUpdated?.()
    } catch (err) {
      console.error('Error deleting transaction:', err)
      alert('Failed to delete transaction')
    } finally {
      setIsDeleting(false)
    }
  }

  const initiateDeleteTransaction = (transactionId: string) => {
    setTransactionToDelete(transactionId)
    setShowDeleteConfirm(true)
  }

  const getEditFormData = (transaction: Transaction): TransactionFormData => {
    return {
      type: transaction.type,
      quantity: transaction.quantity,
      pricePerUnit: transaction.price_per_unit,
      date: transaction.date,
      fees: transaction.fees || 0,
      broker: transaction.broker || '',
      currency: transaction.currency || 'USD',
      notes: transaction.notes || ''
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

  const getTransactionTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      buy: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
      sell: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
      dividend: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
      bonus: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20',
      deposit: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20',
      withdrawal: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20'
    }
    return colors[type] || 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20'
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border dark:border-gray-700">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Transaction History</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            All transactions for {symbol}
          </p>
        </div>
        <div className="p-6 text-center">
          <div className="text-gray-500 dark:text-gray-400">
            <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No transactions</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by adding a transaction for this holding.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md border dark:border-gray-700">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Transaction History</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
          All transactions for {symbol}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quantity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fees</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {transactions.map((transaction) => {
              const total = transaction.quantity * transaction.price_per_unit + (transaction.fees || 0)
              const isEditing = editingTransactionId === transaction.id
              
              if (isEditing) {
                return (
                  <React.Fragment key={transaction.id}>
                    <tr>
                      <td colSpan={8} className="px-0 py-0">
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-l-4 border-blue-500">
                          <AddTransactionForm
                            isOpen={true}
                            onClose={() => setEditingTransactionId(null)}
                            onSubmit={handleEditTransaction}
                            onDelete={() => initiateDeleteTransaction(transaction.id)}
                            symbol={symbol}
                            symbolName={symbolName}
                            isLoading={isUpdating}
                            editMode={true}
                            initialData={getEditFormData(transaction)}
                            isInline={true}
                          />
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                )
              }
              
              return (
                <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                    {formatDate(transaction.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTransactionTypeColor(transaction.type)}`}>
                      {transaction.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                    {transaction.quantity.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                    {formatCurrency(transaction.price_per_unit)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                    {formatCurrency(transaction.fees || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {formatCurrency(total)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {transaction.notes || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <button
                      onClick={() => setEditingTransactionId(transaction.id)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                      title="Edit transaction"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => initiateDeleteTransaction(transaction.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
                      title="Delete transaction"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false)
          setTransactionToDelete(null)
        }}
        onConfirm={handleDeleteTransaction}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? This action cannot be undone."
        confirmText="Delete"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
        isLoading={isDeleting}
        loadingText="Deleting..."
      />
    </div>
  )
}