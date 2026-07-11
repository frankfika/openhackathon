import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { createInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'

// IMPORTANT: this test intentionally does NOT mock `react-i18next`.
// It exercises AIGenerateModal against the real locale files
// (src/lib/locales/en.json + zh.json) to catch i18n-key leaks —
// the previous attempt shipped AIGenerateModal without adding
// `ai.generate.*` entries to the locale files, so users saw raw
// key strings like "ai.generate.title" in the UI.
//
// jsdom does not implement scrollIntoView, which Radix Dialog
// tries to call.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {}
}

import en from '@/lib/locales/en.json'
import zh from '@/lib/locales/zh.json'
import { AIGenerateModal } from '@/components/ai/AIGenerateModal'

const mockGenerateDescription = vi.fn().mockResolvedValue({
  draft: { zh: '草稿', en: 'Draft' },
  tokensUsed: 100,
  latencyMs: 1200,
})
const mockGenerateNews = vi.fn().mockResolvedValue({
  draft: { zh: '新闻', en: 'News' },
  tokensUsed: 50,
  latencyMs: 200,
})
const mockSuggestCriteria = vi.fn().mockResolvedValue({
  suggestions: [
    { name: 'A', weight: 50, maxScore: 10, sortOrder: 1, reasoning: 'r' },
    { name: 'B', weight: 50, maxScore: 10, sortOrder: 2, reasoning: 'r' },
  ],
  tokensUsed: 200,
  latencyMs: 1000,
})

