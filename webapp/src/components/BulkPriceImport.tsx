'use client'

import React from 'react'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import BulkCsvImport from './BulkCsvImport'
import { priceImportConfig } from './csv-import-configs'

interface BulkPriceImportProps {
  user: AuthUser
  symbol: string
  onPricesImported?: () => void
  onCancel?: () => void
}

export default function BulkPriceImport({ user, symbol, onPricesImported, onCancel }: BulkPriceImportProps) {
  return (
    <BulkCsvImport
      user={user}
      symbol={symbol}
      config={priceImportConfig(symbol)}
      onImported={onPricesImported}
      onCancel={onCancel}
    />
  )
}