import { describe, it, expect } from 'vitest'
import { formatCalendarDate, formatDateRange } from '@/lib/types'

describe('formatDateRange', () => {
  it('formats ISO date ranges as stable calendar dates', () => {
    const result = formatDateRange('2025-03-01T00:00:00Z', '2025-03-15T00:00:00Z')
    expect(result).toBe('2025/03/01 – 2025/03/15')
  })

  it('handles same day range', () => {
    const result = formatDateRange('2025-06-01T12:00:00Z', '2025-06-01T12:00:00Z')
    expect(result).toBe('2025/06/01 – 2025/06/01')
  })

  it('handles cross-year range', () => {
    const result = formatDateRange('2024-12-20T00:00:00Z', '2025-01-10T00:00:00Z')
    expect(result).toBe('2024/12/20 – 2025/01/10')
  })
})

describe('formatCalendarDate', () => {
  it('keeps ISO calendar dates from shifting across timezones', () => {
    expect(formatCalendarDate('2026-03-15T00:00:00.000Z')).toBe('2026/03/15')
    expect(formatCalendarDate('2026-03-17T00:00:00.000Z')).toBe('2026/03/17')
  })
})
