'use client'

import React, { useState, useEffect, useRef } from 'react'

interface NumberInputProps {
  value: number | undefined
  onChange: (value: number | undefined) => void
  label?: string
  required?: boolean
  disabled?: boolean
  min?: number
  max?: number
  step?: number
  decimals?: number
  placeholder?: string
  className?: string
  helperText?: string
}

export default function NumberInput({
  value,
  onChange,
  label,
  required = false,
  disabled = false,
  min = 0,
  max,
  step,
  decimals = 2,
  placeholder,
  className = '',
  helperText,
}: NumberInputProps) {
  const [displayValue, setDisplayValue] = useState<string>('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Update display value when value prop changes or focus changes
  useEffect(() => {
    // Format number with thousand separators
    const formatNumber = (num: number): string => {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
      }).format(num)
    }

    if (isFocused) {
      // When focused, show raw numeric value for editing
      if (value === undefined || value === null) {
        setDisplayValue('')
      } else if (value === 0 && required) {
        setDisplayValue('0')
      } else if (value === 0 && !required) {
        setDisplayValue('')
      } else {
        setDisplayValue(value.toString())
      }
    } else {
      // When not focused, show formatted value
      if (value === undefined || value === null) {
        setDisplayValue('')
      } else if (value === 0 && required) {
        setDisplayValue('0')
      } else if (value === 0 && !required) {
        setDisplayValue('')
      } else {
        setDisplayValue(formatNumber(value))
      }
    }
  }, [value, isFocused, required, decimals])

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)

    // If the value is 0 (required field), select all text so typing replaces it
    if (value === 0 && required) {
      setTimeout(() => {
        e.target.select()
      }, 0)
    }
  }

  const handleBlur = () => {
    setIsFocused(false)

    // If input is empty and required, set to 0
    if ((value === undefined || value === null || displayValue === '') && required) {
      onChange(0)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value

    // Allow empty string for optional fields
    if (inputValue === '') {
      setDisplayValue('')
      if (!required) {
        onChange(undefined)
      } else {
        onChange(0)
      }
      return
    }

    // Allow typing negative sign, decimal point, and digits
    if (!/^-?\d*\.?\d*$/.test(inputValue)) {
      return
    }

    setDisplayValue(inputValue)

    // Parse to number
    const numValue = parseFloat(inputValue)

    if (isNaN(numValue)) {
      if (!required) {
        onChange(undefined)
      } else {
        onChange(0)
      }
      return
    }

    // Apply min/max constraints
    let constrainedValue = numValue
    if (min !== undefined && numValue < min) {
      constrainedValue = min
    }
    if (max !== undefined && numValue > max) {
      constrainedValue = max
    }

    onChange(constrainedValue)
  }

  // Prevent mouse wheel from changing the value
  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur()
  }

  const inputClasses = `w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
    disabled ? 'disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed' : ''
  } ${className}`

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onWheel={handleWheel}
        disabled={disabled}
        placeholder={placeholder || (required ? '0' : '')}
        className={inputClasses}
        aria-required={required}
        aria-label={label}
      />
      {helperText && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {helperText}
        </p>
      )}
    </div>
  )
}
