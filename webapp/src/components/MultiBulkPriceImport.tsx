'use client'

import React from 'react'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import BulkCsvImport from './BulkCsvImport'
import { multiBulkPriceImportConfig } from './csv-import-configs'

interface MultiBulkPriceImportProps {
  user: AuthUser
  onPricesImported?: () => void
  onCancel?: () => void
}

export default function MultiBulkPriceImport({ 
  user, 
  onPricesImported, 
  onCancel 
}: MultiBulkPriceImportProps) {
  return (
    <BulkCsvImport
      user={user}
      symbol="" // Not used for multi-symbol imports
      config={multiBulkPriceImportConfig}
      onImported={onPricesImported}
      onCancel={onCancel}
    />
  )
}