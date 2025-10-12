'use client'

import React from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  /**
   * Maximum width of the modal content.
   * Can be a Tailwind class like 'max-w-2xl' or 'max-w-4xl'
   * @default 'max-w-2xl'
   */
  maxWidth?: string
  /**
   * Maximum height of the modal content.
   * @default 'max-h-[90vh]'
   */
  maxHeight?: string
  /**
   * Whether clicking the backdrop should close the modal
   * @default true
   */
  closeOnBackdropClick?: boolean
  /**
   * Additional CSS classes for the modal container
   */
  className?: string
}

/**
 * Reusable modal component with consistent backdrop and styling
 * Used across the app for dialogs, forms, and overlays
 */
export default function Modal({
  isOpen,
  onClose,
  children,
  maxWidth = 'max-w-2xl',
  maxHeight = 'max-h-[90vh]',
  closeOnBackdropClick = true,
  className = ''
}: ModalProps) {
  if (!isOpen) return null

  const handleBackdropClick = () => {
    if (closeOnBackdropClick) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div className={`relative w-full ${maxWidth} ${maxHeight} overflow-y-auto ${className}`}>
        {children}
      </div>
    </div>
  )
}
