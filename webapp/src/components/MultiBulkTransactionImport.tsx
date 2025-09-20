'use client'

import React from 'react'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import BulkCsvImport from './BulkCsvImport'
import { multiBulkTransactionImportConfig } from './csv-import-configs'

interface MultiBulkTransactionImportProps {
  user: AuthUser
  onTransactionsImported?: () => void
  onCancel?: () => void
}

export default function MultiBulkTransactionImport({ 
  user, 
  onTransactionsImported, 
  onCancel 
}: MultiBulkTransactionImportProps) {
  return (
    <BulkCsvImport
      user={user}
      symbol="" // Not used for multi-symbol imports
      config={multiBulkTransactionImportConfig}
      onImported={onTransactionsImported}
      onCancel={onCancel}
    />
  )
}