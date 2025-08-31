/**
 * Admin API: Symbol Historical Price Backfill
 * 
 * This endpoint fetches and stores historical price data for a single symbol.
 * 
 * Security: Uses authorization header validation
 * Rate Limiting: Respects Alpha Vantage API limits (25 req/day free tier)
 * 
 * Usage: POST /api/admin/backfill-symbol with { symbol: "AAPL" }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { priceDataService, type PriceData, type SymbolType, type BaseCurrency } from '@/lib/services/priceData.service'
import type { Database } from '@/lib/supabase/types'

// Initialize Supabase client with service role for admin operations
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key for admin operations
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

interface BackfillResult {
  symbol: string
  recordsInserted: number
  recordsUpdated: number
  duplicatesSkipped: number
  errors: string[]
  duration: string
}

/**
 * Map database asset_type to priceDataService SymbolType
 */
function mapAssetTypeToSymbolType(assetType: string): SymbolType {
  switch (assetType) {
    case 'stock':
      return 'stock'
    case 'etf':
      return 'etf'
    case 'crypto':
      return 'crypto'
    default:
      // For cash, real_estate, other - these don't have market data, should be handled upstream
      throw new Error(`Asset type '${assetType}' does not support market data fetching`)
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const isLocal = process.env.NODE_ENV === 'development'
  
  try {
    // Security: Validate authorization
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`
    
    if (!authHeader || authHeader !== expectedAuth) {
      const errorDetail = isLocal ? {
        received: authHeader,
        expected: expectedAuth,
        cronSecretConfigured: !!process.env.CRON_SECRET
      } : {}
      
      console.error('Unauthorized backfill request - invalid authorization header', errorDetail)
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          ...(isLocal && { debug: errorDetail })
        }, 
        { status: 401 }
      )
    }

    // Environment validation for local development
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

    // Parse request body
    const body = await request.json()
    const { symbol } = body

    if (!symbol || typeof symbol !== 'string') {
      return NextResponse.json(
        { error: 'Symbol is required and must be a string' },
        { status: 400 }
      )
    }

    const upperSymbol = symbol.toUpperCase().trim()
    console.log(`🔄 Starting historical price backfill for symbol: ${upperSymbol}`)

    // Check if symbol exists in our database
    const { data: symbolData, error: symbolError } = await supabase
      .from('symbols')
      .select('symbol, name, asset_type, is_custom')
      .eq('symbol', upperSymbol)
      .single()

    if (symbolError && symbolError.code !== 'PGRST116') {
      throw new Error(`Failed to check symbol: ${symbolError.message}`)
    }

    if (!symbolData) {
      console.error(`Symbol ${upperSymbol} not found in database`)
      return NextResponse.json(
        { 
          error: 'Symbol not found',
          message: `Symbol ${upperSymbol} does not exist in the database. Please add the symbol first.`
        },
        { status: 404 }
      )
    }

    // Skip custom symbols as they don't have market data
    if (symbolData.is_custom) {
      console.log(`Skipping custom symbol: ${upperSymbol}`)
      return NextResponse.json({
        symbol: upperSymbol,
        recordsInserted: 0,
        recordsUpdated: 0,
        duplicatesSkipped: 0,
        errors: [`Skipped: ${upperSymbol} is a custom symbol and does not have market price data`],
        duration: `${Date.now() - startTime}ms`
      })
    }

    // Skip asset types that don't have market data (cash, real_estate, other)
    if (!['stock', 'etf', 'crypto'].includes(symbolData.asset_type)) {
      console.log(`Skipping non-market asset type: ${upperSymbol} (${symbolData.asset_type})`)
      return NextResponse.json({
        symbol: upperSymbol,
        recordsInserted: 0,
        recordsUpdated: 0,
        duplicatesSkipped: 0,
        errors: [`Skipped: ${upperSymbol} has asset type '${symbolData.asset_type}' which does not have market price data`],
        duration: `${Date.now() - startTime}ms`
      })
    }

    // Map asset type to symbol type for the price service
    const symbolType = mapAssetTypeToSymbolType(symbolData.asset_type)
    const baseCurrency: BaseCurrency = 'USD' // Default to USD, could be extended to support other currencies
    
    // Fetch historical price data from Alpha Vantage
    console.log(`📈 Fetching historical prices for ${upperSymbol} (${symbolType}, ${baseCurrency})...`)
    const historicalPrices = await priceDataService.fetchHistoricalPrices(upperSymbol, symbolType, baseCurrency, 'full')
    
    if (historicalPrices.length === 0) {
      console.warn(`No historical price data found for ${upperSymbol}`)
      return NextResponse.json({
        symbol: upperSymbol,
        recordsInserted: 0,
        recordsUpdated: 0,
        duplicatesSkipped: 0,
        errors: [`No historical price data found for ${upperSymbol}`],
        duration: `${Date.now() - startTime}ms`
      })
    }

    console.log(`✅ Retrieved ${historicalPrices.length} historical price records for ${upperSymbol}`)

    // Process and store historical data
    const result: BackfillResult = {
      symbol: upperSymbol,
      recordsInserted: 0,
      recordsUpdated: 0,
      duplicatesSkipped: 0,
      errors: [],
      duration: ''
    }

    // Check which dates we already have
    const { data: existingRecords } = await supabase
      .from('symbol_price_history')
      .select('date')
      .eq('symbol', upperSymbol)

    const existingDates = new Set(existingRecords?.map(r => r.date) || [])

    // Prepare data for insertion/update
    const newRecords: Array<{
      symbol: string
      date: string
      open_price: number
      high_price: number
      low_price: number
      close_price: number
      volume: number
      adjusted_close: number
      data_source: string
    }> = []

    const updateRecords: Array<{
      symbol: string
      date: string
      open_price: number
      high_price: number
      low_price: number
      close_price: number
      volume: number
      adjusted_close: number
      data_source: string
    }> = []

    for (const priceData of historicalPrices) {
      const record = {
        symbol: upperSymbol,
        date: priceData.date,
        open_price: priceData.open_price || 0,
        high_price: priceData.high_price || 0,
        low_price: priceData.low_price || 0,
        close_price: priceData.close_price,
        volume: priceData.volume || 0,
        adjusted_close: priceData.adjusted_close || priceData.close_price,
        data_source: 'alpha_vantage'
      }

      if (existingDates.has(priceData.date)) {
        updateRecords.push(record)
      } else {
        newRecords.push(record)
      }
    }

    // Insert new records in batches
    if (newRecords.length > 0) {
      const batchSize = 1000 // Supabase limit is 1000 rows per insert
      
      for (let i = 0; i < newRecords.length; i += batchSize) {
        const batch = newRecords.slice(i, i + batchSize)
        
        const { error: insertError } = await supabase
          .from('symbol_price_history')
          .insert(batch)

        if (insertError) {
          console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError)
          result.errors.push(`Failed to insert batch ${i / batchSize + 1}: ${insertError.message}`)
        } else {
          result.recordsInserted += batch.length
        }
      }
    }

    // Update existing records (if any)
    for (const record of updateRecords) {
      const { error: updateError } = await supabase
        .from('symbol_price_history')
        .update({
          open_price: record.open_price,
          high_price: record.high_price,
          low_price: record.low_price,
          close_price: record.close_price,
          volume: record.volume,
          adjusted_close: record.adjusted_close,
          data_source: record.data_source
        })
        .eq('symbol', record.symbol)
        .eq('date', record.date)

      if (updateError) {
        console.error(`Error updating record for ${record.date}:`, updateError)
        result.errors.push(`Failed to update ${record.date}: ${updateError.message}`)
      } else {
        result.recordsUpdated++
      }
    }

    result.duplicatesSkipped = historicalPrices.length - result.recordsInserted - result.recordsUpdated

    // Update the symbol's last_price with the most recent data
    if (historicalPrices.length > 0) {
      const mostRecentPrice = historicalPrices[0] // Already sorted by date desc
      
      const { error: symbolUpdateError } = await supabase
        .from('symbols')
        .update({
          last_price: mostRecentPrice.close_price,
          last_updated: new Date().toISOString()
        })
        .eq('symbol', upperSymbol)
        .eq('is_custom', false)

      if (symbolUpdateError) {
        console.error(`Error updating symbol last_price:`, symbolUpdateError)
        result.errors.push(`Failed to update symbol last_price: ${symbolUpdateError.message}`)
      }
    }

    // Finalize result
    result.duration = `${Date.now() - startTime}ms`

    console.log(`🎉 Backfill completed for ${upperSymbol}:`, {
      recordsInserted: result.recordsInserted,
      recordsUpdated: result.recordsUpdated,
      duplicatesSkipped: result.duplicatesSkipped,
      errors: result.errors.length,
      duration: result.duration
    })

    // Log any errors for monitoring
    if (result.errors.length > 0) {
      console.warn('⚠️ Backfill errors:', result.errors)
    }

    return NextResponse.json(result)

  } catch (error) {
    const duration = Date.now() - startTime
    
    console.error('❌ Symbol backfill failed:', error)
    
    return NextResponse.json(
      {
        error: 'Symbol backfill failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`
      },
      { status: 500 }
    )
  }
}

// Only allow POST requests
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed. Use POST with { symbol: "SYMBOL" }' }, { status: 405 })
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed. Use POST with { symbol: "SYMBOL" }' }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed. Use POST with { symbol: "SYMBOL" }' }, { status: 405 })
}