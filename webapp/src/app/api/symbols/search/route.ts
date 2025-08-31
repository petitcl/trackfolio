/**
 * Public API: Symbol Search
 * 
 * This endpoint searches for symbols using multiple providers (Alpha Vantage, Yahoo Finance)
 * for use in the frontend symbol search functionality.
 * 
 * Usage: GET /api/symbols/search?q=apple
 */

import { NextRequest, NextResponse } from 'next/server'
import { priceDataService } from '@/lib/services/priceData.service'

export async function GET(request: NextRequest) {
  try {
    // Get search query from URL params
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required and must be at least 2 characters' },
        { status: 400 }
      )
    }

    console.log(`🔍 Public symbol search for: "${query}"`)

    // Search for symbols using the existing price data service
    const results = await priceDataService.searchSymbols(query.trim())

    // Transform results to match the frontend interface
    const transformedResults = results.map(result => ({
      symbol: result.symbol,
      name: result.name,
      type: result.type || 'stock',
      exchange: result.region,
      currency: result.currency
    }))

    console.log(`✅ Found ${transformedResults.length} symbol matches for "${query}"`)

    return NextResponse.json({
      query,
      results: transformedResults,
      count: transformedResults.length
    })

  } catch (error) {
    console.error('Error searching symbols:', error)
    return NextResponse.json(
      { error: 'Failed to search symbols' },
      { status: 500 }
    )
  }
}