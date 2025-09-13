'use client'

import React from 'react'
import ValueEvolutionChart from './ValueEvolutionChart'
import type { TimeRange } from '../TimeRangeSelector'
import type { HistoricalDataPoint } from '../../lib/mockData'
import type { SupportedCurrency } from '../../lib/services/currency.service'

interface PortfolioValueEvolutionChartProps {
  data: HistoricalDataPoint[]
  timeRange: TimeRange
  selectedCurrency: SupportedCurrency
  className?: string
}

export default function PortfolioValueEvolutionChart({ 
  data, 
  timeRange,
  selectedCurrency,
  className = '' 
}: PortfolioValueEvolutionChartProps) {
  return (
    <ValueEvolutionChart
      data={data}
      timeRange={timeRange}
      title="Portfolio Value Evolution"
      description={`Portfolio value vs. invested amount in ${selectedCurrency} (${timeRange.toUpperCase()})`}
      className={className}
      valueLabel="Portfolio Value"
      investedLabel="Cumulative Invested"
      currency={selectedCurrency}
      showInvested={true}
    />
  )
}