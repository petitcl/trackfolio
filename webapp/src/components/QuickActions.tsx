'use client'

import React from 'react'

export interface QuickAction {
  id: string
  icon: string
  label: string
  onClick?: () => void
  href?: string
  disabled?: boolean
}

interface QuickActionsProps {
  title?: string
  actions: QuickAction[]
  columns?: 1 | 2 | 3 | 4
  className?: string
}

export default function QuickActions({ 
  title = "Quick Actions", 
  actions, 
  columns = 3,
  className = ""
}: QuickActionsProps) {
  const getGridColumns = () => {
    const colClasses = {
      1: 'grid-cols-1',
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
    }
    return colClasses[columns]
  }

  const handleAction = (action: QuickAction) => {
    if (action.disabled) return
    
    if (action.onClick) {
      action.onClick()
    } else if (action.href) {
      window.location.href = action.href
    }
  }

  return (
    <div className={`bg-white dark:bg-gray-800 shadow sm:rounded-lg border dark:border-gray-700 ${className}`}>
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
          {title}
        </h3>
        <div className={`grid ${getGridColumns()} gap-4`}>
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action)}
              disabled={action.disabled}
              className={`
                inline-flex items-center justify-center px-4 py-2 border 
                shadow-sm text-sm font-medium rounded-md
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 
                dark:focus:ring-offset-gray-800 transition-colors
                ${action.disabled 
                  ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }
              `}
            >
              {action.icon} {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}