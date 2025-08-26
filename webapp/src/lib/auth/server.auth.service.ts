import { createClient as createServerClient } from '@/lib/supabase/server'
import type { AuthUser, AuthResponse } from './auth.service'

// Mock user for development mode
const createMockUser = (): AuthUser => ({
  id: 'mock-user-id',
  email: 'test@trackfolio.com',
  user_metadata: {},
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
})

// Server-side auth service - only for server components
export class ServerAuthService {
  private isDevelopment = process.env.NODE_ENV === 'development'

  async getCurrentUser(): Promise<AuthResponse> {
    try {
      const supabase = await createServerClient()
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error && !this.isDevelopment) {
        return { error: { message: error.message } }
      }
      
      // In development mode with placeholder credentials, return mock user if no real user
      const currentUser = user || (this.isDevelopment ? createMockUser() : null)
      
      return { user: currentUser as AuthUser | undefined }
    } catch (error) {
      // In development mode, fallback to mock user
      if (this.isDevelopment) {
        return { user: createMockUser() }
      }
      
      return { error: { message: 'An unexpected error occurred' } }
    }
  }
}

// Singleton instance
export const serverAuthService = new ServerAuthService()