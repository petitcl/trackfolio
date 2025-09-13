/**
 * Admin API Authentication and Validation Utilities
 * 
 * Shared utilities for admin/cron endpoints including authorization,
 * environment validation, and common types.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { SymbolType } from '@/lib/services/priceData.service'

/**
 * Initialize Supabase client with service role for admin operations
 */
export function createAdminSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

/**
 * Validate admin request authorization
 * Returns null if valid, NextResponse with error if invalid
 */
export function validateAdminAuth(request: NextRequest): NextResponse | null {
  const isLocal = process.env.NODE_ENV === 'development'
  const authHeader = request.headers.get('authorization')
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`
  
  if (!authHeader || authHeader !== expectedAuth) {
    const errorDetail = isLocal ? {
      received: authHeader,
      expected: expectedAuth,
      cronSecretConfigured: !!process.env.CRON_SECRET
    } : {}
    
    console.error('Unauthorized admin request - invalid authorization header', errorDetail)
    return NextResponse.json(
      { 
        error: 'Unauthorized',
        ...(isLocal && { debug: errorDetail })
      }, 
      { status: 401 }
    )
  }
  
  return null
}

/**
 * Validate required environment variables for admin operations
 * Returns null if valid, NextResponse with error if invalid
 */
export function validateAdminEnvironment(): NextResponse | null {
  const isLocal = process.env.NODE_ENV === 'development'
  
  if (isLocal) {
    const missingVars = []
    if (!process.env.ALPHA_VANTAGE_API_KEY) missingVars.push('ALPHA_VANTAGE_API_KEY')
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missingVars.push('SUPABASE_SERVICE_ROLE_KEY')
    if (!process.env.CRON_SECRET) missingVars.push('CRON_SECRET')
    
    if (missingVars.length > 0) {
      console.error('Missing required environment variables:', missingVars)
      return NextResponse.json(
        { 
          error: 'Configuration error',
          missingEnvironmentVariables: missingVars
        }, 
        { status: 500 }
      )
    }
  }
  
  return null
}

/**
 * Map database asset_type to priceDataService SymbolType
 */
export function mapAssetTypeToSymbolType(assetType: string): SymbolType {
  switch (assetType) {
    case 'stock':
      return 'stock'
    case 'crypto':
      return 'crypto'
    case 'currency':
      return 'currency'
    default:
      // For cash, real_estate, other - these don't have market data
      throw new Error(`Asset type '${assetType}' does not support market data fetching`)
  }
}

/**
 * Create standardized method not allowed responses
 */
export function createMethodNotAllowedResponse(allowedMethod: string, bodyExample?: string) {
  const message = bodyExample 
    ? `Method not allowed. Use ${allowedMethod} with ${bodyExample}`
    : `Method not allowed. Use ${allowedMethod}`
    
  return NextResponse.json({ error: message }, { status: 405 })
}

/**
 * Create standardized error response with timing
 */
export function createErrorResponse(
  error: unknown, 
  operation: string, 
  startTime: number, 
  status = 500
): NextResponse {
  const duration = Date.now() - startTime
  
  console.error(`❌ ${operation} failed:`, error)
  
  return NextResponse.json(
    {
      error: `${operation} failed`,
      message: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`
    },
    { status }
  )
}

/**
 * Common types for admin operations
 */
export interface AdminOperationTiming {
  startTime: number
  getDuration: () => string
}

export function createTimer(): AdminOperationTiming {
  const startTime = Date.now()
  return {
    startTime,
    getDuration: () => `${Date.now() - startTime}ms`
  }
}