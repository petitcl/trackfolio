'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { clientAuthService } from '@/lib/auth/client.auth.service'
import { getClientMockDataStore } from '@/lib/mockDataStoreClient'

export default function DemoModeBanner() {
  const [isResetting, setIsResetting] = useState(false)
  const router = useRouter()
  
  // Only show banner if user is in demo mode
  const isDemoMode = clientAuthService.isCurrentUserMock()
  
  if (!isDemoMode) {
    return null
  }

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset all demo data to the original sample data? This will remove any holdings you\'ve added.')) {
      setIsResetting(true)
      
      // Reset the mock data store
      getClientMockDataStore().reset()
      
      // Force a page refresh to reload the data
      setTimeout(() => {
        router.refresh()
        window.location.reload()
      }, 100)
    }
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-3 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <span className="font-semibold">⚠️ Demo Mode:</span> You're using mock data for testing. 
            Connect your Supabase database to manage your real portfolio.
          </p>
          <button
            onClick={handleReset}
            disabled={isResetting}
            className="px-3 py-1 text-xs font-medium text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-800/50 hover:bg-amber-200 dark:hover:bg-amber-800/70 rounded-md border border-amber-300 dark:border-amber-700 transition-colors disabled:opacity-50"
          >
            {isResetting ? 'Resetting...' : '🔄 Reset Demo Data'}
          </button>
        </div>
      </div>
    </div>
  )
}