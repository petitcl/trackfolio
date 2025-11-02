'use client'

import React from 'react'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import BulkCsvImport from './BulkCsvImport'
import { multiBulkHoldingImportConfig } from './csv-import-configs'

interface MultiBulkHoldingImportProps {
  user: AuthUser
  onHoldingsImported?: () => void
  onCancel?: () => void
}

export default function MultiBulkHoldingImport({
  user,
  onHoldingsImported,
  onCancel
}: MultiBulkHoldingImportProps) {
  return (
    <BulkCsvImport
      user={user}
      symbol="" // Not used for multi-symbol imports
      config={multiBulkHoldingImportConfig}
      onImported={onHoldingsImported}
      onCancel={onCancel}
    />
  )
}
