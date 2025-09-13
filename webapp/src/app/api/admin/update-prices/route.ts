/**
 * Admin API: Daily Market Price Updates
 * 
 * This endpoint updates market prices for all non-custom symbols in the database.
 * Can be called by Vercel's cron scheduler or manually for admin operations.
 * 
 * Security: Uses authorization header validation
 * Rate Limiting: Respects Alpha Vantage API limits (25 req/day free tier)
 * 
 * Schedule: Daily at 9 PM UTC (4 PM EST, after market close)
 */

import { NextRequest, NextResponse } from 'next/server'
import { priceDataService, type SymbolType, type BaseCurrency } from '@/lib/services/priceData.service'
import { 
  createAdminSupabaseClient,
  validateAdminAuth,
  validateAdminEnvironment,
  mapAssetTypeToSymbolType,
  createMethodNotAllowedResponse,
  createErrorResponse,
  createTimer
} from '@/lib/api/admin-auth'

interface UpdateResult {
  symbol: string
  success: boolean
  error?: string
  price?: number
  date?: string
  provider?: string
}

export async function GET(request: NextRequest) {
  const timer = createTimer()
  const supabase = createAdminSupabaseClient()
  
  try {
    // Security validation
    const authError = validateAdminAuth(request)
    if (authError) return authError
    
    const envError = validateAdminEnvironment()
    if (envError) return envError

    console.log('🕒 Starting daily price update job...')

    // Check if we've already run today to prevent duplicate runs
    const today = new Date().toISOString().split('T')[0]
    // const { data: existingRun } = await supabase
    //   .from('symbol_price_history')
    //   .select('id')
    //   .eq('date', today)
    //   .limit(1)

    // if (existingRun && existingRun.length > 0) {
    //   console.log('✅ Price update already completed for today')
    //   return NextResponse.json({
    //     message: 'Already processed today',
    //     date: today
    //   })
    // }

    // Get all non-custom symbols that need price updates (only market-data symbols)
    const { data: symbols, error: symbolsError } = await supabase
      .from('symbols')
      .select('symbol, name, asset_type, currency')
      .eq('is_custom', false)
      .in('asset_type', ['stock', 'crypto', 'currency'])
      .order('symbol')

    if (symbolsError) {
      throw new Error(`Failed to fetch symbols: ${symbolsError.message}`)
    }

    if (!symbols || symbols.length === 0) {
      console.log('📊 No symbols found for price updates')
      return NextResponse.json({
        message: 'No symbols to update',
        processed: 0
      })
    }

    console.log(`📈 Found ${symbols.length} symbols to update:`, symbols.map(s => `${s.symbol} (${s.asset_type})`))

    // Fetch current quotes for all symbols (with rate limiting)
    const symbolData = symbols.map(s => {
      try {
        return {
          symbol: s.symbol,
          symbolType: mapAssetTypeToSymbolType(s.asset_type),
          baseCurrency: (s.currency || 'USD') as BaseCurrency // Use symbol's currency, default to USD
        }
      } catch (error) {
        console.error(`Skipping ${s.symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        return null
      }
    }).filter(Boolean) as Array<{ symbol: string; symbolType: SymbolType; baseCurrency: BaseCurrency }>

    console.log(`📊 Processing ${symbolData.length} valid symbols for price updates`)
    const quotes = await priceDataService.fetchMultipleQuotes(symbolData)
    
    console.log(`✅ Retrieved ${quotes.size} quotes from Alpha Vantage`)

    // Process results and update database
    const results: UpdateResult[] = []
    const priceHistoryInserts = []
    const symbolUpdates = []

    for (const symbol of symbols) {
      const quote = quotes.get(symbol.symbol)
      
      if (!quote) {
        results.push({
          symbol: symbol.symbol,
          success: false,
          error: 'No quote data received'
        })
        continue
      }

      try {
        // Prepare price history insert
        priceHistoryInserts.push({
          symbol: symbol.symbol,
          date: today, // Use today's date for consistency
          close_price: quote.price,
          data_source: quote.provider || 'unknown'
        })

        // Prepare symbol last_price update
        symbolUpdates.push({
          symbol: symbol.symbol,
          last_price: quote.price,
          last_updated: new Date().toISOString()
        })

        results.push({
          symbol: symbol.symbol,
          success: true,
          price: quote.price,
          date: quote.lastUpdated,
          provider: quote.provider
        })

      } catch (error) {
        console.error(`Error processing ${symbol.symbol}:`, error)
        results.push({
          symbol: symbol.symbol,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Batch upsert price history data (insert or update on conflict)
    if (priceHistoryInserts.length > 0) {
      const { error: historyError } = await supabase
        .from('symbol_price_history')
        .upsert(priceHistoryInserts, { 
          onConflict: 'symbol,date',
          ignoreDuplicates: false // This ensures updates happen on conflict
        })

      if (historyError) {
        console.error('Error upserting price history:', historyError)
        throw new Error(`Failed to upsert price history: ${historyError.message}`)
      }

      console.log(`💾 Upserted ${priceHistoryInserts.length} price history records`)
    }

    // Batch update symbol last_price
    for (const update of symbolUpdates) {
      const { error: updateError } = await supabase
        .from('symbols')
        .update({
          last_price: update.last_price,
          last_updated: update.last_updated
        })
        .eq('symbol', update.symbol)
        .eq('is_custom', false)

      if (updateError) {
        console.error(`Error updating symbol ${update.symbol}:`, updateError)
      }
    }

    console.log(`🔄 Updated last_price for ${symbolUpdates.length} symbols`)

    // Summary
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    // Group results by provider for statistics
    const providerStats = priceDataService.getProviderStats()
    const resultsByProvider = results.reduce((acc, result) => {
      if (result.success && result.provider) {
        const provider = result.provider
        if (!acc[provider]) acc[provider] = 0
        acc[provider]++
      }
      return acc
    }, {} as Record<string, number>)

    const summary = {
      message: 'Daily price update completed',
      date: today,
      duration: timer.getDuration(),
      total: results.length,
      successful,
      failed,
      providerStats,
      resultsByProvider,
      results: results
    }

    console.log('🎉 Daily price update job completed:', {
      total: results.length,
      successful,
      failed,
      duration: timer.getDuration()
    })

    // Log any failures for monitoring
    if (failed > 0) {
      const failures = results.filter(r => !r.success)
      console.warn('⚠️ Failed price updates:', failures)
    }

    return NextResponse.json(summary)

  } catch (error) {
    return createErrorResponse(error, 'Price update job', timer.startTime)
  }
}

// Only allow GET requests
export async function POST() {
  return createMethodNotAllowedResponse('GET')
}

export async function PUT() {
  return createMethodNotAllowedResponse('GET')
}

export async function DELETE() {
  return createMethodNotAllowedResponse('GET')
}