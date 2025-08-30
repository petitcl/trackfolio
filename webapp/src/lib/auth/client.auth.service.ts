import { createClient as createBrowserClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { MOCK_USER_ID, MOCK_USER_EMAIL, DEMO_USER_STORAGE_KEY, DEMO_USER_COOKIE_NAME } from '@/lib/constants/mockConstants'

export interface AuthUser {
  id: string
  email: string | undefined
  user_metadata: Record<string, unknown>
  app_metadata: Record<string, unknown>
  aud: string
  created_at: string
  isDemo?: boolean
}

export interface AuthError {
  message: string
  status?: number
}

export interface AuthResponse {
  user?: AuthUser
  error?: AuthError
}

// Mock user for development mode
const createMockUser = (): AuthUser => ({
  id: MOCK_USER_ID,
  email: MOCK_USER_EMAIL,
  user_metadata: {},
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  isDemo: true,
})

// Client-side auth service
export class ClientAuthService {
  private supabase = createBrowserClient()
  private isDemoEnabled = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_ENABLE_DEMO === 'true'

  async signInWithGoogle(): Promise<AuthResponse> {
    try {
      const { error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      
      if (error) {
        return { error: { message: error.message } }
      }
      
      return {}
    } catch (error) {
      return { error: { message: 'An unexpected error occurred' } }
    }
  }

  async signInWithEmail(email: string, password: string): Promise<AuthResponse> {
    try {
      console.log('🔐 Attempting email login...')
      console.log('Email:', email)
      console.log('Supabase client initialized:', !!this.supabase)
      
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      console.log('📊 Auth response received:')
      console.log('Data:', data ? 'User data received' : 'No data')
      console.log('Error:', error ? error.message : 'No error')
      
      if (error) {
        console.error('❌ Login error:', error)
        return { error: { message: error.message } }
      }
      
      console.log('✅ Login successful!')
      return { user: data.user as AuthUser }
    } catch (error) {
      console.error('❌ Unexpected error during login:', error)
      return { error: { message: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` } }
    }
  }

  async signInDemo(): Promise<AuthResponse> {
    if (!this.isDemoEnabled) {
      return { error: { message: 'Demo login not available' } }
    }

    // In development, store mock user in localStorage and cookie
    const mockUser = createMockUser()
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(mockUser))
      // Set cookie for middleware
      document.cookie = `${DEMO_USER_COOKIE_NAME}=${JSON.stringify(mockUser)}; path=/; max-age=3600`
      console.log('👨‍💼 Demo user stored in localStorage and cookie')
    }
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ user: mockUser })
      }, 500)
    })
  }

  async signOut(): Promise<{ error?: AuthError }> {
    try {
      // Clear demo user from localStorage and cookie
      if (this.isDevelopment && typeof window !== 'undefined') {
        localStorage.removeItem(DEMO_USER_STORAGE_KEY)
        // Clear cookie
        document.cookie = `${DEMO_USER_COOKIE_NAME}=; path=/; max-age=0`
        console.log('👨‍💼 Demo user cleared from localStorage and cookie')
      }
      
      const { error } = await this.supabase.auth.signOut()
      
      if (error) {
        return { error: { message: error.message } }
      }
      
      return {}
    } catch (error) {
      return { error: { message: 'An unexpected error occurred' } }
    }
  }

  async getCurrentUser(): Promise<AuthResponse> {
    try {
      // In demo-enabled mode, check if we have a demo user in localStorage
      if (this.isDemoEnabled && typeof window !== 'undefined') {
        const demoUser = localStorage.getItem(DEMO_USER_STORAGE_KEY)
        if (demoUser) {
          console.log('👨‍💼 Demo user found in localStorage')
          return { user: JSON.parse(demoUser) as AuthUser }
        }
      }
      
      const { data: { user }, error } = await this.supabase.auth.getUser()
      
      if (error) {
        return { error: { message: error.message } }
      }
      
      return { user: user as AuthUser | undefined }
    } catch (error) {
      return { error: { message: 'An unexpected error occurred' } }
    }
  }

  async getUser(): Promise<AuthUser | null> {
    const response = await this.getCurrentUser()
    return response.user || null
  }

  /**
   * Check if the current user is a mock/demo user (non-async)
   * This method can be called synchronously to determine user type
   */
  isCurrentUserMock(): boolean {
    // Check if we're in demo-enabled mode and have demo user data
    if (this.isDemoEnabled && typeof window !== 'undefined') {
      const demoUser = localStorage.getItem(DEMO_USER_STORAGE_KEY)
      if (demoUser) {
        try {
          const user = JSON.parse(demoUser) as AuthUser
          // Check for mock user identifiers
          return user.email === MOCK_USER_EMAIL || user.id === MOCK_USER_ID
        } catch (error) {
          // If we can't parse the demo user data, assume it's not mock
          return false
        }
      }
    }
    
    return false
  }
}

// Singleton instance
export const clientAuthService = new ClientAuthService()