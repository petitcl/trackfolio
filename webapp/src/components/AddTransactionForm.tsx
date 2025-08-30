'use client'

/**
 * AddTransactionForm - A reusable component for adding transactions
 * 
 * Features:
 * - Manual transaction entry with all required fields
 * - CSV import functionality (UI ready, logic to be implemented)
 * - Fully responsive design with dark mode support
 * - Form validation and error handling
 * - Reusable across different contexts (holding details, add holding flow, etc.)
 * 
 * Usage:
 * ```tsx
 * <AddTransactionForm
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   onSubmit={handleSubmit}
 *   symbol="AAPL"
 *   symbolName="Apple Inc."
 *   isLoading={false}
 * />
 * ```
 */

import React, { useState } from 'react'
import Papa from 'papaparse'
import type { TransactionType } from '@/lib/supabase/database.types'

interface AddTransactionFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (transactionData: TransactionFormData) => void
  onDelete?: () => void
  symbol: string
  symbolName: string
  isLoading?: boolean
  editMode?: boolean
  initialData?: TransactionFormData
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
}

interface CsvTransactionRow {
  date: string
  symbol: string
  type: string
  quantity: string
  price_per_unit: string
  fees?: string
  currency?: string
  broker?: string
  notes?: string
}

interface ParsedCsvTransaction {
  date: string
  symbol: string
  type: TransactionType
  quantity: number
  pricePerUnit: number
  fees: number
  currency: string
  broker: string | null
  notes: string | null
}

