import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { AppearanceTab } from '@/pages/settings/AppearanceTab'

const mockSetTheme = vi.fn()
const mockSetFontSize = vi.fn()
const mockSetFontFamily = vi.fn()

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'system',
    setTheme: mockSetTheme,
  }),
}))

vi.mock('@/hooks/useFontSettings', () => ({
  useFontSettings: () => ({
    fontSize: 'normal',
    setFontSize: mockSetFontSize,
    fontFamily: 'geist',
    setFontFamily: mockSetFontFamily,
  }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
  }),
}))

describe('AppearanceTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders theme options', () => {
    render(<AppearanceTab />)
    expect(screen.getByText('Light')).toBeInTheDocument()
    expect(screen.getByText('Dark')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()
  })

  it('renders font size options', () => {
    render(<AppearanceTab />)
    expect(screen.getByText('Small')).toBeInTheDocument()
    expect(screen.getByText('Normal')).toBeInTheDocument()
    expect(screen.getByText('Large')).toBeInTheDocument()
  })

  it('renders font family options', () => {
    render(<AppearanceTab />)
    expect(screen.getByText('Geist')).toBeInTheDocument()
    expect(screen.getByText('System UI')).toBeInTheDocument()
  })

  it('calls setTheme when a theme option is clicked', () => {
    render(<AppearanceTab />)
    fireEvent.click(screen.getByText('Dark'))
    expect(mockSetTheme).toHaveBeenCalledWith('dark')
  })

  it('calls setFontSize when a font size option is clicked', () => {
    render(<AppearanceTab />)
    fireEvent.click(screen.getByText('Large'))
    expect(mockSetFontSize).toHaveBeenCalledWith('large')
  })

  it('calls setFontFamily when a font family option is clicked', () => {
    render(<AppearanceTab />)
    fireEvent.click(screen.getByText('System UI'))
    expect(mockSetFontFamily).toHaveBeenCalledWith('system')
  })
})
