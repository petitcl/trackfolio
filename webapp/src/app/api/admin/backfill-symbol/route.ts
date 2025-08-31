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
import { priceDataService, type PriceData, type BaseCurrency } from '@/lib/services/priceData.service'
import { 
  createAdminSupabaseClient,
  validateAdminAuth,
  validateAdminEnvironment,
  mapAssetTypeToSymbolType,
  createMethodNotAllowedResponse,
  createErrorResponse,
  createTimer
} from '@/lib/api/admin-auth'

interface BackfillResult {
  symbol: string
  recordsInserted: number
  recordsUpdated: number
  duplicatesSkipped: number
  errors: string[]
  duration: string
  provider?: string
  providerStats?: Array<{ name: string; enabled: boolean; available: boolean; rateLimitDelay: number }>
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
      .select('symbol, name, asset_type, currency, is_custom')
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
        duration: timer.getDuration()
      })
    }

    // Skip asset types that don't have market data (cash, real_estate, other)
    if (!['stock', 'etf', 'crypto', 'currency'].includes(symbolData.asset_type)) {
      console.log(`Skipping non-market asset type: ${upperSymbol} (${symbolData.asset_type})`)
      return NextResponse.json({
        symbol: upperSymbol,
        recordsInserted: 0,
        recordsUpdated: 0,
        duplicatesSkipped: 0,
        errors: [`Skipped: ${upperSymbol} has asset type '${symbolData.asset_type}' which does not have market price data`],
        duration: timer.getDuration()
      })
    }

    // Map asset type to symbol type for the price service
    const symbolType = mapAssetTypeToSymbolType(symbolData.asset_type)
    const baseCurrency: BaseCurrency = (symbolData.currency || 'USD') as BaseCurrency // Use symbol's currency, default to USD
    
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
        duration: timer.getDuration()
      })
    }

    console.log(`✅ Retrieved ${historicalPrices.length} historical price records for ${upperSymbol}`)

    // Determine which provider was used (use the first record's provider)
    const usedProvider = historicalPrices[0]?.provider || 'unknown'
    console.log(`📊 Historical data provided by: ${usedProvider}`)

    // Process and store historical data
    const result: BackfillResult = {
      symbol: upperSymbol,
      recordsInserted: 0,
      recordsUpdated: 0,
      duplicatesSkipped: 0,
      errors: [],
      duration: '',
      provider: usedProvider
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
    result.duration = timer.getDuration()
    result.providerStats = priceDataService.getProviderStats()

    console.log(`🎉 Backfill completed for ${upperSymbol}:`, {
      recordsInserted: result.recordsInserted,
      recordsUpdated: result.recordsUpdated,
      duplicatesSkipped: result.duplicatesSkipped,
      errors: result.errors.length,
      duration: result.duration,
      provider: result.provider
    })

    // Log any errors for monitoring
    if (result.errors.length > 0) {
      console.warn('⚠️ Backfill errors:', result.errors)
    }

    return NextResponse.json(result)

  } catch (error) {
    return createErrorResponse(error, 'Symbol backfill', timer.startTime)
  }
}

// Only allow POST requests
export async function GET() {
  return createMethodNotAllowedResponse('POST', '{ symbol: "SYMBOL" }')
}

export async function PUT() {
  return createMethodNotAllowedResponse('POST', '{ symbol: "SYMBOL" }')
}

export async function DELETE() {
  return createMethodNotAllowedResponse('POST', '{ symbol: "SYMBOL" }')
}