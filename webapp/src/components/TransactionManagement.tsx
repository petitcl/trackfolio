'use client'

import React, { useState } from 'react'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import type { Transaction } from '@/lib/supabase/database.types'
import TransactionHistory from './TransactionHistory'
import AddTransactionForm, { type TransactionFormData } from './AddTransactionForm'
import { portfolioService } from '@/lib/services/portfolio.service'
import BulkTransactionImport from './BulkTransactionImport'

interface TransactionManagementProps {
  user: AuthUser
  symbol: string
  symbolName: string
  transactions: Transaction[]
  onTransactionUpdated?: () => void
}

type ViewMode = 'history' | 'addTransaction' | 'bulkImport'

export default function TransactionManagement({ 
  user, 
  symbol, 
  symbolName, 
  transactions, 
  onTransactionUpdated 
}: TransactionManagementProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('history')
  const [refreshKey, setRefreshKey] = useState(0)
  const [isProcessingTransaction, setIsProcessingTransaction] = useState(false)

  const handleTransactionUpdated = () => {
    // Refresh the transaction data by changing the key
    setRefreshKey(prev => prev + 1)
    // Return to history view after successful update
    if (viewMode !== 'history') {
      setViewMode('history')
    }
    // Notify parent component
    onTransactionUpdated?.()
  }

  const handleAddTransaction = async (transactionData: TransactionFormData) => {
    setIsProcessingTransaction(true)
    try {
      // Add transaction via portfolio service
      const result = await portfolioService.addTransactionForUser(user, {
        symbol: symbol,
        type: transactionData.type,
        quantity: transactionData.quantity,
        pricePerUnit: transactionData.pricePerUnit,
        date: transactionData.date,
        fees: transactionData.fees,
        currency: transactionData.currency,
        broker: transactionData.broker,
        notes: transactionData.notes
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to add transaction')
      }
      
      console.log('✅ Transaction added successfully:', result.transaction?.id)
      handleTransactionUpdated()
    } catch (err) {
      console.error('Error adding transaction:', err)
      // You might want to show an error message to the user here
      throw err
    } finally {
      setIsProcessingTransaction(false)
    }
  }

  const renderActionButtons = () => (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <button
        onClick={() => setViewMode('history')}
        className={`inline-flex items-center px-4 py-2 border rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 ${
          viewMode === 'history'
            ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
        }`}
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        Transaction History
      </button>
      
      <button
        onClick={() => setViewMode('addTransaction')}
        className={`inline-flex items-center px-4 py-2 border rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 ${
          viewMode === 'addTransaction'
            ? 'border-green-600 bg-green-600 text-white hover:bg-green-700'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
        }`}
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Add Transaction
      </button>
      
      <button
        onClick={() => setViewMode('bulkImport')}
        className={`inline-flex items-center px-4 py-2 border rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 ${
          viewMode === 'bulkImport'
            ? 'border-purple-600 bg-purple-600 text-white hover:bg-purple-700'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
        }`}
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        Import CSV
      </button>
    </div>
  )

  const renderContent = () => {
    switch (viewMode) {
      case 'addTransaction':
        return (
          <AddTransactionForm
            isOpen={true}
            onClose={() => setViewMode('history')}
            onSubmit={handleAddTransaction}
            symbol={symbol}
            symbolName={symbolName}
            isLoading={isProcessingTransaction}
            isInline={true}
          />
        )
      
      case 'bulkImport':
        return (
          <BulkTransactionImport
            user={user}
            symbol={symbol}
            onTransactionsImported={handleTransactionUpdated}
            onCancel={() => setViewMode('history')}
          />
        )
      
      case 'history':
      default:
        return (
          <TransactionHistory
            key={refreshKey}
            transactions={transactions}
            symbol={symbol}
          />
        )
    }
  }

  return (
    <div className="space-y-6">
      {renderActionButtons()}
      {renderContent()}
    </div>
  )
}