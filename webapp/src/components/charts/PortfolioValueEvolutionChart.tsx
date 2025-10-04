'use client'

import React from 'react'
import ValueEvolutionChart from './ValueEvolutionChart'
import type { HistoricalDataPoint } from '../../lib/mockData'
import type { SupportedCurrency } from '../../lib/services/currency.service'
import { type TimeRange } from '@/lib/utils/timeranges'

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