'use client'

import React from 'react'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import BulkCsvImport from './BulkCsvImport'
import { transactionImportConfig } from './csv-import-configs'

interface BulkTransactionImportProps {
  user: AuthUser
  symbol: string
  onTransactionsImported?: () => void
  onCancel?: () => void
}

export default function BulkTransactionImport({ 
  user, 
  symbol, 
  onTransactionsImported, 
  onCancel 
}: BulkTransactionImportProps) {
  return (
    <BulkCsvImport
      user={user}
      symbol={symbol}
      config={transactionImportConfig(symbol)}
      onImported={onTransactionsImported}
      onCancel={onCancel}
    />
  )
}