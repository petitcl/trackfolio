'use client'

import React from 'react'
import ValueEvolutionChart from './ValueEvolutionChart'
import type { TimeRange } from '../TimeRangeSelector'
import type { HistoricalDataPoint } from '../../lib/mockData'

interface PortfolioValueEvolutionChartProps {
  data: HistoricalDataPoint[]
  timeRange: TimeRange
  className?: string
}

export default function PortfolioValueEvolutionChart({ 
  data, 
  timeRange, 
  className = '' 
}: PortfolioValueEvolutionChartProps) {
  return (
    <ValueEvolutionChart
      data={data}
      timeRange={timeRange}
      title="Portfolio Value Evolution"
      description={`Portfolio value vs. invested amount in EUR (${timeRange.toUpperCase()})`}
      className={className}
      valueLabel="Portfolio Value"
      investedLabel="Cumulative Invested"
      currency="EUR"
      showInvested={true}
    />
  )
}