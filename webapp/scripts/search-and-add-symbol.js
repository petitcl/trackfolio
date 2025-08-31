#!/usr/bin/env node

/**
 * Symbol Search and Add Script
 * 
 * This script helps you search for symbols and add them to your database.
 * 
 * Usage:
 *   node scripts/search-and-add-symbol.js search "apple"
 *   node scripts/search-and-add-symbol.js add AAPL
 *   node scripts/search-and-add-symbol.js add AAPL "Apple Inc." USD
 */

const https = require('https')
const http = require('http')
const { loadAndValidateEnv } = require('./env-loader')

// Load and validate environment variables
const env = loadAndValidateEnv(['CRON_SECRET'])

// Parse command line arguments
const baseUrl = process.argv[2] || 'http://localhost:3000'
const command = process.argv[3] // 'search' or 'add'
const searchTerm = process.argv[4]
const symbolName = process.argv[5] // optional for add command
const currency = process.argv[6] // optional for add command

if (!command || !searchTerm) {
  console.error('❌ Error: Command and search term/symbol are required')
  console.log('')
  console.log('Usage:')
  console.log('  Search: node scripts/search-and-add-symbol.js [BASE_URL] search "company name"')
  console.log('  Add:    node scripts/search-and-add-symbol.js [BASE_URL] add SYMBOL ["Company Name"] [CURRENCY]')
  console.log('')
  console.log('Examples:')
  console.log('  node scripts/search-and-add-symbol.js http://localhost:3000 search "apple"')
  console.log('  node scripts/search-and-add-symbol.js https://trackfolio.vercel.app search "microsoft"')
  console.log('  node scripts/search-and-add-symbol.js http://localhost:3000 add AAPL')
  console.log('  node scripts/search-and-add-symbol.js https://trackfolio.vercel.app add MSFT "Microsoft Corporation" USD')
  console.log('  node scripts/search-and-add-symbol.js http://localhost:3000 add BTC "Bitcoin" USD')
  process.exit(1)
}

if (!['search', 'add'].includes(command)) {
  console.error('❌ Error: Command must be "search" or "add"')
  process.exit(1)
}

// Configuration
const CRON_SECRET = env.CRON_SECRET

console.log(`🔍 ${command === 'search' ? 'Searching for' : 'Adding'} symbol: ${searchTerm}`)
console.log(`📡 Target: ${baseUrl}`)
console.log(`🕒 Started at: ${new Date().toISOString()}`)
console.log('')

// Create HTTP request
async function makeRequest(endpoint, method = 'GET', body = null) {
  const url = new URL(`${baseUrl}${endpoint}`)
  const isHttps = url.protocol === 'https:'
  const httpModule = isHttps ? https : http

  const postData = body ? JSON.stringify(body) : null

  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    method,
    headers: {
      'Authorization': `Bearer ${CRON_SECRET}`,
      'Content-Type': 'application/json'
    }
  }

  if (postData) {
    options.headers['Content-Length'] = Buffer.byteLength(postData)
  }

  return new Promise((resolve, reject) => {
    const req = httpModule.request(options, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          resolve({ status: res.statusCode, data: result })
        } catch (parseError) {
          reject(new Error(`Parse error: ${data}`))
        }
      })
    })

    req.on('error', reject)
    req.setTimeout(30000) // 30 second timeout

    if (postData) {
      req.write(postData)
    }
    
    req.end()
  })
}

