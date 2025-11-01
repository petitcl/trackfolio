'use client'

import React, { useState } from 'react'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import BulkBalanceImport from './BulkBalanceImport'
import BalanceHistory from './BalanceHistory'
import AddBalanceForm from './AddBalanceForm'
import type { SupportedCurrency } from '@/lib/services/currency.service'

interface BalanceManagementProps {
  user: AuthUser
  symbol: string
  selectedCurrency?: SupportedCurrency
  symbolCurrency?: string
}

type ViewMode = 'history' | 'addBalance' | 'bulkImport'

export default function BalanceManagement({
  user,
  symbol,
  selectedCurrency = 'USD',
  symbolCurrency = 'USD',
}: BalanceManagementProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('history')
  const [refreshKey, setRefreshKey] = useState(0)

  const handleBalanceUpdated = () => {
    // Reload the page to refresh all portfolio data
    window.location.reload()
  }

  const handleBalanceAdded = async (balanceData?: any) => {
    // This is called when adding a new balance (not editing)
    handleBalanceUpdated()
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
        Balance History
      </button>

      <button
        onClick={() => setViewMode('addBalance')}
        className={`inline-flex items-center px-4 py-2 border rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 ${
          viewMode === 'addBalance'
            ? 'border-green-600 bg-green-600 text-white hover:bg-green-700'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
        }`}
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Add Balance
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
      case 'addBalance':
        return (
          <AddBalanceForm
            user={user}
            symbol={symbol}
            symbolCurrency={symbolCurrency}
            onBalanceAdded={handleBalanceAdded}
            onCancel={() => setViewMode('history')}
          />
        )

      case 'bulkImport':
        return (
          <BulkBalanceImport
            user={user}
            symbol={symbol}
            onBalancesImported={handleBalanceUpdated}
            onCancel={() => setViewMode('history')}
          />
        )

      case 'history':
      default:
        return (
          <BalanceHistory
            key={refreshKey}
            user={user}
            symbol={symbol}
            onBalanceUpdated={handleBalanceUpdated}
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
