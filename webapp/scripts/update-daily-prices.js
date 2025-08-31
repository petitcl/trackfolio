#!/usr/bin/env node

/**
 * Daily price update script for local testing and manual execution
 * 
 * Usage:
 *   node scripts/update-daily-prices.js
 *   npm run update-daily-prices
 * 
 * This script:
 * - Loads environment variables from .env.local using dotenv
 * - Calls the cron endpoint with proper authorization
 * - Shows detailed response including all results
 */

const fs = require('fs')
const path = require('path')

// Load environment variables using dotenv
function loadEnvFile() {
  const envPath = path.join(__dirname, '../.env.local')
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local file not found')
    console.log('Please create .env.local with the required environment variables')
    process.exit(1)
  }

  // Load environment variables from .env.local
  require('dotenv').config({ path: envPath })
  
  console.log('✅ Environment variables loaded from .env.local')
  return process.env
}

// Check if required environment variables are present
function validateEnv(env) {
  const required = ['CRON_SECRET', 'ALPHA_VANTAGE_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
  const missing = required.filter(key => !env[key] || env[key].includes('your_'))
  
  if (missing.length > 0) {
    console.error('❌ Missing or incomplete environment variables:')
    missing.forEach(key => {
      console.error(`   - ${key}`)
    })
    console.log('\nPlease update your .env.local file with real values')
    process.exit(1)
  }

  console.log('✅ Environment variables validated')
}

// Make the API request
async function testPriceUpdate(baseUrl, cronSecret) {
  const url = `${baseUrl}/api/cron/update-prices`
  const headers = {
    'Authorization': `Bearer ${cronSecret}`,
    'Content-Type': 'application/json'
  }

  console.log(`🔗 Calling: ${url}`)
  console.log(`🔐 Auth: Bearer ${cronSecret.substring(0, 8)}...`)
  console.log('')

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers
    })

    console.log(`📊 Status: ${response.status} ${response.statusText}`)
    
    const data = await response.json()
    
    if (!response.ok) {
      console.error('❌ Request failed:')
      console.error(JSON.stringify(data, null, 2))
      return
    }

    console.log('✅ Success! Response:')
    console.log('')
    
    // Pretty print the response
    if (data.message) {
      console.log(`📝 Message: ${data.message}`)
    }
    
    if (data.date) {
      console.log(`📅 Date: ${data.date}`)
    }
    
    if (data.duration) {
      console.log(`⏱️  Duration: ${data.duration}`)
    }
    
    if (typeof data.total === 'number') {
      console.log(`📈 Total symbols: ${data.total}`)
      console.log(`✅ Successful: ${data.successful || 0}`)
      console.log(`❌ Failed: ${data.failed || 0}`)
    }
    
    if (data.results && data.results.length > 0) {
      console.log('')
      console.log('📋 Detailed Results:')
      
      data.results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌'
        const price = result.price ? `$${result.price.toFixed(2)}` : 'N/A'
        const error = result.error ? ` (${result.error})` : ''
        
        console.log(`   ${index + 1}. ${status} ${result.symbol}: ${price}${error}`)
      })
    }
    
    if (data.results && data.results.length === 0 && data.message === 'Already processed today') {
      console.log('')
      console.log('ℹ️  Price update was already completed for today.')
      console.log('   The system prevents duplicate runs on the same date.')
    }

  } catch (error) {
    console.error('❌ Network error:', error.message)
    
    if (error.code === 'ECONNREFUSED') {
      console.log('')
      console.log('💡 Make sure your local development server is running:')
      console.log('   npm run dev')
    }
  }
}

// Main execution
async function main() {
  console.log('📈 Daily Price Update Script')
  console.log('============================')
  console.log('')

  // Load and validate environment
  const env = loadEnvFile()
  validateEnv(env)

  // Determine base URL
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : process.argv[2] || 'http://localhost:3000'

  console.log(`🌐 Target URL: ${baseUrl}`)
  console.log('')

  // Test the endpoint
  await testPriceUpdate(baseUrl, process.env.CRON_SECRET)
}

// Handle Node.js fetch (for older versions)
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch')
}

// Run the script
main().catch(error => {
  console.error('💥 Script failed:', error)
  process.exit(1)
})