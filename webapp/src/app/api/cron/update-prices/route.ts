/**
 * Vercel Cron Job: Daily Market Price Updates
 * 
 * This endpoint is called by Vercel's cron scheduler to update market prices
 * for all non-custom symbols in the database.
 * 
 * Security: Uses authorization header validation
 * Rate Limiting: Respects Alpha Vantage API limits (25 req/day free tier)
 * 
 * Schedule: Daily at 9 PM UTC (4 PM EST, after market close)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { priceDataService } from '@/lib/services/priceData.service'
import type { Database } from '@/lib/supabase/types'

// Initialize Supabase client with service role for cron jobs
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

interface UpdateResult {
  symbol: string
  success: boolean
  error?: string
  price?: number
  date?: string
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const isLocal = process.env.NODE_ENV === 'development'
  
  try {
    // Security: Validate cron authorization
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`
    
    if (!authHeader || authHeader !== expectedAuth) {
      const errorDetail = isLocal ? {
        received: authHeader,
        expected: expectedAuth,
        cronSecretConfigured: !!process.env.CRON_SECRET
      } : {}
      
      console.error('Unauthorized cron request - invalid authorization header', errorDetail)
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

    console.log('🕒 Starting daily price update job...')

    // Check if we've already run today to prevent duplicate runs
    const today = new Date().toISOString().split('T')[0]
    const { data: existingRun } = await supabase
      .from('symbol_price_history')
      .select('id')
      .eq('date', today)
      .limit(1)

    if (existingRun && existingRun.length > 0) {
      console.log('✅ Price update already completed for today')
      return NextResponse.json({
        message: 'Already processed today',
        date: today
      })
    }

    // Get all non-custom symbols that need price updates
    const { data: symbols, error: symbolsError } = await supabase
      .from('symbols')
      .select('symbol, name, asset_type')
      .eq('is_custom', false)
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

    console.log(`📈 Found ${symbols.length} symbols to update:`, symbols.map(s => s.symbol))

    // Fetch current quotes for all symbols (with rate limiting)
    const symbolList = symbols.map(s => s.symbol)
    const quotes = await priceDataService.fetchMultipleQuotes(symbolList)
    
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
          data_source: 'alpha_vantage'
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
          date: quote.lastUpdated
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

    // Batch insert price history data
    if (priceHistoryInserts.length > 0) {
      const { error: historyError } = await supabase
        .from('symbol_price_history')
        .insert(priceHistoryInserts)

      if (historyError) {
        console.error('Error inserting price history:', historyError)
        throw new Error(`Failed to insert price history: ${historyError.message}`)
      }

      console.log(`💾 Inserted ${priceHistoryInserts.length} price history records`)
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
    const duration = Date.now() - startTime

    const summary = {
      message: 'Daily price update completed',
      date: today,
      duration: `${duration}ms`,
      total: results.length,
      successful,
      failed,
      results: results
    }

    console.log('🎉 Daily price update job completed:', {
      total: results.length,
      successful,
      failed,
      duration: `${duration}ms`
    })

    // Log any failures for monitoring
    if (failed > 0) {
      const failures = results.filter(r => !r.success)
      console.warn('⚠️ Failed price updates:', failures)
    }

    return NextResponse.json(summary)

  } catch (error) {
    const duration = Date.now() - startTime
    
    console.error('❌ Daily price update job failed:', error)
    
    return NextResponse.json(
      {
        error: 'Price update job failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`
      },
      { status: 500 }
    )
  }
}

// Only allow GET requests
export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}