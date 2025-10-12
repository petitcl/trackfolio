'use client'

import React from 'react'
import Modal from './Modal'
import ModalActions, { type ModalActionVariant } from './ModalActions'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: ModalActionVariant
  isLoading?: boolean
  loadingText?: string
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger',
  isLoading = false,
  loadingText = 'Processing...'
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    // Don't auto-close when loading - let the parent handle it
    if (!isLoading) {
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-md"
      closeOnBackdropClick={!isLoading}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>

        <p className="text-gray-600 dark:text-gray-300 mb-6">
          {message}
        </p>

        <ModalActions
          layout="between"
          secondaryAction={{
            label: cancelText,
            onClick: onClose,
            disabled: isLoading,
            variant: 'secondary'
          }}
          primaryAction={{
            label: confirmText,
            onClick: handleConfirm,
            variant: confirmVariant,
            loading: isLoading,
            loadingText: loadingText
          }}
        />
      </div>
    </Modal>
  )
}