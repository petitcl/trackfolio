'use client'

import React, { useState } from 'react'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import MultiBulkTransactionImport from './MultiBulkTransactionImport'
import MultiBulkPriceImport from './MultiBulkPriceImport'
import MultiBulkHoldingImport from './MultiBulkHoldingImport'

interface MultiBulkImportModalProps {
  user: AuthUser
  onImportComplete?: () => void
  onCancel?: () => void
}

type ImportTab = 'transactions' | 'prices' | 'holdings'

export default function MultiBulkImportModal({ 
  user, 
  onImportComplete, 
  onCancel 
}: MultiBulkImportModalProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>('transactions')

  const tabs = [
    {
      id: 'transactions' as ImportTab,
      label: 'Transactions',
      icon: '📊',
      description: 'Import buy/sell transactions for multiple symbols'
    },
    {
      id: 'prices' as ImportTab,
      label: 'Prices',
      icon: '💰',
      description: 'Import custom price valuations for multiple symbols'
    },
    {
      id: 'holdings' as ImportTab,
      label: 'Holdings',
      icon: '🏦',
      description: 'Import market, custom, and account holdings in one CSV'
    }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'transactions':
        return (
          <MultiBulkTransactionImport
            user={user}
            onTransactionsImported={onImportComplete}
            onCancel={onCancel}
          />
        )
      case 'prices':
        return (
          <MultiBulkPriceImport
            user={user}
            onPricesImported={onImportComplete}
            onCancel={onCancel}
          />
        )
      case 'holdings':
        return (
          <MultiBulkHoldingImport
            user={user}
            onHoldingsImported={onImportComplete}
            onCancel={onCancel}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl">
      {/* Header with tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Bulk Import Data
          </h2>
          
          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex-1 flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors
                  ${activeTab === tab.id
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-600'
                  }
                `}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
          
          {/* Tab Description */}
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {tabs.find(tab => tab.id === activeTab)?.description}
          </p>
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {renderTabContent()}
      </div>
    </div>
  )
}