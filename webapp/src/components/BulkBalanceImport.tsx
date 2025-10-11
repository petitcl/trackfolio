'use client'

import React from 'react'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import BulkCsvImport from './BulkCsvImport'
import { accountBalanceImportConfig } from './csv-import-configs'

interface BulkBalanceImportProps {
  user: AuthUser
  symbol: string
  onBalancesImported?: () => void
  onCancel?: () => void
}

export default function BulkBalanceImport({ user, symbol, onBalancesImported, onCancel }: BulkBalanceImportProps) {
  return (
    <BulkCsvImport
      user={user}
      symbol={symbol}
      config={accountBalanceImportConfig(symbol)}
      onImported={onBalancesImported}
      onCancel={onCancel}
    />
  )
}
