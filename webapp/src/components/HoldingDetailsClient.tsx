'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { clientAuthService, type AuthUser } from '@/lib/auth/client.auth.service'
import HoldingDetails from '@/components/HoldingDetails'
import { currencyService, type SupportedCurrency } from '@/lib/services/currency.service'

interface HoldingDetailsClientProps {
  symbol: string
}

export default function HoldingDetailsClient({ symbol }: HoldingDetailsClientProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>('USD')
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('🔐 Checking authentication for holdings page...', window.location.pathname)
        const { user, error } = await clientAuthService.getCurrentUser()
        
        console.log('Auth response:', { user: user?.email, error: error?.message })
        
        if (error || !user) {
          console.log('❌ No authenticated user, redirecting to login')
          console.log('Current pathname:', window.location.pathname)
          router.push('/login')
          return
        }
        
        console.log('✅ User authenticated for holdings:', user.email)
        setUser(user)
      } catch (err) {
        console.error('Authentication error:', err)
        setError('Authentication failed')
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [router])

  // Initialize currency preference on mount
  useEffect(() => {
    const preferredCurrency = currencyService.getPreferredCurrency()
    setSelectedCurrency(preferredCurrency)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Authentication required'}</p>
        </div>
      </div>
    )
  }

  const handleCurrencyChange = (newCurrency: SupportedCurrency) => {
    setSelectedCurrency(newCurrency)
  }

  return (
    <HoldingDetails
      user={user}
      symbol={symbol}
      selectedCurrency={selectedCurrency}
      onCurrencyChange={handleCurrencyChange}
    />
  )
}