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

export const getTimePeriodBucketsForTimePeriod = (startDate: Date, endDate: Date, groupByPeriod: TimePeriod) => {
    const allPeriods = new Set<string>()

    // Generate all periods between start and end date
    for (let d = new Date(startDate); d <= endDate;) {
      let key: string

      switch (groupByPeriod) {
        case 'day':
          key = d.toISOString().split('T')[0]
          d.setDate(d.getDate() + 1)
          break
        case 'week':
          const weekStart = new Date(d)
          weekStart.setDate(d.getDate() - d.getDay())
          key = weekStart.toISOString().split('T')[0]
          d.setDate(d.getDate() + 7)
          break
        case 'month':
          key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          d.setMonth(d.getMonth() + 1)
          break
        case 'quarter':
          key = `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`
          d.setMonth(d.getMonth() + 3)
          break
        case 'year':
          key = `${d.getFullYear()}`
          d.setFullYear(d.getFullYear() + 1)
          break
      }

      allPeriods.add(key)
    }

    return allPeriods
  }
