import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Loader2, AlertCircle, CheckCircle2, Copy, Save, RefreshCw, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { extractApiErrorMessage } from '@/lib/api-error'
import { toast } from 'sonner'

/**
 * AI generation modal — a shared component for the three AI doc-gen
 * entry points described in the design spec (block 3 §3.6).
 *
 * Three modes:
 *   - 'description' → POST /api/ai/hackathons/:id/generate-description
 *                     Save: PUT /api/hackathons/:id { description, descriptionEn }
 *   - 'news'        → POST /api/ai/hackathons/:id/generate-news
 *                     Save: PUT /api/hackathons/:id { newsZh, newsEn }
 *   - 'criteria'    → POST /api/ai/hackathons/:id/suggest-criteria
 *                     Save: caller-provided `onApplyCriteria` (e.g. to
 *                     ScoringCriteriaBuilder state)
 *
 * The modal keeps the same overall flow for all three modes:
 *   1. form (pre-filled from hackathon data, user-editable)
 *   2. loading state (skeleton + spinner + "5-15 seconds" text)
 *   3. preview (markdown rendered for description/news, table for criteria)
 *   4. error state with retry
 *   5. save → callback / mutation
 *
 * Visual style follows the macOS-like minimal language used elsewhere in
 * the project: 12px corners, soft shadow, dark-mode aware. The Sparkles
 * icon is purple to match the existing AIFeatures page.
 */

export type AIGenerateMode = 'description' | 'news' | 'criteria'

export type AIGenerateTone = 'professional' | 'casual' | 'academic' | 'tech-evangelist'

export type AIGenerateLanguage = 'zh' | 'en' | 'both'

export type AIErrorCode =
  | 'LLM_TIMEOUT'
  | 'LLM_RATE_LIMITED'
  | 'LLM_INVALID_KEY'
  | 'LLM_SCHEMA_INVALID'
  | 'CONTENT_BLOCKED'
  | 'RATE_LIMITED'
  | 'UNKNOWN'

export type AIDescriptionResult = {
  draft: { zh?: string; en?: string }
  model?: string
  tokensUsed?: number
  latencyMs?: number
  logId?: string
}

export type AINewsResult = AIDescriptionResult & {
  projects?: string[]
}

export type AICriterionSuggestion = {
  name: string
  weight: number
  maxScore: number
  sortOrder: number
  reasoning: string
}

export type AICriteriaResult = {
  suggestions: AICriterionSuggestion[]
  model?: string
  tokensUsed?: number
  latencyMs?: number
  logId?: string
}

export type AIGenerateModalProps = {
  hackathonId: string
  mode: AIGenerateMode
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-filled theme / tracks / prizePool (description mode). */
  initialTheme?: string
  initialTracks?: string[]
  initialPrizePool?: string
  initialDeadline?: string
  /**
   * Criteria mode only: called with the user's edited suggestions when
   * they click Save. The modal does NOT persist anything itself.
   */
  onApplyCriteria?: (suggestions: AICriterionSuggestion[]) => void | Promise<void>
  /**
   * Description / news mode only: called with the user's edited drafts
   * (zh / en). The modal does NOT persist anything itself.
   */
  onApplyDraft?: (draft: { zh?: string; en?: string }) => void | Promise<void>
}

type Phase = 'form' | 'loading' | 'preview' | 'error'

function translateErrorCode(t: (k: string) => string, code: string): string {
  if (code === 'LLM_TIMEOUT' || code === 'ECONNABORTED') return t('ai.generate.error_timeout')
  if (code === 'LLM_RATE_LIMITED' || code === 'RATE_LIMITED' || code === '429') return t('ai.generate.error_rate_limited')
  if (code === 'LLM_INVALID_KEY' || code === '401') return t('ai.generate.error_invalid_key')
  if (code === 'LLM_SCHEMA_INVALID' || code === 'CONTENT_BLOCKED') return t('ai.generate.error_schema')
  return t('ai.generate.error_generic')
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          toast.success(t('ai.generate.copy_success'))
          setTimeout(() => setCopied(false), 1500)
        } catch {
          toast.error(t('ai.generate.copy_success')) // copy fail rarely
        }
      }}
    >
      {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
      {label}
    </Button>
  )
}

