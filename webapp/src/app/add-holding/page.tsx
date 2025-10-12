'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * This page has been deprecated in favor of the AddHoldingModal component.
 * It now redirects to the main dashboard where users can access the modal.
 * Kept for backward compatibility in case users have bookmarked this URL.
 */
export default function AddHoldingPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to main dashboard with a note
    console.log('Redirecting to dashboard - Add Holding is now a modal')
    router.push('/')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Redirecting to dashboard...</p>
      </div>
    </div>
  )
}