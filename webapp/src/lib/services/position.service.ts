import type { AuthUser } from '@/lib/auth/client.auth.service'
import type { Database } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/client'
import { getClientMockDataStore } from '@/lib/mockDataStoreClient'

type Position = Database['public']['Tables']['positions']['Row']
type PositionInsert = Database['public']['Tables']['positions']['Insert']

/**
 * Position Service - handles CRUD operations for user positions
 */
export class PositionService {
  private supabase = createClient()

  /**
   * Get all positions for a user
   */
  async getPositions(user: AuthUser): Promise<Position[]> {
    if (user.isDemo) {
      // For demo users, get from mock data store
      return getClientMockDataStore().getPositions()
    }

    // For real users, fetch from Supabase
    const { data, error } = await this.supabase
      .from('positions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching positions:', error)
      return []
    }

    return data || []
  }

  /**
   * Get a specific position by symbol
   */
  async getPositionBySymbol(user: AuthUser, symbol: string): Promise<Position | null> {
    if (user.isDemo) {
      // For demo users, get from mock data store
      const positions = getClientMockDataStore().getPositions()
      return positions.find(p => p.symbol === symbol) || null
    }

    // For real users, fetch from Supabase
    const { data, error } = await this.supabase
      .from('positions')
      .select('*')
      .eq('user_id', user.id)
      .eq('symbol', symbol)
      .single()

    if (error) {
      console.error('Error fetching position:', error)
      return null
    }

    return data
  }

  /**
   * Create a new position
   */
  async createPosition(user: AuthUser, symbol: string): Promise<{ success: boolean; error?: string; position?: Position }> {
    try {
      if (user.isDemo) {
        // For demo users, add to mock data store
        const position = getClientMockDataStore().addPosition(symbol, user.id)
        return { success: true, position }
      }

      // For real users, insert into Supabase
      const { data, error } = await this.supabase
        .from('positions')
        .insert({
          user_id: user.id,
          symbol: symbol,
        })
        .select()
        .single()

      if (error) {
        // Check for unique constraint violation
        if (error.code === '23505') {
          return { success: false, error: 'Position already exists for this symbol' }
        }
        console.error('Error creating position:', error)
        return { success: false, error: 'Failed to create position' }
      }

      return { success: true, position: data }
    } catch (error) {
      console.error('Error creating position:', error)
      return { success: false, error: 'An unexpected error occurred' }
    }
  }

  /**
   * Delete a position
   */
  async deletePosition(user: AuthUser, symbol: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (user.isDemo) {
        // For demo users, delete from mock data store
        const success = getClientMockDataStore().deletePosition(symbol)
        if (!success) {
          return { success: false, error: 'Position not found' }
        }
        return { success: true }
      }

      // For real users, delete from Supabase
      const { error } = await this.supabase
        .from('positions')
        .delete()
        .eq('user_id', user.id)
        .eq('symbol', symbol)

      if (error) {
        console.error('Error deleting position:', error)
        return { success: false, error: 'Failed to delete position' }
      }

      return { success: true }
    } catch (error) {
      console.error('Error deleting position:', error)
      return { success: false, error: 'An unexpected error occurred' }
    }
  }
}

export const positionService = new PositionService()
