import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock the API layer
const mockGenerateDescription = vi.fn()
const mockGenerateNews = vi.fn()
const mockSuggestCriteria = vi.fn()
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

// jsdom does not implement scrollIntoView, which Radix Dialog tries to call.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {}
}

// Lightweight i18n mock — returns a key-form string for everything
// the component asks for, with `{{count}}` interpolation so the token
// and latency badges render numeric values.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown> | string) => {
      const base = `__${key}__`
      if (opts && typeof opts === 'object' && 'count' in opts) {
        return base.replace('__', `${opts.count} `)
      }
      return base
    },
    i18n: { language: 'en', changeLanguage: () => Promise.resolve() },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
  Trans: ({ children }: { children: React.ReactNode }) => children,
}))

import { AIGenerateModal } from '@/components/ai/AIGenerateModal'

describe('AIGenerateModal — description mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a Generate button on the form', () => {
    render(
      <AIGenerateModal hackathonId="h1" mode="description" open onOpenChange={() => {}} />
    )
    expect(
      screen.getByRole('button', { name: /__ai\.generate\.title__/ })
    ).toBeInTheDocument()
  })

  it('renders a Chinese/English language picker (radiogroup with 3 options)', () => {
    render(
      <AIGenerateModal hackathonId="h1" mode="description" open onOpenChange={() => {}} />
    )
    const radios = screen.getAllByRole('radio')
    expect(radios.length).toBe(3)
  })

  it('shows a loading skeleton while the request is in flight', async () => {
    let resolveRequest!: (v: unknown) => void
    mockGenerateDescription.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      })
    )
    const user = userEvent.setup()
    render(
      <AIGenerateModal hackathonId="h1" mode="description" open onOpenChange={() => {}} />
    )
    await user.click(
      screen.getByRole('button', { name: /__ai\.generate\.title__/ })
    )
    await waitFor(() => {
      expect(screen.getByTestId('ai-loading')).toBeInTheDocument()
    })
    resolveRequest({ draft: { zh: '草稿', en: 'Draft' }, tokensUsed: 100, latencyMs: 1200 })
  })

  it('renders the preview editor with the returned draft', async () => {
    mockGenerateDescription.mockResolvedValue({
      draft: { zh: '## 简介\n\n草稿内容', en: '## About\n\nDraft content' },
      tokensUsed: 1234,
      latencyMs: 3500,
    })
    const onApplyDraft = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <AIGenerateModal
        hackathonId="h1"
        mode="description"
        open
        onOpenChange={() => {}}
        onApplyDraft={onApplyDraft}
      />
    )
    await user.click(
      screen.getByRole('button', { name: /__ai\.generate\.title__/ })
    )

    await waitFor(() => {
      expect(screen.getByTestId('ai-preview')).toBeInTheDocument()
    })
    // Token / latency badges
    expect(screen.getByText(/1234/)).toBeInTheDocument()
    expect(screen.getByText(/3500/)).toBeInTheDocument()

    // Both tabs visible since language defaults to 'both'
    expect(screen.getByRole('tab', { name: /__ai\.generate\.tab_zh__/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /__ai\.generate\.tab_en__/ })).toBeInTheDocument()

    // Save button
    const saveBtn = screen.getByRole('button', { name: /__ai\.generate\.save__/ })
    await user.click(saveBtn)
    await waitFor(() => {
      expect(onApplyDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          zh: expect.stringContaining('草稿内容'),
          en: expect.stringContaining('Draft content'),
        })
      )
    })
  })

  it('renders the error panel with the error code when generation fails', async () => {
    mockGenerateDescription.mockRejectedValue({
      response: { data: { error: 'timeout', code: 'LLM_TIMEOUT' } },
    })
    const user = userEvent.setup()
    render(
      <AIGenerateModal hackathonId="h1" mode="description" open onOpenChange={() => {}} />
    )
    await user.click(
      screen.getByRole('button', { name: /__ai\.generate\.title__/ })
    )
    await waitFor(() => {
      expect(screen.getByTestId('ai-error')).toBeInTheDocument()
    })
    expect(screen.getByText(/LLM_TIMEOUT/)).toBeInTheDocument()
  })
})

describe('AIGenerateModal — criteria mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('disables Save when total weight is not 100', async () => {
    mockSuggestCriteria.mockResolvedValue({
      suggestions: [
        { name: 'A', weight: 30, maxScore: 10, sortOrder: 1, reasoning: 'r' },
        { name: 'B', weight: 30, maxScore: 10, sortOrder: 2, reasoning: 'r' },
      ],
      tokensUsed: 200,
      latencyMs: 1000,
    })
    const onApplyCriteria = vi.fn()
    const user = userEvent.setup()
    render(
      <AIGenerateModal
        hackathonId="h1"
        mode="criteria"
        open
        onOpenChange={() => {}}
        onApplyCriteria={onApplyCriteria}
      />
    )
    await user.click(
      screen.getByRole('button', { name: /__ai\.generate\.title__/ })
    )
    await waitFor(() => {
      expect(screen.getByTestId('ai-preview')).toBeInTheDocument()
    })

    const saveBtn = screen.getByRole('button', { name: /__ai\.generate\.save__/ })
    expect(saveBtn).toBeDisabled()
    expect(onApplyCriteria).not.toHaveBeenCalled()
  })

  it('enables Save and calls onApplyCriteria when total weight = 100', async () => {
    mockSuggestCriteria.mockResolvedValue({
      suggestions: [
        { name: 'A', weight: 40, maxScore: 10, sortOrder: 1, reasoning: 'r' },
        { name: 'B', weight: 30, maxScore: 10, sortOrder: 2, reasoning: 'r' },
        { name: 'C', weight: 30, maxScore: 10, sortOrder: 3, reasoning: 'r' },
      ],
      tokensUsed: 200,
      latencyMs: 1000,
    })
    const onApplyCriteria = vi.fn()
    const user = userEvent.setup()
    render(
      <AIGenerateModal
        hackathonId="h1"
        mode="criteria"
        open
        onOpenChange={() => {}}
        onApplyCriteria={onApplyCriteria}
      />
    )
    await user.click(
      screen.getByRole('button', { name: /__ai\.generate\.title__/ })
    )
    await waitFor(() => {
      expect(screen.getByTestId('ai-preview')).toBeInTheDocument()
    })

    const saveBtn = screen.getByRole('button', { name: /__ai\.generate\.save__/ })
    expect(saveBtn).not.toBeDisabled()
    await user.click(saveBtn)
    await waitFor(() => {
      expect(onApplyCriteria).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'A', weight: 40 }),
          expect.objectContaining({ name: 'B', weight: 30 }),
        ])
      )
    })
  })
})

describe('AIGenerateModal — news mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends a request to generateHackathonNews', async () => {
    mockGenerateNews.mockResolvedValue({
      draft: { zh: '新闻', en: 'News' },
      projects: ['p1', 'p2'],
      tokensUsed: 50,
      latencyMs: 200,
    })
    const user = userEvent.setup()
    render(
      <AIGenerateModal hackathonId="h1" mode="news" open onOpenChange={() => {}} />
    )
    // news mode shows an "include runner-ups" checkbox
    expect(screen.getByText(/__ai\.generate\.include_runner_ups__/)).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: /__ai\.generate\.title__/ })
    )
    await waitFor(() => {
      expect(mockGenerateNews).toHaveBeenCalledWith(
        expect.objectContaining({ hackathonId: 'h1' })
      )
    })
  })
})
