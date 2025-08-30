'use client'

import React from 'react'

interface FormFieldProps {
  label: string
  children: React.ReactNode
  required?: boolean
  error?: string
  description?: string
  className?: string
}

export default function FormField({
  label,
  children,
  required = false,
  error,
  description,
  className = '',
}: FormFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {description}
        </p>
      )}
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

interface InputFieldProps {
  type?: 'text' | 'number' | 'email' | 'password' | 'date' | 'tel' | 'url'
  value: string | number
  onChange: (value: string | number) => void
  placeholder?: string
  required?: boolean
  min?: string | number
  max?: string | number
  step?: string | number
  className?: string
  disabled?: boolean
}

export function InputField({
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  min,
  max,
  step,
  className = '',
  disabled = false,
}: InputFieldProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (type === 'number') {
      const numValue = parseFloat(e.target.value)
      onChange(isNaN(numValue) ? 0 : numValue)
    } else {
      onChange(e.target.value)
    }
  }

  return (
    <input
      type={type}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      required={required}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    />
  )
}

interface SelectFieldProps {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  required?: boolean
  className?: string
  disabled?: boolean
}

export function SelectField({
  value,
  onChange,
  options,
  required = false,
  className = '',
  disabled = false,
}: SelectFieldProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled}
      className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

interface TextAreaFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  rows?: number
  className?: string
  disabled?: boolean
}

export function TextAreaField({
  value,
  onChange,
  placeholder,
  required = false,
  rows = 3,
  className = '',
  disabled = false,
}: TextAreaFieldProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      rows={rows}
      disabled={disabled}
      className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    />
  )
}