// Main execution
async function main() {
  try {
    if (command === 'search') {
      // Search for symbols
      const endpoint = `/api/admin/search-symbols?keywords=${encodeURIComponent(searchTerm)}`
      console.log(`🔍 Searching: ${endpoint}`)
      
      const response = await makeRequest(endpoint)
      
      if (response.status !== 200) {
        console.error('❌ Search failed!')
        console.error(`Status: ${response.status}`)
        console.error(`Error: ${response.data.error || 'Unknown error'}`)
        return
      }

      const results = response.data.results || []
      
      console.log('✅ Search completed!')
      console.log(`📊 Found ${results.length} matches for "${searchTerm}"`)
      console.log(`⏱️ Duration: ${response.data.duration}`)
      
      // Show provider statistics if available
      if (response.data.providerStats && response.data.providerStats.length > 0) {
        console.log('')
        console.log('🔧 Provider Status:')
        response.data.providerStats.forEach(provider => {
          const enabledIcon = provider.enabled ? '🟢' : '🔴'
          const status = provider.available ? '✅' : '❌'
          const delay = provider.rateLimitDelay ? ` (${provider.rateLimitDelay}ms delay)` : ''
          console.log(`   ${enabledIcon} ${status} ${provider.name}${delay}`)
        })
      }

      // Show results by provider if available
      if (response.data.resultsByProvider && response.data.resultsByProvider.length > 0) {
        console.log('')
        console.log('📊 Results by Provider:')
        response.data.resultsByProvider.forEach(providerGroup => {
          console.log(`   ${providerGroup.provider}: ${providerGroup.count} results`)
        })
      }
      
      console.log('')

      if (results.length === 0) {
        console.log('💡 No symbols found. Try different keywords or check spelling.')
        return
      }

      console.log('🎯 Search Results:')
      
      // Calculate optimal column widths based on content
      const symbolWidth = Math.max(6, ...results.map(r => r.symbol.length)) + 2
      const nameWidth = Math.max(12, ...results.map(r => r.name.length > 30 ? 30 : r.name.length)) + 2
      const typeWidth = Math.max(4, ...results.map(r => r.type.length)) + 2
      const regionWidth = Math.max(6, ...results.map(r => r.region.length)) + 2
      const currencyWidth = Math.max(8, ...results.map(r => (r.currency || 'USD').length)) + 2
      const providerWidth = Math.max(8, ...results.map(r => (r.provider || 'unknown').length))
      
      const totalWidth = symbolWidth + nameWidth + typeWidth + regionWidth + currencyWidth + providerWidth
      
      console.log(''.padEnd(totalWidth, '='))
      console.log('Symbol'.padEnd(symbolWidth) + 'Company Name'.padEnd(nameWidth) + 'Type'.padEnd(typeWidth) + 'Region'.padEnd(regionWidth) + 'Currency'.padEnd(currencyWidth) + 'Provider')
      console.log(''.padEnd(totalWidth, '-'))

      results.forEach((result, index) => {
        const symbol = result.symbol.padEnd(symbolWidth)
        const name = result.name.length > nameWidth - 5 ? 
          (result.name.substring(0, nameWidth - 5) + '...').padEnd(nameWidth) : 
          result.name.padEnd(nameWidth)
        const type = result.type.padEnd(typeWidth)
        const region = result.region.padEnd(regionWidth)
        const currency = (result.currency || 'USD').padEnd(currencyWidth)
        const provider = (result.provider || 'unknown').padEnd(providerWidth)
        
        console.log(`${symbol}${name}${type}${region}${currency}${provider}`)
      })

      console.log(''.padEnd(totalWidth, '='))
      console.log('')
      console.log('💡 To add a symbol, use:')
      console.log(`   node scripts/search-and-add-symbol.js ${baseUrl} add ${results[0].symbol}`)

    } else if (command === 'add') {
      // Add symbol
      const endpoint = `/api/admin/add-symbol`
      const requestBody = {
        symbol: searchTerm.toUpperCase(),
        ...(symbolName && { name: symbolName }),
        ...(currency && { currency: currency.toUpperCase() })
      }
      
      console.log(`➕ Adding symbol: ${JSON.stringify(requestBody, null, 2)}`)
      
      const response = await makeRequest(endpoint, 'POST', requestBody)
      
      if (response.status !== 200) {
        console.error('❌ Add symbol failed!')
        console.error(`Status: ${response.status}`)
        console.error(`Error: ${response.data.error || 'Unknown error'}`)
        return
      }

      const result = response.data
      
      console.log('✅ Add symbol completed!')
      console.log('')
      console.log('📋 Symbol Details:')
      console.log(`   Symbol: ${result.symbol}`)
      console.log(`   Name: ${result.name}`)
      console.log(`   Asset Type: ${result.assetType}`)
      console.log(`   Currency: ${result.currency}`)
      console.log(`   Current Price: ${result.currentPrice ? '$' + result.currentPrice.toFixed(2) : 'N/A'}`)
      console.log(`   Added: ${result.added ? 'Yes' : 'No (already existed)'}`)
      console.log(`   Duration: ${result.duration}`)
      
      // Show provider information if available
      if (result.searchProvider || result.priceProvider) {
        console.log('')
        console.log('🔧 Provider Information:')
        if (result.searchProvider) {
          console.log(`   Search Provider: ${result.searchProvider}`)
        }
        if (result.priceProvider) {
          console.log(`   Price Provider: ${result.priceProvider}`)
        }
      }

      // Show provider statistics if available
      if (result.providerStats && result.providerStats.length > 0) {
        console.log('')
        console.log('📊 Provider Status:')
        result.providerStats.forEach(provider => {
          const enabledIcon = provider.enabled ? '🟢' : '🔴'
          const status = provider.available ? '✅' : '❌'
          const delay = provider.rateLimitDelay ? ` (${provider.rateLimitDelay}ms delay)` : ''
          console.log(`   ${enabledIcon} ${status} ${provider.name}${delay}`)
        })
      }

      if (result.added) {
        console.log('')
        console.log('🎉 Symbol successfully added to database!')
        console.log('💡 You can now:')
        console.log(`   - Add transactions for ${result.symbol}`)
        console.log(`   - Backfill historical data: node scripts/backfill-symbol.js ${baseUrl} ${result.symbol}`)
      } else if (result.alreadyExists) {
        console.log('')
        console.log('ℹ️  Symbol already exists in database.')
      }
    }

  } catch (error) {
    console.error('❌ Request failed:', error.message)
    
    if (error.code === 'ECONNREFUSED') {
      console.log('')
      console.log('💡 Make sure your development server is running:')
      console.log('   npm run dev')
    }
    
    process.exit(1)
  }
}

// Run the script
main().catch(error => {
  console.error('💥 Script failed:', error)
  process.exit(1)
})