export function AIGenerateModal({
  hackathonId,
  mode,
  open,
  onOpenChange,
  initialTheme = '',
  initialTracks = [],
  initialPrizePool = '',
  initialDeadline = '',
  onApplyCriteria,
  onApplyDraft,
}: AIGenerateModalProps) {
  const { t, i18n } = useTranslation()
  const [phase, setPhase] = useState<Phase>('form')
  const [errorCode, setErrorCode] = useState<string>('UNKNOWN')

  // form state
  const [theme, setTheme] = useState(initialTheme)
  const [tracks, setTracks] = useState<string[]>(initialTracks)
  const [trackDraft, setTrackDraft] = useState('')
  const [prizePool, setPrizePool] = useState(initialPrizePool)
  const [deadline, setDeadline] = useState(initialDeadline)
  const [tone, setTone] = useState<AIGenerateTone>('professional')
  const [language, setLanguage] = useState<AIGenerateLanguage>('both')
  const [focus, setFocus] = useState('')
  const [criterionCount, setCriterionCount] = useState(6)
  const [includeRunnerUps, setIncludeRunnerUps] = useState(false)

  // result state
  const [draftZh, setDraftZh] = useState('')
  const [draftEn, setDraftEn] = useState('')
  const [suggestions, setSuggestions] = useState<AICriterionSuggestion[]>([])
  const [tokensUsed, setTokensUsed] = useState(0)
  const [latencyMs, setLatencyMs] = useState(0)
  const [isSaving, setIsSaving] = useState(false)

  // preview tab — remember user choice between re-generates.
  const [previewTab, setPreviewTab] = useState<'zh' | 'en'>('zh')

  // Reset state when the modal is opened/closed/mode-changed.
  // We deliberately don't reset the form when results come back, so the
  // user can re-generate with the same inputs.
  const resetForOpen = useCallback(() => {
    setTheme(initialTheme)
    setTracks(initialTracks)
    setPrizePool(initialPrizePool)
    setDeadline(initialDeadline)
    setTone('professional')
    setLanguage('both')
    setFocus('')
    setCriterionCount(6)
    setIncludeRunnerUps(false)
    setDraftZh('')
    setDraftEn('')
    setSuggestions([])
    setTokensUsed(0)
    setLatencyMs(0)
    setPreviewTab(i18n.language?.startsWith('zh') ? 'zh' : 'en')
    setPhase('form')
    setErrorCode('UNKNOWN')
  }, [initialTheme, initialTracks, initialPrizePool, initialDeadline, i18n.language])

  const addTrack = useCallback(() => {
    const value = trackDraft.trim()
    if (!value) return
    if (tracks.includes(value)) {
      setTrackDraft('')
      return
    }
    if (tracks.length >= 5) return
    setTracks([...tracks, value])
    setTrackDraft('')
  }, [trackDraft, tracks])

  const removeTrack = useCallback(
    (value: string) => {
      setTracks(tracks.filter((tr) => tr !== value))
    },
    [tracks]
  )

  async function runGenerate() {
    setPhase('loading')
    setErrorCode('UNKNOWN')
    try {
      if (mode === 'description') {
        const result = await api.generateHackathonDescription({
          hackathonId,
          theme: theme || undefined,
          tracks: tracks.length > 0 ? tracks : undefined,
          prizePool: prizePool || undefined,
          submissionDeadline: deadline || undefined,
          tone,
          language,
        })
        setDraftZh(result.draft?.zh ?? '')
        setDraftEn(result.draft?.en ?? '')
        setTokensUsed(result.tokensUsed ?? 0)
        setLatencyMs(result.latencyMs ?? 0)
      } else if (mode === 'news') {
        const result = await api.generateHackathonNews({
          hackathonId,
          language,
          tone,
          includeRunnerUps,
        })
        setDraftZh(result.draft?.zh ?? '')
        setDraftEn(result.draft?.en ?? '')
        setTokensUsed(result.tokensUsed ?? 0)
        setLatencyMs(result.latencyMs ?? 0)
      } else {
        const result = await api.suggestHackathonCriteria({
          hackathonId,
          theme: theme || undefined,
          focus: focus || undefined,
          criterionCount,
        })
        setSuggestions(
          (result.suggestions || []).map((s, idx) => ({
            name: s.name,
            weight: s.weight,
            maxScore: s.maxScore ?? 10,
            sortOrder: s.sortOrder ?? idx + 1,
            reasoning: s.reasoning ?? '',
          }))
        )
        setTokensUsed(result.tokensUsed ?? 0)
        setLatencyMs(result.latencyMs ?? 0)
      }
      setPhase('preview')
    } catch (err) {
      const code = extractApiErrorMessage(err, 'UNKNOWN') || 'UNKNOWN'
      setErrorCode(code)
      setPhase('error')
    }
  }

  async function handleSave() {
    if (mode === 'criteria') {
      if (!onApplyCriteria) return
      // validate total weight = 100
      const total = suggestions.reduce((sum, s) => sum + (Number(s.weight) || 0), 0)
      if (total !== 100) {
        toast.error(t('ai.generate.criterion_weight_mismatch'))
        return
      }
      setIsSaving(true)
      try {
        await Promise.resolve(onApplyCriteria(suggestions))
        toast.success(t('ai.generate.save_success'))
        onOpenChange(false)
      } catch {
        toast.error(t('ai.generate.save_failed'))
      } finally {
        setIsSaving(false)
      }
      return
    }
    if (!onApplyDraft) return
    setIsSaving(true)
    try {
      await Promise.resolve(
        onApplyDraft({
          zh: language !== 'en' ? draftZh : undefined,
          en: language !== 'zh' ? draftEn : undefined,
        })
      )
      toast.success(t('ai.generate.save_success'))
      onOpenChange(false)
    } catch {
      toast.error(t('ai.generate.save_failed'))
    } finally {
      setIsSaving(false)
    }
  }

  const titleKey =
    mode === 'description'
      ? 'ai.generate.description_title'
      : mode === 'news'
        ? 'ai.generate.news_title'
        : 'ai.generate.criteria_title'
  const descKey =
    mode === 'description'
      ? 'ai.generate.description_desc'
      : mode === 'news'
        ? 'ai.generate.news_desc'
        : 'ai.generate.criteria_desc'

  // Form content — different per mode
  const formContent = useMemo(() => {
    if (mode === 'criteria') {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-theme">{t('ai.generate.theme_label')}</Label>
            <Input
              id="ai-theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder={t('ai.generate.theme_placeholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-focus">{t('ai.generate.focus_label')}</Label>
            <Textarea
              id="ai-focus"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder={t('ai.generate.focus_placeholder')}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-count">
              {t('ai.generate.criterion_count')}: <span className="font-mono">{criterionCount}</span>
            </Label>
            <input
              id="ai-count"
              type="range"
              min={3}
              max={8}
              value={criterionCount}
              onChange={(e) => setCriterionCount(Number(e.target.value))}
              className="w-full accent-primary"
              aria-label={t('ai.generate.criterion_count')}
            />
          </div>
        </div>
      )
    }
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t('ai.generate.language')}</Label>
          <div className="flex gap-2" role="radiogroup" aria-label={t('ai.generate.language_aria_label')}>
            {(['zh', 'en', 'both'] as AIGenerateLanguage[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                aria-checked={language === lang}
                role="radio"
                className={cn(
                  'flex-1 rounded-md border px-3 py-2 text-sm transition-colors',
                  language === lang
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input hover:bg-accent'
                )}
              >
                {t(`ai.generate.language_${lang}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-tone">{t('ai.generate.tone')}</Label>
          <select
            id="ai-tone"
            value={tone}
            onChange={(e) => setTone(e.target.value as AIGenerateTone)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="professional">{t('ai.generate.tone_professional')}</option>
            <option value="casual">{t('ai.generate.tone_casual')}</option>
            <option value="academic">{t('ai.generate.tone_academic')}</option>
            <option value="tech_evangelist">{t('ai.generate.tone_tech_evangelist')}</option>
          </select>
        </div>

        {mode === 'description' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="ai-theme">{t('ai.generate.theme_label')}</Label>
              <Textarea
                id="ai-theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder={t('ai.generate.theme_placeholder')}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('ai.generate.tracks_label')}</Label>
              <div className="flex flex-wrap gap-2">
                {tracks.map((tr) => (
                  <Badge key={tr} variant="secondary" className="gap-1">
                    {tr}
                    <button
                      type="button"
                      onClick={() => removeTrack(tr)}
                      aria-label={`remove ${tr}`}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {tracks.length < 5 && (
                  <Input
                    value={trackDraft}
                    onChange={(e) => setTrackDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTrack()
                      }
                    }}
                    placeholder={t('ai.generate.tracks_placeholder')}
                    className="w-48"
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ai-prize">{t('ai.generate.prize_label')}</Label>
                <Input
                  id="ai-prize"
                  value={prizePool}
                  onChange={(e) => setPrizePool(e.target.value)}
                  placeholder={t('ai.generate.prize_placeholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-deadline">{t('ai.generate.deadline_label')}</Label>
                <Input
                  id="ai-deadline"
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {mode === 'news' && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeRunnerUps}
              onChange={(e) => setIncludeRunnerUps(e.target.checked)}
              className="rounded border-input"
            />
            {t('ai.generate.include_runner_ups')}
          </label>
        )}
      </div>
    )
  }, [mode, t, theme, focus, criterionCount, language, tone, tracks, trackDraft, prizePool, deadline, includeRunnerUps, addTrack, removeTrack])

  const canSubmit = useMemo(() => {
    if (mode === 'criteria') return true
    return language !== 'both' || (true) // both is allowed
  }, [mode, language])

  const totalWeight = suggestions.reduce((sum, s) => sum + (Number(s.weight) || 0), 0)
  const showBothTabs = language === 'both'

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) resetForOpen()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            {t(titleKey)}
          </DialogTitle>
          <DialogDescription>{t(descKey)}</DialogDescription>
        </DialogHeader>

        {phase === 'form' && (
          <div className="space-y-4">
            {formContent}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={runGenerate} disabled={!canSubmit} className="gap-1">
                <Sparkles className="h-4 w-4" />
                {t('ai.generate.title')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase === 'loading' && (
          <div className="space-y-3" data-testid="ai-loading">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('ai.generate.loading_text')}
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-10/12" />
            <Skeleton className="h-4 w-9/12" />
            <Skeleton className="h-4 w-8/12" />
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-4" data-testid="ai-error">
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <div>
                <p className="font-medium">{t('ai.generate.error_title')}</p>
                <p className="text-muted-foreground">{translateErrorCode(t, errorCode)}</p>
                {errorCode && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono">{errorCode}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={runGenerate} className="gap-1">
                <RefreshCw className="h-4 w-4" />
                {t('common.save') === 'Save' ? 'Retry' : t('ai.generate.regenerate')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase === 'preview' && (
          <div className="space-y-4" data-testid="ai-preview">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                <span>
                  {t('ai.generate.tokens_used', { count: tokensUsed })} ·{' '}
                  {t('ai.generate.latency_ms', { count: latencyMs })}
                </span>
              </div>
            </div>

            {mode === 'criteria' ? (
              <div className="space-y-2">
                <Label>{t('ai.generate.preview_suggestions')}</Label>
                <div className="rounded-md border divide-y">
                  {suggestions.map((s, idx) => (
                    <div key={idx} className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={s.name}
                          onChange={(e) => {
                            const next = [...suggestions]
                            next[idx] = { ...s, name: e.target.value }
                            setSuggestions(next)
                          }}
                          placeholder={t('ai.generate.criterion_weight_label')}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          value={s.weight}
                          onChange={(e) => {
                            const next = [...suggestions]
                            next[idx] = { ...s, weight: Number(e.target.value) || 0 }
                            setSuggestions(next)
                          }}
                          className="w-20"
                          aria-label={t('ai.generate.criterion_weight_label')}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{s.reasoning}</p>
                    </div>
                  ))}
                </div>
                <p
                  className={cn(
                    'text-xs',
                    totalWeight === 100 ? 'text-green-600' : 'text-destructive'
                  )}
                >
                  {t('ai.generate.criterion_total_weight', { total: totalWeight })}
                </p>
              </div>
            ) : showBothTabs ? (
              <Tabs
                value={previewTab}
                onValueChange={(v) => setPreviewTab(v as 'zh' | 'en')}
              >
                <TabsList>
                  <TabsTrigger value="zh">{t('ai.generate.tab_zh')}</TabsTrigger>
                  <TabsTrigger value="en">{t('ai.generate.tab_en')}</TabsTrigger>
                </TabsList>
                <TabsContent value="zh">
                  <DraftEditor
                    value={draftZh}
                    onChange={setDraftZh}
                  />
                </TabsContent>
                <TabsContent value="en">
                  <DraftEditor
                    value={draftEn}
                    onChange={setDraftEn}
                  />
                </TabsContent>
              </Tabs>
            ) : language === 'zh' ? (
              <DraftEditor
                value={draftZh}
                onChange={setDraftZh}
              />
            ) : (
              <DraftEditor
                value={draftEn}
                onChange={setDraftEn}
              />
            )}

            <DialogFooter className="flex-wrap gap-2">
              <Button variant="outline" onClick={runGenerate} className="gap-1">
                <RefreshCw className="h-4 w-4" />
                {t('ai.generate.regenerate')}
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  isSaving ||
                  (mode === 'criteria' && totalWeight !== 100) ||
                  (mode !== 'criteria' && !draftZh && !draftEn && (mode === 'description' || mode === 'news'))
                }
                className="gap-1"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t('ai.generate.save')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DraftEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Markdown</Label>
        <CopyButton value={value} label={t('ai.generate.copy')} />
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={14}
        className="font-mono text-sm"
      />
    </div>
  )
}
