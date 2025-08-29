import { createClient as createServerClient } from '@/lib/supabase/server'
import type { AuthUser, AuthResponse } from './auth.service'

export class ServerAuthService {
  async getCurrentUser(): Promise<AuthResponse> {
    try {
      const supabase = await createServerClient()
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) {
        console.error('Server auth error:', error)
        return { error: { message: error.message } }
      }
      
      if (!user) {
        return { error: { message: 'No authenticated user' } }
      }
      
      return { user: user as AuthUser }
    } catch (error) {
      console.error('Unexpected server auth error:', error)
      return { error: { message: 'Authentication failed' } }
    }
  }
}

// Singleton instance
export const serverAuthService = new ServerAuthService()