interface CsvValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  transactions: ParsedCsvTransaction[]
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
  isLoading = false,
  editMode = false,
  initialData,
}: AddTransactionFormProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'csv'>('manual')
  const [formData, setFormData] = useState<TransactionFormData>(
    initialData || {
      type: 'buy',
      quantity: 0,
      pricePerUnit: 0,
      date: new Date().toISOString().split('T')[0],
      fees: 0,
      broker: '',
      currency: 'USD',
      notes: '',
    }
  )
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvValidationResult, setCsvValidationResult] = useState<CsvValidationResult | null>(null)
  const [isProcessingCsv, setIsProcessingCsv] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const handleInputChange = (
    field: keyof TransactionFormData,
    value: string | number
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  const validateCsvRow = (row: CsvTransactionRow, rowIndex: number): { isValid: boolean; errors: string[]; warnings: string[] } => {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Check required fields
    if (!row.date) errors.push(`Row ${rowIndex + 1}: Missing date`)
    if (!row.symbol) errors.push(`Row ${rowIndex + 1}: Missing symbol`)
    if (!row.type) errors.push(`Row ${rowIndex + 1}: Missing transaction type`)
    if (!row.quantity) errors.push(`Row ${rowIndex + 1}: Missing quantity`)
    if (!row.price_per_unit) errors.push(`Row ${rowIndex + 1}: Missing price per unit`)
    
    // Validate symbol matches
    if (row.symbol && row.symbol.toUpperCase() !== symbol.toUpperCase()) {
      errors.push(`Row ${rowIndex + 1}: Symbol '${row.symbol}' does not match expected '${symbol}'`)
    }
    
    // Validate transaction type
    const validTypes = ['buy', 'sell', 'dividend', 'bonus', 'deposit', 'withdrawal']
    if (row.type && !validTypes.includes(row.type.toLowerCase())) {
      errors.push(`Row ${rowIndex + 1}: Invalid transaction type '${row.type}'. Must be one of: ${validTypes.join(', ')}`)
    }
    
    // Validate numeric fields
    if (row.quantity && isNaN(parseFloat(row.quantity))) {
      errors.push(`Row ${rowIndex + 1}: Quantity must be a number`)
    }
    if (row.price_per_unit && isNaN(parseFloat(row.price_per_unit))) {
      errors.push(`Row ${rowIndex + 1}: Price per unit must be a number`)
    }
    if (row.fees && row.fees !== '' && isNaN(parseFloat(row.fees))) {
      errors.push(`Row ${rowIndex + 1}: Fees must be a number`)
    }
    
    // Validate date format
    if (row.date && isNaN(Date.parse(row.date))) {
      errors.push(`Row ${rowIndex + 1}: Invalid date format. Use YYYY-MM-DD`)
    }
    
    // Warnings for missing optional fields
    if (!row.currency) warnings.push(`Row ${rowIndex + 1}: No currency specified, will default to USD`)
    if (!row.fees) warnings.push(`Row ${rowIndex + 1}: No fees specified, will default to 0`)
    
    return { isValid: errors.length === 0, errors, warnings }
  }

  const parseCsvRow = (row: CsvTransactionRow): ParsedCsvTransaction => {
    return {
      date: row.date,
      symbol: row.symbol.toUpperCase(),
      type: row.type.toLowerCase() as TransactionType,
      quantity: parseFloat(row.quantity),
      pricePerUnit: parseFloat(row.price_per_unit),
      fees: row.fees ? parseFloat(row.fees) : 0,
      currency: row.currency || 'USD',
      broker: row.broker || null,
      notes: row.notes || null
    }
  }

  const handleFileSelection = (file: File) => {
    // Check if it's a CSV file by extension or MIME type
    const isValidCsv = file.type === 'text/csv' || 
                       file.type === 'application/csv' || 
                       file.type === 'text/plain' ||
                       file.name.toLowerCase().endsWith('.csv')
    
    if (file && isValidCsv) {
      setCsvFile(file)
      setCsvValidationResult(null)
      parseCsvFile(file)
    } else {
      setCsvValidationResult({
        isValid: false,
        errors: [`Invalid file type. Please select a CSV file. (Selected: ${file.name})`],
        warnings: [],
        transactions: []
      })
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelection(file)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelection(files[0])
    }
  }

  const parseCsvFile = (file: File) => {
    setIsProcessingCsv(true)
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as CsvTransactionRow[]
        const errors: string[] = []
        const warnings: string[] = []
        const transactions: ParsedCsvTransaction[] = []
        
        // Check if required columns exist
        if (results.meta.fields) {
          const requiredFields = ['date', 'symbol', 'type', 'quantity', 'price_per_unit']
          const missingFields = requiredFields.filter(field => !results.meta.fields!.includes(field))
          
          if (missingFields.length > 0) {
            errors.push(`Missing required columns: ${missingFields.join(', ')}`)
          }
        }
        
        // Validate each row if headers are correct
        if (errors.length === 0) {
          rows.forEach((row, index) => {
            const validation = validateCsvRow(row, index)
            errors.push(...validation.errors)
            warnings.push(...validation.warnings)
            
            if (validation.isValid) {
              transactions.push(parseCsvRow(row))
            }
          })
        }
        
        setCsvValidationResult({
          isValid: errors.length === 0,
          errors,
          warnings,
          transactions
        })
        setIsProcessingCsv(false)
      },
      error: (error) => {
        setCsvValidationResult({
          isValid: false,
          errors: [`Failed to parse CSV: ${error.message}`],
          warnings: [],
          transactions: []
        })
        setIsProcessingCsv(false)
      }
    })
  }

  const processCsvFile = async () => {
    if (!csvValidationResult?.isValid || csvValidationResult.transactions.length === 0) return
    
    setIsProcessingCsv(true)
    
    try {
      let successCount = 0
      let failureCount = 0
      const errors: string[] = []
      
      // Process transactions one by one
      for (const transaction of csvValidationResult.transactions) {
        try {
          const formData: TransactionFormData = {
            type: transaction.type,
            quantity: transaction.quantity,
            pricePerUnit: transaction.pricePerUnit,
            date: transaction.date,
            fees: transaction.fees,
            currency: transaction.currency,
            broker: transaction.broker || undefined,
            notes: transaction.notes || undefined
          }
          
          await onSubmit(formData)
          successCount++
        } catch (error) {
          failureCount++
          errors.push(`Failed to import transaction on ${transaction.date}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
      
      console.log(`📊 CSV Import completed: ${successCount} successful, ${failureCount} failed`)
      
      if (failureCount === 0) {
        // All transactions imported successfully
        onClose()
      } else {
        // Some failed, show errors
        setCsvValidationResult({
          ...csvValidationResult,
          isValid: false,
          errors: [...csvValidationResult.errors, ...errors]
        })
      }
    } catch (error) {
      console.error('Error processing CSV:', error)
      setCsvValidationResult({
        ...csvValidationResult!,
        isValid: false,
        errors: [...csvValidationResult!.errors, 'Unexpected error during import']
      })
    } finally {
      setIsProcessingCsv(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {editMode ? 'Edit Transaction' : 'Add Transaction'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {editMode ? 'Edit transaction for' : 'Add a new transaction for'} {symbol} - {symbolName}
              </p>
            </div>
            <button
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

        {/* Tab Navigation - Hidden in edit mode */}
        {!editMode && (
          <div className="px-6 pt-4">
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('manual')
                  setCsvFile(null)
                  setCsvValidationResult(null)
                }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'manual'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Manual Entry
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('csv')
                }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'csv'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                CSV Import
              </button>
            </div>
          </div>
        )}

        {/* Form Content */}
        <div className="px-6 py-4">
          {(activeTab === 'manual' || editMode) ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Transaction Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Transaction Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {TRANSACTION_TYPES.map((type) => (
                    <label
                      key={type.value}
                      className={`relative flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        formData.type === type.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="transactionType"
                        value={type.value}
                        checked={formData.type === type.value}
                        onChange={(e) => handleInputChange('type', e.target.value as TransactionType)}
                        className="sr-only"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {type.label}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {type.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', parseFloat(e.target.value) || 0)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                  />
                </div>

                {/* Price per Unit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Price per Unit
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.pricePerUnit}
                    onChange={(e) => handleInputChange('pricePerUnit', parseFloat(e.target.value) || 0)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Fees */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Fees
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.fees}
                    onChange={(e) => handleInputChange('fees', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Broker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Broker (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.broker}
                    onChange={(e) => handleInputChange('broker', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Interactive Brokers"
                  />
                </div>

                {/* Currency */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => handleInputChange('currency', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                    <option value="CAD">CAD</option>
                    <option value="AUD">AUD</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Additional information about this transaction..."
                />
              </div>

              {/* Total Calculation */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Total ({formData.quantity} × ${formData.pricePerUnit} + ${formData.fees} fees):
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ${((formData.quantity * formData.pricePerUnit) + formData.fees).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (editMode ? 'Updating...' : 'Adding...') : (editMode ? 'Update Transaction' : 'Add Transaction')}
                </button>
                {editMode && onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    disabled={isLoading}
                    className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Deleting...' : '🗑️ Delete'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            // CSV Import Tab
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Import Transactions from CSV
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Upload a CSV file with your transaction data. The file should include columns for date, type, quantity, price, fees, and notes.
                </p>
              </div>

              {/* CSV Format Guide */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h5 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                  Expected CSV Format:
                </h5>
                <div className="text-xs font-mono text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 p-2 rounded">
                  date,symbol,type,quantity,price_per_unit,fees,currency,broker,notes<br />
                  2024-01-15,{symbol},buy,100,150.50,9.99,USD,Interactive Brokers,Initial position<br />
                  2024-02-15,{symbol},dividend,0,2.50,0,USD,,Quarterly dividend
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                  <strong>Important:</strong> The &lsquo;symbol&rsquo; column must match exactly: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">{symbol}</code>
                </p>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select CSV File
                </label>
                <div 
                  className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors ${
                    isDragOver 
                      ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="space-y-1 text-center">
                    <svg
                      className={`mx-auto h-12 w-12 ${
                        isDragOver ? 'text-blue-500' : 'text-gray-400'
                      }`}
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className={`flex text-sm ${
                      isDragOver 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      <label
                        htmlFor="file-upload"
                        className={`relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500 ${
                          isDragOver 
                            ? 'text-blue-600 dark:text-blue-400' 
                            : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        <span>{isDragOver ? 'Drop CSV file here' : 'Upload a file'}</span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          accept=".csv"
                          onChange={handleFileUpload}
                          className="sr-only"
                        />
                      </label>
                      {!isDragOver && <p className="pl-1">or drag and drop</p>}
                    </div>
                    <p className={`text-xs ${
                      isDragOver 
                        ? 'text-blue-500 dark:text-blue-400' 
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      CSV files up to 10MB
                    </p>
                  </div>
                </div>
                
                {csvFile && (
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Selected file: <span className="font-medium">{csvFile.name}</span>
                  </div>
                )}
              </div>

              {/* CSV Processing Status */}
              {isProcessingCsv && (
                <div className="border border-blue-200 dark:border-blue-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
                  <div className="flex items-center">
                    <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full mr-3"></div>
                    <span className="text-blue-800 dark:text-blue-200">Processing CSV file...</span>
                  </div>
                </div>
              )}

              {/* CSV Validation Results */}
              {csvValidationResult && (
                <div className={`border rounded-lg p-4 ${
                  csvValidationResult.isValid 
                    ? 'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                    : 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                }`}>
                  <h5 className={`text-sm font-medium mb-2 ${
                    csvValidationResult.isValid 
                      ? 'text-green-800 dark:text-green-200'
                      : 'text-red-800 dark:text-red-200'
                  }`}>
                    {csvValidationResult.isValid ? '✅ CSV Valid' : '❌ CSV Invalid'}
                  </h5>

                  {/* Errors */}
                  {csvValidationResult.errors.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">Errors:</p>
                      <ul className="text-xs text-red-600 dark:text-red-400 space-y-1">
                        {csvValidationResult.errors.map((error, index) => (
                          <li key={index} className="list-disc list-inside">{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Warnings */}
                  {csvValidationResult.warnings.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-1">Warnings:</p>
                      <ul className="text-xs text-yellow-600 dark:text-yellow-400 space-y-1">
                        {csvValidationResult.warnings.map((warning, index) => (
                          <li key={index} className="list-disc list-inside">{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Transaction Preview */}
                  {csvValidationResult.isValid && csvValidationResult.transactions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-2">
                        Found {csvValidationResult.transactions.length} valid transaction(s):
                      </p>
                      <div className="max-h-40 overflow-y-auto border border-green-300 dark:border-green-600 rounded">
                        <table className="w-full text-xs">
                          <thead className="bg-green-100 dark:bg-green-800">
                            <tr>
                              <th className="px-2 py-1 text-left">Date</th>
                              <th className="px-2 py-1 text-left">Type</th>
                              <th className="px-2 py-1 text-left">Qty</th>
                              <th className="px-2 py-1 text-left">Price</th>
                              <th className="px-2 py-1 text-left">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {csvValidationResult.transactions.map((tx, index) => (
                              <tr key={index} className="border-t border-green-200 dark:border-green-700">
                                <td className="px-2 py-1">{tx.date}</td>
                                <td className="px-2 py-1">
                                  <span className="capitalize">{tx.type}</span>
                                </td>
                                <td className="px-2 py-1">{tx.quantity}</td>
                                <td className="px-2 py-1">${tx.pricePerUnit}</td>
                                <td className="px-2 py-1">
                                  ${((tx.quantity * tx.pricePerUnit) + tx.fees).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CSV Actions */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={processCsvFile}
                  disabled={!csvValidationResult?.isValid || isLoading || isProcessingCsv}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessingCsv ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      Processing...
                    </span>
                  ) : (
                    `Import ${csvValidationResult?.transactions.length || 0} Transactions`
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessingCsv}
                  className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}