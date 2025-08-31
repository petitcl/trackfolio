#!/usr/bin/env node

/**
 * Environment Variable Loader Utility
 * 
 * Provides shared functionality for loading and validating environment variables
 * from .env.local file across different scripts.
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
function validateEnv(env, requiredVars = ['CRON_SECRET']) {
  const missing = requiredVars.filter(key => !env[key] || env[key].includes('your_'))
  
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

// Load and validate environment variables
function loadAndValidateEnv(requiredVars) {
  const env = loadEnvFile()
  validateEnv(env, requiredVars)
  return env
}

module.exports = {
  loadEnvFile,
  validateEnv,
  loadAndValidateEnv
}