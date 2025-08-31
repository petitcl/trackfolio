#!/usr/bin/env node

/**
 * Backfill Symbol Price History Script
 * 
 * Fetches and stores historical price data for a single symbol.
 * Usage: node scripts/backfill-symbol.js [BASE_URL] <SYMBOL>
 * 
 * Examples:
 *   node scripts/backfill-symbol.js http://localhost:3000 AAPL
 *   node scripts/backfill-symbol.js https://trackfolio.vercel.app MSFT
 *   node scripts/backfill-symbol.js https://trackfolio.vercel.app BTC
 */

const https = require('https')
const http = require('http')
const { loadAndValidateEnv } = require('./env-loader')

// Load and validate environment variables
const env = loadAndValidateEnv(['CRON_SECRET'])

// Parse command line arguments
const baseUrl = process.argv[2] || 'http://localhost:3000'
const symbol = process.argv[3]

if (!symbol) {
  console.error('❌ Error: Symbol is required')
  console.log('Usage: node scripts/backfill-symbol.js [BASE_URL] <SYMBOL>')
  console.log('Examples:')
  console.log('  node scripts/backfill-symbol.js http://localhost:3000 AAPL')
  console.log('  node scripts/backfill-symbol.js https://trackfolio.vercel.app MSFT')
  console.log('  node scripts/backfill-symbol.js https://trackfolio.vercel.app BTC')
  process.exit(1)
}

// Configuration
const CRON_SECRET = env.CRON_SECRET
const endpoint = `${baseUrl}/api/admin/backfill-symbol`

console.log(`🔄 Starting symbol backfill for: ${symbol}`)
console.log(`📡 Target endpoint: ${endpoint}`)
console.log(`🕒 Started at: ${new Date().toISOString()}`)

// Create HTTP request
const url = new URL(endpoint)
const isHttps = url.protocol === 'https:'
const httpModule = isHttps ? https : http

const postData = JSON.stringify({ symbol })

const options = {
  hostname: url.hostname,
  port: url.port || (isHttps ? 443 : 80),
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Authorization': `Bearer ${CRON_SECRET}`
  }
}

const req = httpModule.request(options, (res) => {
  let data = ''
  
  res.on('data', (chunk) => {
    data += chunk
  })
  
  res.on('end', () => {
    const endTime = new Date()
    
    try {
      const result = JSON.parse(data)
      
      if (res.statusCode === 200) {
        console.log('✅ Backfill completed successfully!')
        console.log(`📊 Symbol: ${result.symbol}`)
        console.log(`📈 Records inserted: ${result.recordsInserted || 0}`)
        console.log(`🔄 Records updated: ${result.recordsUpdated || 0}`)
        console.log(`⚠️ Skipped (duplicates): ${result.duplicatesSkipped || 0}`)
        console.log(`⏱️ Duration: ${result.duration}`)
        console.log(`🕒 Completed at: ${endTime.toISOString()}`)
        
        if (result.errors && result.errors.length > 0) {
          console.log('\n⚠️ Warnings/Errors:')
          result.errors.forEach((error, index) => {
            console.log(`  ${index + 1}. ${error}`)
          })
        }
      } else {
        console.error('❌ Backfill failed!')
        console.error(`Status: ${res.statusCode}`)
        console.error(`Error: ${result.error || 'Unknown error'}`)
        
        if (result.details) {
          console.error('Details:', result.details)
        }
        
        process.exit(1)
      }
    } catch (parseError) {
      console.error('❌ Error parsing response:')
      console.error('Status:', res.statusCode)
      console.error('Raw response:', data)
      process.exit(1)
    }
  })
})

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message)
  process.exit(1)
})

req.on('timeout', () => {
  console.error('❌ Request timed out')
  req.destroy()
  process.exit(1)
})

// Set timeout for long-running requests (5 minutes)
req.setTimeout(5 * 60 * 1000)

// Send the request
req.write(postData)
req.end()