// Chart color constants for consistent theming across all charts and diagrams
// Using dark theme colors consistently

export const CHART_COLORS = {
  // Primary data series colors
  primary: '#3B82F6',           // Blue - main value/portfolio line
  secondary: '#EF4444',         // Red - invested/cost basis line
  accent: '#10B981',            // Green - positive values/gains
  warning: '#F59E0B',           // Amber - warnings/neutral
  danger: '#EF4444',            // Red - negative values/losses
  
  // Asset type colors for allocations
  stock: '#3B82F6',            // Blue
  etf: '#8B5CF6',              // Purple  
  crypto: '#F59E0B',           // Amber/Orange
  real_estate: '#10B981',      // Green
  cash: '#6B7280',             // Gray
  other: '#EC4899',            // Pink
  
  // Chart background and UI colors (dark theme)
  background: '#1F2937',        // Dark gray background
  surface: '#374151',           // Lighter dark gray for surfaces
  border: '#4B5563',            // Border color
  text: {
    primary: '#F9FAFB',         // White/light text
    secondary: '#D1D5DB',       // Light gray text
    muted: '#9CA3AF'            // Muted gray text
  },
  
  // Grid and axis colors
  grid: '#4B5563',              // Grid lines
  axis: '#6B7280',              // Axis lines
  
  // Opacity variants (for fills, hover states)
  opacity: {
    low: '20',                  // 20% opacity (hex: 33)
    medium: '40',               // 40% opacity (hex: 66) 
    high: '80'                  // 80% opacity (hex: CC)
  }
} as const

// Utility functions for color manipulation
export const withOpacity = (color: string, opacity: keyof typeof CHART_COLORS.opacity): string => {
  return `${color}${CHART_COLORS.opacity[opacity]}`
}

// Predefined color palettes for multi-series charts
export const CHART_PALETTES = {
  // Asset allocation pie chart
  assetAllocation: [
    CHART_COLORS.stock,         // Blue
    CHART_COLORS.etf,           // Purple
    CHART_COLORS.crypto,        // Orange
    CHART_COLORS.real_estate,   // Green
    CHART_COLORS.cash,          // Gray
    CHART_COLORS.other          // Pink
  ],
  
  // Performance comparison
  performance: [
    CHART_COLORS.primary,       // Blue
    CHART_COLORS.accent,        // Green
    CHART_COLORS.warning,       // Amber
    CHART_COLORS.secondary      // Red
  ],
  
  // Sequential data (for trends, time series)
  sequential: [
    '#1E40AF',  // Dark blue
    '#3B82F6',  // Blue  
    '#60A5FA',  // Light blue
    '#93C5FD',  // Lighter blue
    '#DBEAFE'   // Very light blue
  ]
} as const

// Chart-specific color configurations
export const CHART_CONFIGS = {
  lineChart: {
    primaryLine: {
      borderColor: CHART_COLORS.primary,
      backgroundColor: withOpacity(CHART_COLORS.primary, 'medium'),
      pointBackgroundColor: CHART_COLORS.primary,
      pointBorderColor: CHART_COLORS.primary
    },
    secondaryLine: {
      borderColor: CHART_COLORS.secondary,
      backgroundColor: withOpacity(CHART_COLORS.secondary, 'medium'),
      pointBackgroundColor: CHART_COLORS.secondary,
      pointBorderColor: CHART_COLORS.secondary
    }
  },
  
  tooltip: {
    backgroundColor: CHART_COLORS.background,
    titleColor: CHART_COLORS.text.primary,
    bodyColor: CHART_COLORS.text.secondary,
    borderColor: CHART_COLORS.border
  },
  
  legend: {
    color: CHART_COLORS.text.secondary
  },
  
  scales: {
    x: {
      title: { color: CHART_COLORS.text.secondary },
      ticks: { color: CHART_COLORS.text.secondary },
      grid: { color: CHART_COLORS.grid }
    },
    y: {
      title: { color: CHART_COLORS.text.secondary },
      ticks: { color: CHART_COLORS.text.secondary },
      grid: { color: CHART_COLORS.grid }
    }
  }
} as const