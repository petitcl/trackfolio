import { getPnLColor } from '@/lib/utils/formatting'

type CurrencyFormatProps = {
  value: number
  format: 'currency'
  currency: string
  className?: string
  showSign?: boolean
}

type PercentageFormatProps = {
  value: number
  format: 'percentage'
  currency?: never
  className?: string
  showSign?: boolean
}

type ProfitDisplayProps = CurrencyFormatProps | PercentageFormatProps

export default function ProfitDisplay({
  value,
  format,
  currency,
  className = '',
  showSign = true
}: ProfitDisplayProps) {
  const colorClass = getPnLColor(value)

  const formattedValue = format === 'percentage'
    ? `${showSign && value > 0 ? '+' : ''}${value.toFixed(2)}%`
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency
      }).format(value)

  return (
    <span className={`${colorClass} ${className}`}>
      {formattedValue}
    </span>
  )
}
