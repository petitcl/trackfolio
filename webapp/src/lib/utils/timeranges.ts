export type TimeRange = '5d' | '1m' | '6m' | 'ytd' | '1y' | '5y' | 'all'

export type TimePeriod = 'day' | 'week' | 'month' | 'quarter' | 'year'

export const getTimeRanges = (): { key: TimeRange; label: string }[] => [
    { key: '5d', label: '5D' },
    { key: '1m', label: '1M' },
    { key: '6m', label: '6M' },
    { key: 'ytd', label: 'YTD' },
    { key: '1y', label: '1Y' },
    { key: '5y', label: '5Y' },
    { key: 'all', label: 'ALL' },
]

export const getStartDateForTimeRange = (range: TimeRange): Date => {
    const now = new Date()
    switch (range) {
        case '5d':
            return new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
        case '1m':
            return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        case '6m':
            return new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000)
        case 'ytd':
            return new Date(now.getFullYear(), 0, 1)
        case '1y':
            return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        case '5y':
            return new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000)
        case 'all':
        default:
            return new Date(0);
    }
}

export const getGroupByTimePeriodForTimeRange = (range: TimeRange): TimePeriod => {
    const now = new Date()
    switch (range) {
        case '5d':
            return 'day'
        case '1m':
            return 'week'
        case '6m':
        case 'ytd':
        case '1y':
            return 'month'
        case '5y':
            return 'quarter'
        case 'all':
        default:
            return 'year'
    }
}

export const getTimePeriodBucketsForTimePeriod = (startDate: Date, endDate: Date, groupByPeriod: TimePeriod): Set<string> => {
    const allPeriods = new Set<string>()

    // Use UTC to avoid timezone issues with date calculations
    const d = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()))
    const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()))

    // Generate all periods between start and end date
    while (d <= end) {
      let key: string

      switch (groupByPeriod) {
        case 'day':
          key = d.toISOString().split('T')[0]
          d.setUTCDate(d.getUTCDate() + 1)
          break
        case 'week':
          const weekStart = new Date(d)
          weekStart.setUTCDate(d.getUTCDate() - d.getUTCDay())
          key = weekStart.toISOString().split('T')[0]
          d.setUTCDate(d.getUTCDate() + 7)
          break
        case 'month':
          key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
          d.setUTCMonth(d.getUTCMonth() + 1)
          break
        case 'quarter':
          key = `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`
          d.setUTCMonth(d.getUTCMonth() + 3)
          break
        case 'year':
          key = `${d.getUTCFullYear()}`
          d.setUTCFullYear(d.getUTCFullYear() + 1)
          break
      }

      allPeriods.add(key)
    }

    return allPeriods
  }
