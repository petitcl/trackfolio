/**
 * Admin API: Symbol Search
 * 
 * This endpoint searches for symbols using Alpha Vantage SYMBOL_SEARCH API.
 * Useful for finding the correct ticker symbol and company information.
 * 
 * Security: Uses authorization header validation
 * Rate Limiting: Respects Alpha Vantage API limits
 * 
 * Usage: GET /api/admin/search-symbols?keywords=apple
 */

import { NextRequest, NextResponse } from 'next/server'
import { priceDataService, type SymbolSearchResult } from '@/lib/services/priceData.service'
import { 
  validateAdminAuth,
  validateAdminEnvironment,
  createMethodNotAllowedResponse,
  createErrorResponse,
  createTimer
} from '@/lib/api/admin-auth'

export async function GET(request: NextRequest) {
  const timer = createTimer()
  
  try {
    // Security validation
    const authError = validateAdminAuth(request)
    if (authError) return authError
    
    const envError = validateAdminEnvironment()
    if (envError) return envError

    // Get search keywords from query params
    const { searchParams } = new URL(request.url)
    const keywords = searchParams.get('keywords')

    if (!keywords || keywords.trim().length === 0) {
      return NextResponse.json(
        { error: 'Keywords parameter is required' },
        { status: 400 }
      )
    }

    console.log(`🔍 Searching symbols for: "${keywords}"`)

    // Search for symbols using Alpha Vantage
    const results: SymbolSearchResult[] = await priceDataService.searchSymbols(keywords)

    console.log(`✅ Found ${results.length} symbol matches for "${keywords}"`)

    // Get provider statistics
    const providerStats = priceDataService.getProviderStats()
    
    // Group results by provider for better visibility
    const resultsByProvider = results.reduce((acc, result) => {
      const provider = result.provider || 'unknown'
      if (!acc[provider]) acc[provider] = []
      acc[provider].push(result)
      return acc
    }, {} as Record<string, typeof results>)

    // Return results with timing info and provider statistics
    return NextResponse.json({
      keywords,
      results,
      count: results.length,
      duration: timer.getDuration(),
      providerStats,
      resultsByProvider: Object.entries(resultsByProvider).map(([provider, providerResults]) => ({
        provider,
        count: providerResults.length,
        results: providerResults
      }))
    })

  } catch (error) {
    return createErrorResponse(error, 'Symbol search', timer.startTime)
  }
}

// Only allow GET requests
export async function POST() {
  return createMethodNotAllowedResponse('GET', '?keywords=search_term')
}

export async function PUT() {
  return createMethodNotAllowedResponse('GET', '?keywords=search_term')
}

export async function DELETE() {
  return createMethodNotAllowedResponse('GET', '?keywords=search_term')
}