import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFontSettings } from '@/hooks/useFontSettings'

describe('useFontSettings', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.style.removeProperty('--font-size-scale')
    document.documentElement.style.removeProperty('--font-family-base')
  })

  it('defaults to normal font size and geist font family', () => {
    const { result } = renderHook(() => useFontSettings())

    expect(result.current.fontSize).toBe('normal')
    expect(result.current.fontFamily).toBe('geist')
  })

  it('restores saved preferences from localStorage', () => {
    localStorage.setItem('fontSize', 'large')
    localStorage.setItem('fontFamily', 'system')

    const { result } = renderHook(() => useFontSettings())

    expect(result.current.fontSize).toBe('large')
    expect(result.current.fontFamily).toBe('system')
  })

  it('persists font size to localStorage and applies CSS variable', () => {
    const { result } = renderHook(() => useFontSettings())

    act(() => {
      result.current.setFontSize('small')
    })

    expect(result.current.fontSize).toBe('small')
    expect(localStorage.getItem('fontSize')).toBe('small')
    expect(document.documentElement.style.getPropertyValue('--font-size-scale')).toBe('0.875')
  })

  it('persists font family to localStorage and applies CSS variable', () => {
    const { result } = renderHook(() => useFontSettings())

    act(() => {
      result.current.setFontFamily('system')
    })

    expect(result.current.fontFamily).toBe('system')
    expect(localStorage.getItem('fontFamily')).toBe('system')
    expect(document.documentElement.style.getPropertyValue('--font-family-base')).toContain('system-ui')
  })

  it('applies CSS variables on initial mount', () => {
    localStorage.setItem('fontSize', 'large')
    localStorage.setItem('fontFamily', 'geist')

    renderHook(() => useFontSettings())

    expect(document.documentElement.style.getPropertyValue('--font-size-scale')).toBe('1.125')
    expect(document.documentElement.style.getPropertyValue('--font-family-base')).toContain('Geist')
  })
})
