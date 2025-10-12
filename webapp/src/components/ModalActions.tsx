'use client'

import React from 'react'

export type ModalActionVariant = 'primary' | 'secondary' | 'danger' | 'success'

export interface ModalActionButton {
  label: string
  onClick: () => void
  variant?: ModalActionVariant
  disabled?: boolean
  loading?: boolean
  loadingText?: string
  className?: string
}

interface ModalActionsProps {
  /**
   * Primary action button (typically on the right)
   */
  primaryAction?: ModalActionButton
  /**
   * Secondary action button (typically on the left, e.g., Cancel)
   */
  secondaryAction?: ModalActionButton
  /**
   * Additional custom actions (rendered between secondary and primary)
   */
  customActions?: ModalActionButton[]
  /**
   * Layout: 'between' puts secondary on left and primary on right,
   * 'end' puts all actions on the right
   * @default 'between'
   */
  layout?: 'between' | 'end'
  /**
   * Additional CSS classes for the container
   */
  className?: string
}

/**
 * Standardized modal action buttons component
 * Provides consistent styling and behavior for all modal dialogs
 */
export default function ModalActions({
  primaryAction,
  secondaryAction,
  customActions = [],
  layout = 'between',
  className = ''
}: ModalActionsProps) {
  const getButtonClasses = (variant: ModalActionVariant = 'secondary', customClass?: string) => {
    const baseClasses = 'px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

    const variantClasses = {
      primary: 'bg-blue-600 hover:bg-blue-700 text-white border border-transparent focus:ring-blue-500',
      secondary: 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 focus:ring-gray-500',
      danger: 'bg-red-600 hover:bg-red-700 text-white border border-transparent focus:ring-red-500',
      success: 'bg-green-600 hover:bg-green-700 text-white border border-transparent focus:ring-green-500',
    }

    return `${baseClasses} ${variantClasses[variant]} ${customClass || ''}`
  }

  const renderButton = (action: ModalActionButton, key: string) => {
    return (
      <button
        key={key}
        onClick={action.onClick}
        disabled={action.disabled || action.loading}
        className={getButtonClasses(action.variant, action.className)}
      >
        {action.loading ? (
          <span className="flex items-center">
            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
            {action.loadingText || action.label}
          </span>
        ) : (
          action.label
        )}
      </button>
    )
  }

  const layoutClasses = layout === 'between' ? 'flex justify-between' : 'flex justify-end space-x-3'

  return (
    <div className={`${layoutClasses} ${className}`}>
      {layout === 'between' && secondaryAction && (
        renderButton(secondaryAction, 'secondary')
      )}

      {layout === 'end' && (
        <div className="flex space-x-3">
          {secondaryAction && renderButton(secondaryAction, 'secondary')}
          {customActions.map((action, idx) => renderButton(action, `custom-${idx}`))}
          {primaryAction && renderButton(primaryAction, 'primary')}
        </div>
      )}

      {layout === 'between' && (
        <>
          {customActions.length > 0 && (
            <div className="flex space-x-3">
              {customActions.map((action, idx) => renderButton(action, `custom-${idx}`))}
            </div>
          )}
          {primaryAction && renderButton(primaryAction, 'primary')}
        </>
      )}
    </div>
  )
}
