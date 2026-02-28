import { describe, it, expect } from 'vitest'
import { formatDateRange } from '@/lib/types'

describe('formatDateRange', () => {
  it('formats a date range with zh-CN locale', () => {
    const result = formatDateRange('2025-03-01T00:00:00Z', '2025-03-15T00:00:00Z')
    // zh-CN format: YYYY/MM/DD
    expect(result).toContain('2025')
    expect(result).toContain('–')
  })

  it('handles same day range', () => {
    // Use identical timestamps to avoid timezone offset issues
    const result = formatDateRange('2025-06-01T12:00:00Z', '2025-06-01T12:00:00Z')
    expect(result).toContain('2025')
    const [start, end] = result.split('–').map(s => s.trim())
    expect(start).toBe(end)
  })

  it('handles cross-year range', () => {
    const result = formatDateRange('2024-12-20T00:00:00Z', '2025-01-10T00:00:00Z')
    expect(result).toContain('2024')
    expect(result).toContain('2025')
  })
})