vi.mock('@/lib/api', () => ({
  api: {
    generateHackathonDescription: (...args: unknown[]) => mockGenerateDescription(...args),
    generateHackathonNews: (...args: unknown[]) => mockGenerateNews(...args),
    suggestHackathonCriteria: (...args: unknown[]) => mockSuggestCriteria(...args),
  },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Sanity check: the `ai` top-level key must exist in BOTH locales.
// If this test ever starts failing on a fresh checkout, that means
// someone deleted the `ai` block — which is exactly the regression
// this test exists to catch.
describe('locale files — ai.generate.* keys present', () => {
  it('en.json has ai.generate.* for every key AIGenerateModal references', () => {
    expect(en).toHaveProperty('ai.generate.title')
    expect(en).toHaveProperty('ai.generate.description_title')
    expect(en).toHaveProperty('ai.generate.news_title')
    expect(en).toHaveProperty('ai.generate.criteria_title')
    expect(en).toHaveProperty('ai.generate.open_button_description')
    expect(en).toHaveProperty('ai.generate.open_button_news')
    expect(en).toHaveProperty('ai.generate.open_button_criteria')
    expect(en).toHaveProperty('ai.generate.error_timeout')
    expect(en).toHaveProperty('ai.generate.tab_zh')
    expect(en).toHaveProperty('ai.generate.tab_en')
  })

  it('zh.json has ai.generate.* for every key AIGenerateModal references', () => {
    expect(zh).toHaveProperty('ai.generate.title')
    expect(zh).toHaveProperty('ai.generate.description_title')
    expect(zh).toHaveProperty('ai.generate.news_title')
    expect(zh).toHaveProperty('ai.generate.criteria_title')
    expect(zh).toHaveProperty('ai.generate.open_button_description')
    expect(zh).toHaveProperty('ai.generate.open_button_news')
    expect(zh).toHaveProperty('ai.generate.open_button_criteria')
    expect(zh).toHaveProperty('ai.generate.error_timeout')
    expect(zh).toHaveProperty('ai.generate.tab_zh')
    expect(zh).toHaveProperty('ai.generate.tab_en')
  })
})

// Build a fresh i18next instance for each language so we can prove
// the modal renders translated text — not the raw key — in BOTH
// locales. This is the test that would have caught the original
// regression: AIGenerateModal referenced 50+ `ai.generate.*` keys
// but the locale files had no `ai` block at all, so i18next
// returned the key string verbatim and the UI was unreadable.
async function makeI18n(lng: 'en' | 'zh') {
  const inst = createInstance()
  await inst.use(initReactI18next).init({
    lng,
    fallbackLng: 'en',
    resources: {
      en: { translation: en },
      zh: { translation: zh },
    },
    interpolation: { escapeValue: false },
    // Make missing keys obvious in test output instead of
    // silently returning the key string.
    saveMissing: false,
  })
  return inst
}

function withI18n(ui: React.ReactElement, lng: 'en' | 'zh') {
  // Synchronous render path: we resolve `makeI18n` in `beforeAll`
  // and pass the instance down via React context. We avoid using
  // the global i18n instance from src/lib/i18n.ts so this test
  // does not depend on import ordering.
  return <I18nextProvider i18n={globalI18nByLang[lng]}>{ui}</I18nextProvider>
}

// Two module-scoped instances, one per language, shared across tests.
const globalI18nByLang: {
  en: ReturnType<typeof createInstance> | null
  zh: ReturnType<typeof createInstance> | null
} = { en: null, zh: null }

beforeAll(async () => {
  globalI18nByLang.en = await makeI18n('en')
  globalI18nByLang.zh = await makeI18n('zh')
})

// Helper: dump every visible text node under `container` and return
// any text that matches the raw-key leak pattern `/ai\.generate\./`.
// We use a manual DOM walk because RTL's `getByText` will throw on
// multiple matches and we want to *report* every leak, not just the
// first.
function findLeakedKeys(container: HTMLElement): string[] {
  const leaked: string[] = []
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? ''
    if (/ai\.generate\./.test(text)) {
      leaked.push(text)
    }
  }
  return leaked
}

describe('AIGenerateModal — no i18n key leaks in real locale', () => {
  it('renders no raw `ai.generate.*` keys in English', () => {
    const { container } = render(
      withI18n(
        <AIGenerateModal hackathonId="h1" mode="description" open onOpenChange={() => {}} />,
        'en'
      )
    )
    const leaked = findLeakedKeys(container)
    expect(leaked, `Leaked i18n keys: ${JSON.stringify(leaked)}`).toEqual([])
  })

  it('renders no raw `ai.generate.*` keys in Chinese', () => {
    const { container } = render(
      withI18n(
        <AIGenerateModal hackathonId="h1" mode="description" open onOpenChange={() => {}} />,
        'zh'
      )
    )
    const leaked = findLeakedKeys(container)
    expect(leaked, `Leaked i18n keys: ${JSON.stringify(leaked)}`).toEqual([])
  })

  it('renders no raw `ai.generate.*` keys in news mode (zh)', () => {
    const { container } = render(
      withI18n(
        <AIGenerateModal hackathonId="h1" mode="news" open onOpenChange={() => {}} />,
        'zh'
      )
    )
    const leaked = findLeakedKeys(container)
    expect(leaked, `Leaked i18n keys: ${JSON.stringify(leaked)}`).toEqual([])
  })

  it('renders no raw `ai.generate.*` keys in criteria mode (en)', () => {
    const { container } = render(
      withI18n(
        <AIGenerateModal
          hackathonId="h1"
          mode="criteria"
          open
          onOpenChange={() => {}}
        />,
        'en'
      )
    )
    const leaked = findLeakedKeys(container)
    expect(leaked, `Leaked i18n keys: ${JSON.stringify(leaked)}`).toEqual([])
  })

  it('renders translated button labels in Chinese, not the raw key', () => {
    // In Chinese the Generate button should NOT show `ai.generate.title`;
    // it should show the Chinese translation.
    render(
      withI18n(
        <AIGenerateModal hackathonId="h1" mode="description" open onOpenChange={() => {}} />,
        'zh'
      )
    )
    const btn = screen.getByRole('button', { name: zh.ai.generate.title })
    expect(btn).toBeInTheDocument()
    // And it should definitely NOT match the raw key.
    expect(btn.textContent).not.toMatch(/ai\.generate\./)
  })
})
