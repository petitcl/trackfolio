'use client'

import React, { useState, useRef } from 'react'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import { portfolioService } from '@/lib/services/portfolio.service'

interface BulkPriceImportProps {
  user: AuthUser
  symbol: string
  onPricesImported?: () => void
  onCancel?: () => void
}

interface CsvPriceData {
  symbol: string
  date: string
  price: number
  notes?: string
}

export default function BulkPriceImport({ user, symbol, onPricesImported, onCancel }: BulkPriceImportProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [csvData, setCsvData] = useState<string>('')
  const [parsedData, setParsedData] = useState<CsvPriceData[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sampleCsvData = `symbol,date,price,notes
${symbol},2024-01-15,100.00,Initial valuation
${symbol},2024-02-15,105.50,Market update
${symbol},2024-03-15,98.75,Quarterly review`

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setCsvData(content)
      parseCsvData(content)
    }
    reader.readAsText(file)
  }

  const handleCsvTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setCsvData(value)
    if (value.trim()) {
      parseCsvData(value)
    } else {
      setParsedData([])
      setShowPreview(false)
    }
  }

  const parseCsvData = (csvContent: string) => {
    try {
      setError(null)
      const lines = csvContent.trim().split('\n')
      
      if (lines.length < 2) {
        setError('CSV must contain at least a header and one data row')
        return
      }

      const header = lines[0].toLowerCase().split(',').map(h => h.trim())
      const requiredColumns = ['symbol', 'date', 'price']
      const missingColumns = requiredColumns.filter(col => !header.includes(col))
      
      if (missingColumns.length > 0) {
        setError(`Missing required columns: ${missingColumns.join(', ')}`)
        return
      }

      const symbolIndex = header.indexOf('symbol')
      const dateIndex = header.indexOf('date')
      const priceIndex = header.indexOf('price')
      const notesIndex = header.indexOf('notes')

      const parsed: CsvPriceData[] = []
      const errors: string[] = []

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue // Skip empty lines

        const columns = line.split(',').map(col => col.trim())
        
        if (columns.length < requiredColumns.length) {
          errors.push(`Row ${i + 1}: Not enough columns`)
          continue
        }

        const rowSymbol = columns[symbolIndex]
        const dateStr = columns[dateIndex]
        const priceStr = columns[priceIndex]
        const notes = notesIndex >= 0 && columns[notesIndex] ? columns[notesIndex] : undefined

        // Validate symbol matches current holding
        if (rowSymbol !== symbol) {
          errors.push(`Row ${i + 1}: Symbol "${rowSymbol}" doesn't match current holding "${symbol}"`)
          continue
        }

        // Validate date format
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) {
          errors.push(`Row ${i + 1}: Invalid date format "${dateStr}"`)
          continue
        }

        // Validate future dates
        const today = new Date()
        today.setHours(23, 59, 59, 999)
        if (date > today) {
          errors.push(`Row ${i + 1}: Date cannot be in the future`)
          continue
        }

        // Validate price
        const price = parseFloat(priceStr)
        if (isNaN(price) || price <= 0) {
          errors.push(`Row ${i + 1}: Invalid price "${priceStr}"`)
          continue
        }

        parsed.push({
          symbol: rowSymbol,
          date: dateStr,
          price: price,
          notes: notes
        })
      }

      if (errors.length > 0) {
        setError(`Validation errors:\n${errors.join('\n')}`)
        return
      }

      if (parsed.length === 0) {
        setError('No valid price entries found in CSV')
        return
      }

      setParsedData(parsed)
      setShowPreview(true)
    } catch (err) {
      console.error('Error parsing CSV:', err)
      setError('Failed to parse CSV data')
    }
  }

  const handleImport = async () => {
    if (parsedData.length === 0) return

    try {
      setLoading(true)
      setError(null)

      for (const priceData of parsedData) {
        await portfolioService.addUserSymbolPrice(user, {
          symbol: priceData.symbol,
          manual_price: priceData.price,
          price_date: priceData.date,
          notes: priceData.notes || null
        })
      }

      // Reset form
      setCsvData('')
      setParsedData([])
      setShowPreview(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      onPricesImported?.()
    } catch (err) {
      console.error('Error importing prices:', err)
      setError('Failed to import prices. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg border dark:border-gray-700">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Bulk Price Import</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Import multiple price entries via CSV for {symbol}
        </p>
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4">
            <div className="text-sm text-red-700 dark:text-red-300 whitespace-pre-line">{error}</div>
          </div>
        )}

        {/* CSV Format Info */}
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">CSV Format</h4>
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
            Required columns: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">symbol</code>, 
            <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded ml-1">date</code>, 
            <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded ml-1">price</code>. 
            Optional: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded ml-1">notes</code>
          </p>
          <details className="text-sm">
            <summary className="cursor-pointer text-blue-800 dark:text-blue-200 hover:underline">
              View sample CSV format
            </summary>
            <pre className="mt-2 bg-blue-100 dark:bg-blue-800 p-2 rounded text-xs overflow-x-auto">
{sampleCsvData}
            </pre>
          </details>
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Upload CSV File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-200 dark:hover:file:bg-blue-800"
          />
        </div>

        <div className="text-center text-gray-500 dark:text-gray-400 text-sm">or</div>

        {/* Manual CSV Input */}
        <div>
          <label htmlFor="csv-data" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Paste CSV Data
          </label>
          <textarea
            id="csv-data"
            value={csvData}
            onChange={handleCsvTextChange}
            rows={8}
            placeholder="Paste your CSV data here..."
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
          />
        </div>

        {/* Preview Table */}
        {showPreview && parsedData.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Preview ({parsedData.length} entries)
            </h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {parsedData.slice(0, 5).map((row, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {new Date(row.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {formatCurrency(row.price)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {row.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedData.length > 5 && (
                <div className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                  ... and {parsedData.length - 5} more entries
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleImport}
            disabled={loading || parsedData.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Importing...' : `Import ${parsedData.length} Prices`}
          </button>
        </div>
      </div>
    </div>
  )
}