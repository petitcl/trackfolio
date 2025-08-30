'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { clientAuthService, type AuthUser } from '@/lib/auth/client.auth.service'
import { portfolioService } from '@/lib/services/portfolio.service'
import type { Transaction, Symbol } from '@/lib/supabase/database.types'
import AddTransactionForm, { type TransactionFormData } from './AddTransactionForm'
import DemoModeBanner from './DemoModeBanner'
import ConfirmDialog from './ConfirmDialog'

interface EditTransactionClientProps {
  transactionId: string
}

export default function EditTransactionClient({ transactionId }: EditTransactionClientProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [symbol, setSymbol] = useState<Symbol | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        
        // Get authenticated user
        const authUser = await clientAuthService.getUser()
        if (!authUser) {
          router.push('/login')
          return
        }
        setUser(authUser)

        // Get all transactions and find the specific one
        const transactions = await portfolioService.getTransactions(authUser)
        const targetTransaction = transactions.find(t => t.id === transactionId)
        
        if (!targetTransaction) {
          setError(`Transaction not found: ${transactionId}`)
          return
        }
        setTransaction(targetTransaction)

        // Get symbol data
        const symbols = await portfolioService.getSymbols(authUser)
        const symbolData = symbols.find(s => s.symbol === targetTransaction.symbol)
        setSymbol(symbolData || null)

        console.log('✅ Loaded transaction for editing:', targetTransaction.id)
      } catch (err) {
        console.error('Error loading transaction data:', err)
        setError('Failed to load transaction data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [transactionId, router])

  const handleUpdate = async (formData: TransactionFormData) => {
    if (!user || !transaction) return
    
    setIsUpdating(true)
    try {
      const result = await portfolioService.updateTransactionForUser(user, transactionId, {
        type: formData.type,
        quantity: formData.quantity,
        pricePerUnit: formData.pricePerUnit,
        date: formData.date,
        fees: formData.fees,
        currency: formData.currency,
        broker: formData.broker,
        notes: formData.notes
      })
      
      if (!result.success) {
        setError(result.error || 'Failed to update transaction')
        return
      }
      
      console.log('✅ Transaction updated successfully')
      router.push(`/holdings/${transaction.symbol}`)
    } catch (err) {
      console.error('Error updating transaction:', err)
      setError('Failed to update transaction')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    if (!user || !transaction) return
    
    setIsDeleting(true)
    try {
      const result = await portfolioService.deleteTransactionForUser(user, transactionId)
      
      if (!result.success) {
        setError(result.error || 'Failed to delete transaction')
        setIsDeleting(false)
        return
      }
      
      console.log('✅ Transaction deleted successfully')
      setShowDeleteConfirm(false)
      router.push(`/holdings/${transaction.symbol}`)
    } catch (err) {
      console.error('Error deleting transaction:', err)
      setError('Failed to delete transaction')
      setIsDeleting(false)
    }
  }

  const handleClose = () => {
    if (transaction) {
      router.push(`/holdings/${transaction.symbol}`)
    } else {
      router.push('/')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading transaction...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Link 
            href="/" 
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (!transaction || !user) {
    return null
  }

  // Convert transaction to form data
  const initialFormData: TransactionFormData = {
    type: transaction.type,
    quantity: transaction.quantity,
    pricePerUnit: transaction.price_per_unit,
    date: transaction.date,
    fees: transaction.fees,
    currency: transaction.currency,
    broker: transaction.broker || '',
    notes: transaction.notes || '',
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <DemoModeBanner />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            onClick={handleClose}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ← Back to {transaction.symbol} Details
          </button>
        </div>

        <AddTransactionForm
          isOpen={true}
          onClose={handleClose}
          onSubmit={handleUpdate}
          onDelete={handleDeleteClick}
          symbol={transaction.symbol}
          symbolName={symbol?.name || transaction.symbol}
          isLoading={isUpdating}
          editMode={true}
          initialData={initialFormData}
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteConfirm}
          title="Delete Transaction"
          message={`Are you sure you want to delete this ${transaction.type} transaction of ${transaction.quantity} ${transaction.symbol} on ${new Date(transaction.date).toLocaleDateString()}? This action cannot be undone.`}
          confirmText="Delete Transaction"
          confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
          isLoading={isDeleting}
          loadingText="Deleting..."
        />
      </div>
    </div>
  )
}