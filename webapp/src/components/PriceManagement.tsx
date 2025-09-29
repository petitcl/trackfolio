'use client'

import React, { useState } from 'react'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import ManualPriceHistory from './ManualPriceHistory'
import AddPriceForm from './AddPriceForm'
import BulkPriceImport from './BulkPriceImport'
import type { SupportedCurrency } from '@/lib/services/currency.service'

interface PriceManagementProps {
  user: AuthUser
  symbol: string
  selectedCurrency?: SupportedCurrency
  symbolCurrency?: string
}

type ViewMode = 'history' | 'addPrice' | 'bulkImport'

export default function PriceManagement({ user, symbol, selectedCurrency = 'USD', symbolCurrency = 'USD' }: PriceManagementProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('history')
  const [refreshKey, setRefreshKey] = useState(0)

  const handlePriceUpdated = () => {
    // Refresh the price history by changing the key
    setRefreshKey(prev => prev + 1)
    // Return to history view after successful update
    if (viewMode !== 'history') {
      setViewMode('history')
    }
  }

  const handlePriceAdded = async (priceData?: any) => {
    // This is called when adding a new price (not editing)
    handlePriceUpdated()
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Price History
      </button>
      
      <button
        onClick={() => setViewMode('addPrice')}
        className={`inline-flex items-center px-4 py-2 border rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 ${
          viewMode === 'addPrice'
            ? 'border-green-600 bg-green-600 text-white hover:bg-green-700'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
        }`}
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Add Price
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
      case 'addPrice':
        return (
          <AddPriceForm
            user={user}
            symbol={symbol}
            symbolCurrency={symbolCurrency}
            onPriceAdded={handlePriceAdded}
            onCancel={() => setViewMode('history')}
          />
        )
      
      case 'bulkImport':
        return (
          <BulkPriceImport
            user={user}
            symbol={symbol}
            onPricesImported={handlePriceUpdated}
            onCancel={() => setViewMode('history')}
          />
        )
      
      case 'history':
      default:
        return (
          <ManualPriceHistory
            key={refreshKey}
            user={user}
            symbol={symbol}
            onPriceUpdated={handlePriceUpdated}
            selectedCurrency={selectedCurrency}
            symbolCurrency={symbolCurrency}
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