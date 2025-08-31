'use client'

import React, { useState } from 'react'
import type { AuthUser } from '@/lib/auth/client.auth.service'

export interface CsvImportColumn {
  key: string
  label: string
  required: boolean
  description?: string
}

export interface CsvImportConfig<T> {
  title: string
  description: string
  columns: CsvImportColumn[]
  sampleData: string
  parseRow: (values: string[], header: string[]) => T | null
  validateRow: (row: T, index: number) => string | null
  importRows: (user: AuthUser, rows: T[]) => Promise<{ success: number; errors: string[] }>
}

interface BulkCsvImportProps<T> {
  user: AuthUser
  symbol: string
  config: CsvImportConfig<T>
  onImported?: () => void
  onCancel?: () => void
}

export default function BulkCsvImport<T>({ 
  user, 
  symbol, 
  config,
  onImported, 
  onCancel 
}: BulkCsvImportProps<T>) {
  const [csvText, setCsvText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<T[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [importMethod, setImportMethod] = useState<'text' | 'file'>('text')
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFileSelection = (file: File) => {
    const isValidCsv = file.type === 'text/csv' || 
                       file.type === 'application/csv' || 
                       file.type === 'text/plain' ||
                       file.name.toLowerCase().endsWith('.csv')
    
    if (file && isValidCsv) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setCsvText(content)
        parseCSV(content)
      }
      reader.readAsText(file)
      setErrors([])
    } else {
      setErrors([`Invalid file type. Please select a CSV file. (Selected: ${file.name})`])
      setParsedRows([])
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFileSelection(file)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelection(files[0])
    }
  }

  const parseCSV = (csvContent: string) => {
    try {
      const lines = csvContent.trim().split('\n')
      if (lines.length < 2) {
        setErrors(['CSV must contain at least a header and one data row'])
        setParsedRows([])
        return
      }

      const header = lines[0].split(',').map(h => h.trim().toLowerCase())
      const requiredColumns = config.columns.filter(col => col.required).map(col => col.key)
      const missingColumns = requiredColumns.filter(col => !header.includes(col))
      
      if (missingColumns.length > 0) {
        const missingLabels = missingColumns.map(col => 
          config.columns.find(c => c.key === col)?.label || col
        )
        setErrors([`Missing required columns: ${missingLabels.join(', ')}`])
        setParsedRows([])
        return
      }

      const rows: T[] = []
      const parseErrors: string[] = []

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        if (values.length < header.length) {
          parseErrors.push(`Row ${i + 1}: Insufficient columns`)
          continue
        }

        try {
          const row = config.parseRow(values, header)
          if (row) {
            // Validate the parsed row
            const validationError = config.validateRow(row, i + 1)
            if (validationError) {
              parseErrors.push(validationError)
              continue
            }
            rows.push(row)
          }
        } catch (err) {
          parseErrors.push(`Row ${i + 1}: Failed to parse - ${err}`)
        }
      }

      setErrors(parseErrors)
      setParsedRows(rows)
    } catch (err) {
      setErrors([`Failed to parse CSV: ${err}`])
      setParsedRows([])
    }
  }

  const handleImport = async () => {
    if (parsedRows.length === 0) {
      setErrors(['No valid rows to import'])
      return
    }

    setImporting(true)
    try {
      const result = await config.importRows(user, parsedRows)
      
      if (result.errors.length > 0) {
        setErrors(result.errors)
      } else {
        setErrors([])
      }

      console.log(`✅ Successfully imported ${result.success} rows`)
      
      if (result.success > 0) {
        onImported?.()
      }
    } catch (err) {
      setErrors([`Import failed: ${err}`])
    } finally {
      setImporting(false)
    }
  }

  const handleTextChange = (value: string) => {
    setCsvText(value)
    if (value.trim()) {
      parseCSV(value)
    } else {
      setParsedRows([])
      setErrors([])
    }
  }

  const renderPreviewTable = () => {
    if (parsedRows.length === 0) return null

    // Get the first few keys from the first row for table headers
    const sampleRow = parsedRows[0] as any
    const headers = Object.keys(sampleRow).slice(0, 5) // Show first 5 columns

    return (
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Preview ({parsedRows.length} rows)
        </h4>
        <div className="overflow-x-auto max-h-48">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {headers.map((header) => (
                  <th key={header} className="px-2 py-1 text-left text-gray-500 dark:text-gray-400 capitalize">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {parsedRows.slice(0, 5).map((row, index) => (
                <tr key={index}>
                  {headers.map((header) => (
                    <td key={header} className="px-2 py-1 text-gray-900 dark:text-gray-300">
                      {String((row as any)[header] || '-')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {parsedRows.length > 5 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              ... and {parsedRows.length - 5} more rows
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg border dark:border-gray-700">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{config.title}</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {config.description}
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Import Method Selection */}
        <div className="flex space-x-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="text"
              checked={importMethod === 'text'}
              onChange={(e) => setImportMethod(e.target.value as 'text')}
              className="mr-2"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Paste CSV Text</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="file"
              checked={importMethod === 'file'}
              onChange={(e) => setImportMethod(e.target.value as 'file')}
              className="mr-2"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Upload CSV File</span>
          </label>
        </div>

        {/* CSV Format Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">CSV Format</h4>
          <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <p>
              <strong>Required columns:</strong> {config.columns.filter(c => c.required).map(c => c.label).join(', ')}
            </p>
            <p>
              <strong>Optional columns:</strong> {config.columns.filter(c => !c.required).map(c => c.label).join(', ') || 'None'}
            </p>
          </div>
        </div>

        {/* Sample Data */}
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sample Format</h4>
          <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
            {config.sampleData}
          </pre>
        </div>

        {/* Input Area */}
        {importMethod === 'file' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select CSV File
            </label>
            <div 
              className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors ${
                isDragOver 
                  ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="space-y-1 text-center">
                <svg
                  className={`mx-auto h-12 w-12 ${
                    isDragOver ? 'text-blue-500' : 'text-gray-400'
                  }`}
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className={`flex text-sm ${
                  isDragOver 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  <label
                    htmlFor="file-upload"
                    className={`relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500 ${
                      isDragOver 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    <span>{isDragOver ? 'Drop CSV file here' : 'Upload a file'}</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                  </label>
                  {!isDragOver && <p className="pl-1">or drag and drop</p>}
                </div>
                <p className={`text-xs ${
                  isDragOver 
                    ? 'text-blue-500 dark:text-blue-400' 
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  CSV files up to 10MB
                </p>
              </div>
            </div>
            {selectedFile && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              CSV Text
            </label>
            <textarea
              value={csvText}
              onChange={(e) => handleTextChange(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Paste your CSV content here..."
            />
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <h4 className="text-sm font-medium text-red-900 dark:text-red-200 mb-2">Import Errors</h4>
            <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
              {errors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Preview */}
        {renderPreviewTable()}

        {/* Action Buttons */}
        <div className="flex justify-between">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          
          <button
            onClick={handleImport}
            disabled={importing || parsedRows.length === 0 || errors.length > 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? 'Importing...' : `Import ${parsedRows.length} Rows`}
          </button>
        </div>
      </div>
    </div>
  )
}