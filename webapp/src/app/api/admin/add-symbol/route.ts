/**
 * Admin API: Add Symbol to Database
 * 
 * This endpoint adds a new symbol to the symbols table with automatic
 * asset type detection and currency assignment from Alpha Vantage data.
 * 
 * Security: Uses authorization header validation
 * Rate Limiting: Respects Alpha Vantage API limits
 * 
 * Usage: POST /api/admin/add-symbol with { symbol: "AAPL", name?: "Apple Inc.", currency?: "USD" }
 */

import { NextRequest, NextResponse } from 'next/server'
import { priceDataService } from '@/lib/services/priceData.service'
import type { AssetType } from '@/lib/supabase/types'
import { 
  createAdminSupabaseClient,
  validateAdminAuth,
  validateAdminEnvironment,
  createMethodNotAllowedResponse,
  createErrorResponse,
  createTimer
} from '@/lib/api/admin-auth'

interface AddSymbolRequest {
  symbol: string
  name?: string
  currency?: string
  assetType?: AssetType
}

interface AddSymbolResult {
  symbol: string
  name: string
  assetType: AssetType
  currency: string
  added: boolean
  alreadyExists?: boolean
  currentPrice?: number
  error?: string
  duration: string
}

export async function POST(request: NextRequest) {
  const timer = createTimer()
  const supabase = createAdminSupabaseClient()
  
  try {
    // Security validation
    const authError = validateAdminAuth(request)
    if (authError) return authError
    
    const envError = validateAdminEnvironment()
    if (envError) return envError

    // Parse request body
    const body: AddSymbolRequest = await request.json()
    const { symbol, name, currency, assetType } = body

    if (!symbol || typeof symbol !== 'string') {
      return NextResponse.json(
        { error: 'Symbol is required and must be a string' },
        { status: 400 }
      )
    }

    const upperSymbol = symbol.toUpperCase().trim()
    console.log(`📝 Adding symbol: ${upperSymbol}`)

    // Check if symbol already exists
    const { data: existingSymbol, error: checkError } = await supabase
      .from('symbols')
      .select('symbol, name, asset_type, currency, is_custom')
      .eq('symbol', upperSymbol)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      throw new Error(`Failed to check existing symbol: ${checkError.message}`)
    }

    if (existingSymbol) {
      console.log(`Symbol ${upperSymbol} already exists`)
      return NextResponse.json({
        symbol: upperSymbol,
        name: existingSymbol.name,
        assetType: existingSymbol.asset_type,
        currency: existingSymbol.currency,
        added: false,
        alreadyExists: true,
        duration: timer.getDuration()
      } as AddSymbolResult)
    }

    let symbolName = name
    let symbolCurrency = currency || 'USD'
    let detectedAssetType: AssetType = assetType || 'stock'

    // If name not provided, try to fetch from Alpha Vantage search
    if (!symbolName) {
      try {
        console.log(`🔍 Searching for symbol info: ${upperSymbol}`)
        const searchResults = await priceDataService.searchSymbols(upperSymbol)
        
        if (searchResults.length > 0) {
          // Find exact match first, otherwise use first result
          const exactMatch = searchResults.find(r => r.symbol === upperSymbol)
          const bestMatch = exactMatch || searchResults[0]
          
          symbolName = bestMatch.name
          symbolCurrency = bestMatch.currency || 'USD'
          
          // Detect asset type based on Alpha Vantage type
          if (bestMatch.type.toLowerCase().includes('etf')) {
            detectedAssetType = 'etf'
          } else if (bestMatch.type.toLowerCase().includes('mutual fund')) {
            detectedAssetType = 'etf' // Treat mutual funds as ETFs for our purposes
          } else {
            detectedAssetType = 'stock'
          }
          
          console.log(`✅ Found symbol info: ${symbolName} (${detectedAssetType}, ${symbolCurrency})`)
        }
      } catch (searchError) {
        console.warn(`Warning: Could not fetch symbol info from Alpha Vantage:`, searchError)
        // Continue with provided values or defaults
      }
    }

    // Use provided name or fallback to symbol if search failed
    if (!symbolName) {
      symbolName = upperSymbol
      console.log(`Using symbol as name: ${symbolName}`)
    }

    // For crypto symbols, detect based on common crypto symbols
    const cryptoSymbols = ['BTC', 'ETH', 'ADA', 'DOT', 'SOL', 'AVAX', 'MATIC', 'LINK', 'UNI', 'AAVE']
    if (cryptoSymbols.includes(upperSymbol) || symbolName.toLowerCase().includes('bitcoin') || symbolName.toLowerCase().includes('ethereum')) {
      detectedAssetType = 'crypto'
    }

    // Try to get current price to verify symbol exists
    let currentPrice: number | undefined
    try {
      console.log(`📈 Fetching current price for ${upperSymbol}...`)
      const quote = await priceDataService.fetchCurrentQuote(upperSymbol, detectedAssetType, symbolCurrency as any)
      if (quote) {
        currentPrice = quote.price
        console.log(`✅ Current price: $${currentPrice}`)
      }
    } catch (priceError) {
      console.warn(`Warning: Could not fetch current price:`, priceError)
      // Don't fail the addition if price fetch fails
    }

    // Insert the symbol into database
    const { error: insertError } = await supabase
      .from('symbols')
      .insert({
        symbol: upperSymbol,
        name: symbolName,
        asset_type: detectedAssetType,
        currency: symbolCurrency,
        last_price: currentPrice,
        last_updated: currentPrice ? new Date().toISOString() : null,
        is_custom: false,
        created_by_user_id: null
      })

    if (insertError) {
      throw new Error(`Failed to insert symbol: ${insertError.message}`)
    }

    console.log(`🎉 Successfully added symbol: ${upperSymbol}`)

    const result: AddSymbolResult = {
      symbol: upperSymbol,
      name: symbolName,
      assetType: detectedAssetType,
      currency: symbolCurrency,
      added: true,
      currentPrice,
      duration: timer.getDuration()
    }

    return NextResponse.json(result)

  } catch (error) {
    return createErrorResponse(error, 'Add symbol', timer.startTime)
  }
}

// Only allow POST requests
export async function GET() {
  return createMethodNotAllowedResponse('POST', '{ symbol: "SYMBOL", name?: "Company Name" }')
}

export async function PUT() {
  return createMethodNotAllowedResponse('POST', '{ symbol: "SYMBOL", name?: "Company Name" }')
}

export async function DELETE() {
  return createMethodNotAllowedResponse('POST', '{ symbol: "SYMBOL", name?: "Company Name" }')
}