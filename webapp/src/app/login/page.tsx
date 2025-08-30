'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { clientAuthService } from '@/lib/auth/client.auth.service'
import ThemeToggle from '@/components/ThemeToggle'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    setError(null)
    
    const { error: authError } = await clientAuthService.signInWithGoogle()
    
    if (authError) {
      setError(authError.message)
    }
    
    setIsLoading(false)
  }

  const handleEmailLogin = async (formData: FormData) => {
    setIsLoading(true)
    setError(null)
    
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    
    const { user, error: authError } = await clientAuthService.signInWithEmail(email, password)
    
    if (authError) {
      setError(authError.message)
    } else if (user) {
      router.push('/')
    }
    
    setIsLoading(false)
  }

  const handleDemoLogin = async () => {
    setIsLoading(true)
    setError(null)
    
    const { user, error: authError } = await clientAuthService.signInDemo()
    
    if (authError) {
      setError(authError.message)
    } else if (user) {
      router.push('/')
    }
    
    setIsLoading(false)
  }

  const isDemoEnabled = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_ENABLE_DEMO === 'true'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Theme Toggle - Fixed position */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Welcome to Trackfolio
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300">
          Sign in to track your portfolio
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 border dark:border-gray-700">
          {error && (
            <div className="mb-4 p-4 text-sm text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
              {error}
            </div>
          )}

          {/* Google Login */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            {isLoading ? 'Signing in...' : 'Continue with Google'}
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">Or continue with email</span>
            </div>
          </div>

          {/* Email Login Form */}
          <form action={handleEmailLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 sm:text-sm"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 sm:text-sm"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Signing in...' : 'Sign in with Email'}
              </button>
            </div>
          </form>

          {/* Demo Login Button - Development Only */}
          {isDemoEnabled && (
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">Development Mode</span>
                </div>
              </div>
              <div className="mt-6">
                <button
                  onClick={handleDemoLogin}
                  disabled={isLoading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Signing in...' : '🚀 Demo Login (Mock Data)'}
                </button>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                  Uses test credentials with sample portfolio data
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}