'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { clientAuthService, type AuthUser } from '@/lib/auth/client.auth.service'
import CurrencySelector from '@/components/CurrencySelector'
import { currencyService, type SupportedCurrency } from '@/lib/services/currency.service'

interface HeaderProps {
  user: AuthUser
  showCurrencySelector?: boolean
  selectedCurrency?: SupportedCurrency
  onCurrencyChange?: (currency: SupportedCurrency) => void
  backLink?: {
    href: string
    label: string
  }
  title?: string
  subtitle?: string
  icon?: string
  badges?: Array<{
    text: string
    className?: string
  }>
}

export default function Header({
  user,
  showCurrencySelector = false,
  selectedCurrency = 'USD',
  onCurrencyChange,
  backLink,
  title,
  subtitle,
  icon,
  badges = []
}: HeaderProps) {
  const [isLoading, setIsLoading] = React.useState(false)
  const router = useRouter()

  const handleSignOut = async () => {
    setIsLoading(true)
    await clientAuthService.signOut()
    router.push('/login')
  }

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-4 gap-4">
          {/* Left side */}
          <div className="flex items-center min-w-0 flex-1">
            {backLink ? (
              <div className="flex items-center space-x-4 min-w-0 flex-1">
                <Link
                  href={backLink.href}
                  className="text-blue-600 dark:text-blue-400 hover:underline flex items-center flex-shrink-0"
                >
                  ← {backLink.label}
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-3">
                    {icon && <span className="text-2xl flex-shrink-0">{icon}</span>}
                    <div className="min-w-0 flex-1">
                      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
                        {title}
                      </h1>
                      {subtitle && (
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {subtitle}
                          </p>
                          {badges.map((badge, index) => (
                            <span
                              key={index}
                              className={`px-2 py-1 text-xs rounded flex-shrink-0 ${
                                badge.className || 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                              }`}
                            >
                              {badge.text}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center min-w-0 flex-1">
                <img
                  src="/icon-192x192.png"
                  alt="Trackfolio Logo"
                  className="w-10 h-10 mr-3 rounded-lg flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    Trackfolio
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    Welcome back, {user.email}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 flex-shrink-0">
            {/* Currency selector - always visible on mobile when enabled */}
            {showCurrencySelector && onCurrencyChange && (
              <CurrencySelector
                selectedCurrency={selectedCurrency}
                onCurrencyChange={onCurrencyChange}
                className="flex"
              />
            )}

            <button
              onClick={handleSignOut}
              disabled={isLoading}
              className="inline-flex items-center px-3 sm:px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 flex-shrink-0"
            >
              {isLoading ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}