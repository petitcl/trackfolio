import { createClient as createBrowserClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export interface AuthUser {
  id: string
  email: string | undefined
  user_metadata: Record<string, any>
  app_metadata: Record<string, any>
  aud: string
  created_at: string
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
  id: 'mock-user-id',
  email: 'test@trackfolio.com',
  user_metadata: {},
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
})

// Client-side auth service
export class ClientAuthService {
  private supabase = createBrowserClient()
  private isDevelopment = process.env.NODE_ENV === 'development'

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
    if (!this.isDevelopment) {
      return { error: { message: 'Demo login only available in development' } }
    }

    // In development, return mock user immediately
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ user: createMockUser() })
      }, 500)
    })
  }

  async signOut(): Promise<{ error?: AuthError }> {
    try {
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
      const { data: { user }, error } = await this.supabase.auth.getUser()
      
      if (error) {
        return { error: { message: error.message } }
      }
      
      return { user: user as AuthUser | undefined }
    } catch (error) {
      return { error: { message: 'An unexpected error occurred' } }
    }
  }
}

// Singleton instance
export const clientAuthService = new ClientAuthService()