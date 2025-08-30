import { createClient as createServerClient } from '@/lib/supabase/server'
import type { AuthUser, AuthResponse } from './client.auth.service'
import { MOCK_USER_ID, MOCK_USER_EMAIL } from '@/lib/constants/mockConstants'

// Mock user for development mode
const createMockUser = (): AuthUser => ({
  id: MOCK_USER_ID,
  email: MOCK_USER_EMAIL,
  user_metadata: {},
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
})

// Server-side auth service - only for server components
export class ServerAuthService {
  private isDemoEnabled = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_ENABLE_DEMO === 'true'

  async getCurrentUser(): Promise<AuthResponse> {
    try {
      const supabase = await createServerClient()
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error && !this.isDemoEnabled) {
        return { error: { message: error.message } }
      }
      
      // In demo-enabled mode with placeholder credentials, return mock user if no real user
      const currentUser = user || (this.isDemoEnabled ? createMockUser() : null)
      
      return { user: currentUser as AuthUser | undefined }
    } catch (error) {
      // In demo-enabled mode, fallback to mock user
      if (this.isDemoEnabled) {
        return { user: createMockUser() }
      }
      
      return { error: { message: 'An unexpected error occurred' } }
    }
  }
}

// Singleton instance
export const serverAuthService = new ServerAuthService()