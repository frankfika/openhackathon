import { useEffect, useState } from 'react'

export type FontSize = 'small' | 'normal' | 'large'
export type FontFamily = 'geist' | 'system'

const FONT_SIZE_KEY = 'fontSize'
const FONT_FAMILY_KEY = 'fontFamily'

const FONT_SIZE_SCALE: Record<FontSize, number> = {
  small: 0.875,
  normal: 1,
  large: 1.125,
}

const FONT_FAMILY_STACK: Record<FontFamily, string> = {
  geist: '"Geist", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", sans-serif',
}

function getInitialFontSize(): FontSize {
  const saved = localStorage.getItem(FONT_SIZE_KEY)
  if (saved === 'small' || saved === 'normal' || saved === 'large') {
    return saved
  }
  return 'normal'
}

function getInitialFontFamily(): FontFamily {
  const saved = localStorage.getItem(FONT_FAMILY_KEY)
  if (saved === 'geist' || saved === 'system') {
    return saved
  }
  return 'geist'
}

function applyFontSize(size: FontSize) {
  document.documentElement.style.setProperty('--font-size-scale', String(FONT_SIZE_SCALE[size]))
}

function applyFontFamily(family: FontFamily) {
  document.documentElement.style.setProperty('--font-family-base', FONT_FAMILY_STACK[family])
}

export function useFontSettings() {
  const [fontSize, setFontSizeState] = useState<FontSize>(getInitialFontSize)
  const [fontFamily, setFontFamilyState] = useState<FontFamily>(getInitialFontFamily)

  useEffect(() => {
    applyFontSize(fontSize)
    applyFontFamily(fontFamily)
  }, [])

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size)
    localStorage.setItem(FONT_SIZE_KEY, size)
    applyFontSize(size)
  }

  const setFontFamily = (family: FontFamily) => {
    setFontFamilyState(family)
    localStorage.setItem(FONT_FAMILY_KEY, family)
    applyFontFamily(family)
  }

  return {
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
  }
}
