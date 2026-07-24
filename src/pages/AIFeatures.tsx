/**
 * AI 功能演示页面（v2.2）
 *
 * 设计要点：
 * - 全 i18n 化（zh + en），跟项目其他 20 个 page 一致
 * - 6 个 tab 覆盖 v2.1 全部 AI 能力（项目分析、评分一致性、内容审核、内容生成、抄袭检测、AI 运行状态）
 * - 4 个 mutation 全部有 onError / 错误分类（network / unauthorized / server / timeout）
 * - batch analyze 任务进度实时跟踪（轮询 batch-status endpoint）
 * - 每个输入区有"样例"快捷填充
 * - 生成结果可一键复制
 *
 * 改动历史：见 docs/AI_FEATURES_CHANGELOG.md
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wand2,
  Brain,
  Shield,
  FileText,
  Search,
  Activity,
  Copy,
  Check,
  AlertTriangle,
  XCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { classifyApiError } from '@/lib/api-error'
import { toast } from 'sonner'
import { useActiveHackathon } from '@/lib/active-hackathon'

// ==================== Types ====================

interface ConsistencyJudge {
  judgeId: string
  judgeName: string
  bias: 'balanced' | 'too_strict' | 'too_lenient'
  avgScore: number
  stdDeviation: number
  biasScore: number
  suggestion: string
}

interface ModerationFlag {
  type: string
  severity: string
  description: string
}

interface ModerationResult {
  isAppropriate: boolean
  flags: ModerationFlag[]
  suggestedAction: 'approve' | 'review' | 'reject'
}

interface BatchStatus {
  taskId: string
  status: 'processing' | 'completed' | 'failed'
  total: number
  completed: number
  failed: number
  progress: number
  startedAt: number
  finishedAt?: number
  errors: Array<{ projectId: string; message: string }>
}

interface AIMetrics {
  calls: Record<string, number>
  errors: Record<string, number>
  avgDurationMs: number
}

// ==================== Error 分类 helper ====================

/**
 * 把 axios 错误 / fetch 错误 / 普通错误统一映射到 5 类用户友好消息。
 * 不暴露后端 error.message 原文（脱敏原则 — 见 api/routes/ai.ts 改造）。
 */
function classifyError(err: unknown, t: (key: string, opts?: Record<string, string>) => string): string { return classifyApiError(err, t) }

// ==================== 复制按钮 ====================

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success(label)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Copy failed')
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? '✓' : label}
    </Button>
  )
}

// ==================== 加载骨架屏 ====================

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-muted rounded w-full" style={{ width: `${100 - i * 10}%` }} />
      ))}
    </div>
  )
}

// ==================== 主组件 ====================

export function AIFeatures() {
  const { t } = useTranslation()
  const { activeHackathon } = useActiveHackathon()
  const queryClient = useQueryClient()

  // ---- Tab 1: 项目分析 ----
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)

  const batchAnalyzeMutation = useMutation({
    mutationFn: async () => {
      if (!activeHackathon?.id) {
        throw new Error(t('ai_features.analyze.no_hackathon'))
      }
      return await api.batchAnalyzeProjects({ hackathonId: activeHackathon.id })
    },
    onSuccess: (data) => {
      if (data?.taskId) {
        setActiveTaskId(data.taskId)
        toast.success(t('ai_features.analyze.started_toast', { taskId: data.taskId }))
      } else {
        toast.success(t('ai_features.analyze.started_toast', { taskId: '?' }))
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (err) => {
      toast.error(classifyError(err, t))
    },
  })

  // 轮询 batch status（任务进行中时）
  // PERFORMANCE: cap polling at 30 minutes so a stuck task does not keep the
  // page waking the network every 2s forever. After 30 min we stop the
  // interval and the user can manually re-trigger.
  const [batchPollingMountedAt] = useState(() => Date.now())
  const { data: batchStatus } = useQuery<BatchStatus | null>({
    queryKey: ['batch-status', activeTaskId],
    queryFn: async () => {
      if (!activeTaskId) return null
      try {
        const data = await api.getBatchStatus(activeTaskId)
        // 任务已被服务清理（404 / 过期），停止轮询 + 提示用户
        if (!data) {
          setActiveTaskId(null)
          toast.warning(t('ai_features.analyze.task_not_found'))
        }
        return data
      } catch (err: unknown) {
        // 4xx 错误（404 / 410）：任务已过期，停止轮询
        const e = err as { response?: { status?: number } }
        if (e?.response?.status === 404 || e?.response?.status === 410) {
          setActiveTaskId(null)
          toast.warning(t('ai_features.analyze.task_not_found'))
          return null
        }
        // 其他错误（5xx / 网络）继续轮询，等恢复
        return null
      }
    },
    enabled: !!activeTaskId,
    refetchInterval: (query) => {
      const data = query.state.data as BatchStatus | null | undefined
      // 任务已完成或失败，停止轮询
      if (data && (data.status === 'completed' || data.status === 'failed')) {
        return false
      }
      // 30 min hard cap (per 2026-07-24 perf audit P1-2 / P2-4)
      if (Date.now() - batchPollingMountedAt > 30 * 60 * 1000) {
        return false
      }
      return 2000 // 进行中每 2s 轮询
    },
  })

  // ---- Tab 2: 评分一致性 ----
  const { data: consistencyData, isLoading: isLoadingConsistency, error: consistencyError, refetch: refetchConsistency } = useQuery({
    queryKey: ['scoring-consistency', activeHackathon?.id],
    queryFn: async () => {
      if (!activeHackathon?.id) return null
      return await api.getScoringConsistency(activeHackathon.id)
    },
    enabled: false,
  })

  // ---- Tab 3: 内容审核 ----
  const [testContent, setTestContent] = useState('')
  const moderateMutation = useMutation({
    mutationFn: async (content: string) => {
      return await api.moderateContent(content, 'project')
    },
    onError: (err) => {
      toast.error(classifyError(err, t))
    },
  })

  // ---- Tab 4: 内容生成 ----
  const [generateType, setGenerateType] = useState<string>('description')
  const [generateLanguage, setGenerateLanguage] = useState<string>('zh')
  const [generateStyle, setGenerateStyle] = useState<string>('business')
  const [generateInput, setGenerateInput] = useState('')
  const [generatedContent, setGeneratedContent] = useState('')
  const generateMutation = useMutation({
    mutationFn: async () => {
      // 把自由输入按 type 拆成 context（README/pitch/news/email/criteria 都吃 title + description + ...）
      const context = parseGenerateInput(generateInput, generateType)
      return await api.generateContent({
        type: generateType,
        context,
        language: generateLanguage,
        style: generateStyle,
      })
    },
    onSuccess: (data) => {
      setGeneratedContent(data.content || '')
      toast.success(t('ai_features.generate.copied_toast'))
    },
    onError: (err) => {
      toast.error(classifyError(err, t))
    },
  })

  // ---- Tab 5: 抄袭检测 ----
  const [text1, setText1] = useState('')
  const [text2, setText2] = useState('')
  const similarityMutation = useMutation({
    mutationFn: async () => {
      return await api.detectSimilarity(text1, text2)
    },
    onError: (err) => {
      toast.error(classifyError(err, t))
    },
  })

  // ---- Tab 6: AI Metrics ----
  const { data: aiMetrics, refetch: refetchMetrics, isLoading: isLoadingMetrics } = useQuery<AIMetrics>({
    queryKey: ['ai-metrics'],
    queryFn: async () => await api.getAIMetrics(),
    enabled: false,
  })

  // ==================== Render ====================

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-purple-500" />
            {t('ai_features.page_title')}
          </h1>
          <p className="text-muted-foreground mt-2">{t('ai_features.page_subtitle')}</p>
        </div>
        <Badge variant="outline" className="text-sm">
          <Brain className="h-4 w-4 mr-1" />
          {t('ai_features.version_badge')}
        </Badge>
      </div>

      <Tabs defaultValue="analyze" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
          <TabsTrigger value="analyze">
            <Wand2 className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">{t('ai_features.tabs.analyze')}</span>
          </TabsTrigger>
          <TabsTrigger value="consistency">
            <Brain className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">{t('ai_features.tabs.consistency')}</span>
          </TabsTrigger>
          <TabsTrigger value="moderate">
            <Shield className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">{t('ai_features.tabs.moderate')}</span>
          </TabsTrigger>
          <TabsTrigger value="generate">
            <FileText className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">{t('ai_features.tabs.generate')}</span>
          </TabsTrigger>
          <TabsTrigger value="plagiarism">
            <Search className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">{t('ai_features.tabs.plagiarism')}</span>
          </TabsTrigger>
          <TabsTrigger value="metrics">
            <Activity className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">{t('ai_features.tabs.metrics')}</span>
          </TabsTrigger>
        </TabsList>

        {/* ==================== Tab 1: 项目分析 ==================== */}
        <TabsContent value="analyze">
          <Card>
            <CardHeader>
              <CardTitle>{t('ai_features.analyze.title')}</CardTitle>
              <CardDescription>{t('ai_features.analyze.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 bg-muted/50">
                <h3 className="font-semibold mb-2">{t('ai_features.analyze.feature_list_intro')}</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• {t('ai_features.analyze.feature_1')}</li>
                  <li>• {t('ai_features.analyze.feature_2')}</li>
                  <li>• {t('ai_features.analyze.feature_3')}</li>
                  <li>• {t('ai_features.analyze.feature_4')}</li>
                </ul>
              </div>

              <Button
                onClick={() => batchAnalyzeMutation.mutate()}
                disabled={batchAnalyzeMutation.isPending || !activeHackathon}
                size="lg"
                className="w-full"
              >
                {batchAnalyzeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('ai_features.analyze.starting')}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {t('ai_features.analyze.start_button')}
                  </>
                )}
              </Button>

              {/* 任务进度跟踪：mutation onSuccess 后开始显示，轮询 batch-status */}
              {activeTaskId && (
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t('ai_features.analyze.progress_label')} · {activeTaskId}
                    </span>
                    {batchStatus && (
                      <Badge
                        variant={
                          batchStatus.status === 'completed'
                            ? 'default'
                            : batchStatus.status === 'failed'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {batchStatus.status === 'processing'
                          ? t('ai_features.analyze.task_status_processing')
                          : batchStatus.status === 'completed'
                          ? t('ai_features.analyze.task_status_completed')
                          : t('ai_features.analyze.task_status_failed')}
                      </Badge>
                    )}
                  </div>
                  {batchStatus && (
                    <>
                      <Progress value={batchStatus.progress} className="h-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {batchStatus.completed} / {batchStatus.total}{' '}
                          {t('ai_features.analyze.completed_label')}
                          {batchStatus.failed > 0 && (
                            <span className="text-destructive ml-2">
                              ({batchStatus.failed} {t('ai_features.analyze.failed_label')})
                            </span>
                          )}
                        </span>
                        <span>{batchStatus.progress}%</span>
                      </div>
                      {batchStatus.errors?.length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            {t('ai_features.analyze.errors_section')}
                          </summary>
                          <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                            {batchStatus.errors.map((e, i) => (
                              <li key={i} className="font-mono text-destructive">
                                {e.projectId.slice(0, 8)}: {e.message}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </>
                  )}
                </div>
              )}

              {!activeHackathon && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  {t('ai_features.analyze.no_hackathon')}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== Tab 2: 评分一致性 ==================== */}
        <TabsContent value="consistency">
          <Card>
            <CardHeader>
              <CardTitle>{t('ai_features.consistency.title')}</CardTitle>
              <CardDescription>{t('ai_features.consistency.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => refetchConsistency()}
                disabled={isLoadingConsistency || !activeHackathon}
                size="lg"
                className="w-full"
              >
                {isLoadingConsistency ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('ai_features.consistency.analyzing')}
                  </>
                ) : (
                  <>
                    <Brain className="mr-2 h-4 w-4" />
                    {t('ai_features.consistency.analyze_button')}
                  </>
                )}
              </Button>

              {isLoadingConsistency && <Skeleton lines={4} />}

              {consistencyError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <XCircle className="h-4 w-4" />
                  {classifyError(consistencyError, t)}
                </div>
              )}

              {consistencyData && Array.isArray(consistencyData) && consistencyData.length > 0 && (
                <div className="space-y-3 mt-4">
                  {consistencyData.map((judge: ConsistencyJudge) => (
                    <div key={judge.judgeId} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{judge.judgeName}</h3>
                        <Badge
                          variant={
                            judge.bias === 'balanced'
                              ? 'default'
                              : judge.bias === 'too_strict'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {judge.bias === 'balanced'
                            ? t('ai_features.consistency.bias_balanced')
                            : judge.bias === 'too_strict'
                            ? t('ai_features.consistency.bias_too_strict')
                            : t('ai_features.consistency.bias_too_lenient')}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                        <div>
                          <span className="text-muted-foreground">{t('ai_features.consistency.avg_score')}：</span>
                          <span className="font-medium">{judge.avgScore.toFixed(1)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('ai_features.consistency.std_dev')}：</span>
                          <span className="font-medium">{judge.stdDeviation.toFixed(1)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('ai_features.consistency.bias')}：</span>
                          <span
                            className={`font-medium ${
                              judge.biasScore > 0
                                ? 'text-orange-600'
                                : judge.biasScore < 0
                                ? 'text-blue-600'
                                : ''
                            }`}
                          >
                            {judge.biasScore > 0 ? '+' : ''}
                            {judge.biasScore.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{judge.suggestion}</p>
                    </div>
                  ))}
                </div>
              )}

              {consistencyData && Array.isArray(consistencyData) && consistencyData.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  {t('ai_features.consistency.empty')}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== Tab 3: 内容审核 ==================== */}
        <TabsContent value="moderate">
          <Card>
            <CardHeader>
              <CardTitle>{t('ai_features.moderate.title')}</CardTitle>
              <CardDescription>{t('ai_features.moderate.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  {t('ai_features.moderate.input_label')}
                </Label>
                <Textarea
                  placeholder={t('ai_features.moderate.input_placeholder')}
                  value={testContent}
                  onChange={(e) => setTestContent(e.target.value)}
                  rows={6}
                />
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span>{testContent.length} chars</span>
                  {testContent.length > 10000 && (
                    <Badge variant="outline" className="text-xs">
                      {t('ai_features.moderate.truncated_notice', { original: String(testContent.length) })}
                    </Badge>
                  )}
                </div>
              </div>

              {/* 样例快捷填充 */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  {t('ai_features.moderate.examples_title')}
                </Label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setTestContent(SAMPLES.moderate.spam)}>
                    {t('ai_features.moderate.example_spam')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setTestContent(SAMPLES.moderate.clean)}>
                    {t('ai_features.moderate.example_clean')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setTestContent(SAMPLES.moderate.sensitive)}>
                    {t('ai_features.moderate.example_sensitive')}
                  </Button>
                </div>
              </div>

              <Button
                onClick={() => moderateMutation.mutate(testContent)}
                disabled={moderateMutation.isPending || !testContent}
                size="lg"
                className="w-full"
              >
                {moderateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('ai_features.moderate.checking')}
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    {t('ai_features.moderate.check_button')}
                  </>
                )}
              </Button>

              {moderateMutation.error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <XCircle className="h-4 w-4" />
                  {classifyError(moderateMutation.error, t)}
                </div>
              )}

              {moderateMutation.data && (
                <ModerationResultView data={moderateMutation.data} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== Tab 4: 内容生成 ==================== */}
        <TabsContent value="generate">
          <Card>
            <CardHeader>
              <CardTitle>{t('ai_features.generate.title')}</CardTitle>
              <CardDescription>{t('ai_features.generate.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-sm mb-1 block">{t('ai_features.generate.type_label')}</Label>
                  <Select value={generateType} onValueChange={setGenerateType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="description">{t('ai_features.generate.type_description')}</SelectItem>
                      <SelectItem value="readme">{t('ai_features.generate.type_readme')}</SelectItem>
                      <SelectItem value="pitch">{t('ai_features.generate.type_pitch')}</SelectItem>
                      <SelectItem value="news">{t('ai_features.generate.type_news')}</SelectItem>
                      <SelectItem value="email">{t('ai_features.generate.type_email')}</SelectItem>
                      <SelectItem value="criteria">{t('ai_features.generate.type_criteria')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm mb-1 block">{t('ai_features.generate.language_label')}</Label>
                  <Select value={generateLanguage} onValueChange={setGenerateLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh">{t('ai_features.generate.language_zh')}</SelectItem>
                      <SelectItem value="en">{t('ai_features.generate.language_en')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm mb-1 block">{t('ai_features.generate.style_label')}</Label>
                  <Select value={generateStyle} onValueChange={setGenerateStyle}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="business">{t('ai_features.generate.style_business')}</SelectItem>
                      <SelectItem value="academic">{t('ai_features.generate.style_academic')}</SelectItem>
                      <SelectItem value="casual">{t('ai_features.generate.style_casual')}</SelectItem>
                      <SelectItem value="technical">{t('ai_features.generate.style_technical')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">
                  {t('ai_features.generate.input_label')}
                </Label>
                <Textarea
                  placeholder={t(`ai_features.generate.input_placeholder_${generateType}`)}
                  value={generateInput}
                  onChange={(e) => setGenerateInput(e.target.value)}
                  rows={6}
                />
                <div className="mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGenerateInput(SAMPLES.generate)}
                  >
                    {t('ai_features.generate.example_button')}
                  </Button>
                </div>
              </div>

              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || !generateInput}
                size="lg"
                className="w-full"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('ai_features.generate.generating')}
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    {t('ai_features.generate.generate_button')}
                  </>
                )}
              </Button>

              {generateMutation.error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <XCircle className="h-4 w-4" />
                  {classifyError(generateMutation.error, t)}
                </div>
              )}

              {generatedContent && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">{t('ai_features.generate.result_label')}</Label>
                    <CopyButton
                      text={generatedContent}
                      label={t('ai_features.generate.copy_button')}
                    />
                  </div>
                  <div className="rounded-lg border p-4 bg-muted/50">
                    <p className="text-sm whitespace-pre-wrap">{generatedContent}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== Tab 5: 抄袭检测 ==================== */}
        <TabsContent value="plagiarism">
          <Card>
            <CardHeader>
              <CardTitle>{t('ai_features.plagiarism.title')}</CardTitle>
              <CardDescription>{t('ai_features.plagiarism.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  {t('ai_features.plagiarism.text1_label')}
                </Label>
                <Textarea
                  placeholder={t('ai_features.plagiarism.text_placeholder')}
                  value={text1}
                  onChange={(e) => setText1(e.target.value)}
                  rows={5}
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  {t('ai_features.plagiarism.text2_label')}
                </Label>
                <Textarea
                  placeholder={t('ai_features.plagiarism.text_placeholder')}
                  value={text2}
                  onChange={(e) => setText2(e.target.value)}
                  rows={5}
                />
              </div>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setText1(SAMPLES.plagiarism.text1)
                    setText2(SAMPLES.plagiarism.text2)
                  }}
                >
                  {t('ai_features.plagiarism.example_button')}
                </Button>
              </div>
              <Button
                onClick={() => similarityMutation.mutate()}
                disabled={similarityMutation.isPending || !text1 || !text2}
                size="lg"
                className="w-full"
              >
                {similarityMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('ai_features.plagiarism.comparing')}
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    {t('ai_features.plagiarism.compare_button')}
                  </>
                )}
              </Button>

              {similarityMutation.error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <XCircle className="h-4 w-4" />
                  {classifyError(similarityMutation.error, t)}
                </div>
              )}

              {similarityMutation.data && (
                <SimilarityResultView similarity={similarityMutation.data.similarity} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== Tab 6: AI Metrics ==================== */}
        <TabsContent value="metrics">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('ai_features.metrics.title')}</CardTitle>
                <CardDescription>{t('ai_features.metrics.description')}</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchMetrics()}>
                {t('ai_features.metrics.refresh_button')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingMetrics && <Skeleton lines={4} />}

              {aiMetrics && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <MetricCard
                      label={t('ai_features.metrics.metric_calls')}
                      value={Object.values(aiMetrics.calls).reduce((a, b) => a + b, 0)}
                    />
                    <MetricCard
                      label={t('ai_features.metrics.metric_errors')}
                      value={Object.values(aiMetrics.errors).reduce((a, b) => a + b, 0)}
                      variant={Object.values(aiMetrics.errors).reduce((a, b) => a + b, 0) > 0 ? 'warning' : 'default'}
                    />
                    <MetricCard
                      label={t('ai_features.metrics.metric_timeout')}
                      value={aiMetrics.errors.timeout || 0}
                      variant={(aiMetrics.errors.timeout || 0) > 0 ? 'destructive' : 'default'}
                    />
                    <MetricCard
                      label={t('ai_features.metrics.metric_avg_duration')}
                      value={aiMetrics.avgDurationMs}
                      unit="ms"
                    />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-2">{t('ai_features.metrics.by_provider')}</h3>
                    <div className="space-y-2">
                      {Object.entries(aiMetrics.calls).map(([provider, count]) => {
                        const errCount = aiMetrics.errors[provider] || 0
                        return (
                          <div
                            key={provider}
                            className="flex items-center justify-between text-sm border rounded p-2"
                          >
                            <span className="font-mono">{provider}</span>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>calls: {count}</span>
                              <span className={errCount > 0 ? 'text-destructive' : ''}>errs: {errCount}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}

              {aiMetrics &&
                Object.values(aiMetrics.calls).reduce((a, b) => a + b, 0) === 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    {t('ai_features.metrics.no_data')}
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ==================== Sub-views ====================

function ModerationResultView({ data }: { data: ModerationResult }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-3">
        {data.isAppropriate ? (
          <>
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="font-semibold text-green-600">
              {t('ai_features.moderate.result_appropriate')}
            </span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="font-semibold text-red-600">
              {t('ai_features.moderate.result_inappropriate')}
            </span>
          </>
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm">
          <span className="text-muted-foreground">{t('ai_features.moderate.suggested_action')}：</span>
          <Badge className="ml-2">
            {data.suggestedAction === 'approve'
              ? t('ai_features.moderate.action_approve')
              : data.suggestedAction === 'review'
              ? t('ai_features.moderate.action_review')
              : t('ai_features.moderate.action_reject')}
          </Badge>
        </p>
        {data.flags?.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-medium mb-2">{t('ai_features.moderate.flags_title')}：</p>
            <ul className="space-y-1">
              {data.flags.map((flag, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <Badge variant={flag.severity === 'high' ? 'destructive' : 'secondary'}>
                    {flag.type}
                  </Badge>
                  <span className="text-muted-foreground">{flag.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function SimilarityResultView({ similarity }: { similarity: number }) {
  const { t } = useTranslation()
  const variant = similarity > 70 ? 'destructive' : similarity > 30 ? 'default' : 'secondary'
  const interpretationKey =
    similarity > 70
      ? 'result_interpretation_high'
      : similarity > 30
      ? 'result_interpretation_medium'
      : 'result_interpretation_low'
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t('ai_features.plagiarism.result_similarity')}
        </span>
        <Badge variant={variant}>{similarity}%</Badge>
      </div>
      <div className="h-2 bg-muted rounded overflow-hidden">
        <div
          className={`h-full transition-all ${
            similarity > 70 ? 'bg-red-500' : similarity > 30 ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, similarity))}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t(`ai_features.plagiarism.${interpretationKey}`)}</p>
    </div>
  )
}

function MetricCard({
  label,
  value,
  unit,
  variant = 'default',
}: {
  label: string
  value: number
  unit?: string
  variant?: 'default' | 'warning' | 'destructive'
}) {
  const colorClass =
    variant === 'destructive' ? 'text-red-600' : variant === 'warning' ? 'text-orange-600' : ''
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${colorClass}`}>
        {value}
        {unit && <span className="text-sm text-muted-foreground ml-1">{unit}</span>}
      </div>
    </div>
  )
}

// ==================== 样例 / 工具 ====================

/**
 * 统一的样例数据，按 tab + 用途分类。
 * 用途：在用户首次进入时一键填充输入框，降低首次使用门槛。
 */
const SAMPLES = {
  moderate: {
    spam: '🔥🔥🔥 免费送 iPhone 15 Pro Max！加微信 123456，立刻发货！100% 正品，假一赔十！限时优惠仅剩 3 个名额！',
    clean: '我们团队开发了一个 AI 驱动的代码审查工具，能在 PR 提交时自动检测安全漏洞、性能问题和最佳实践违规。核心技术栈：TypeScript + Rust + Claude API。',
    sensitive: '某些政治敏感话题的讨论，包含不当言论和人身攻击。',
  },
  generate: `一个面向中小型开发团队的 AI 辅助代码审查平台。
核心功能：PR 提交时自动扫描安全漏洞、性能瓶颈和代码风格问题，并给出修复建议。
技术栈：Next.js + TypeScript + PostgreSQL + Claude API。
目标用户：5-50 人规模的技术团队，希望在 code review 阶段提效 50%。`,
  plagiarism: {
    text1: '我们开发了一个 AI 驱动的代码审查工具，能在 PR 提交时自动检测安全漏洞、性能问题和最佳实践违规。',
    text2: '我们做了一个 AI 代码 review 平台，提交 PR 时自动扫描安全 bug、性能瓶颈和代码风格，给出修改建议。',
  },
} as const

function parseGenerateInput(input: string, type: string): Record<string, unknown> {
  // 简单规则：把多行输入按行拆，不同 type 映射到不同 context 字段
  const lines = input.split('\n').map((l) => l.trim()).filter(Boolean)
  switch (type) {
    case 'description':
      return { original: input }
    case 'readme':
      return {
        title: lines[0] || '',
        description: lines[1] || '',
        techStack: lines[2] ? lines[2].split(/[,，;；]/) : [],
      }
    case 'pitch':
      return {
        title: lines[0] || '',
        description: lines[1] || '',
        goal: lines[2] || '',
      }
    case 'news':
      return {
        title: lines[0] || '',
        award: lines[1] || '',
        description: lines[2] || '',
      }
    case 'email':
      return {
        subject: lines[0] || '',
        recipient: lines[1] || '',
        scenario: lines[2] || '',
      }
    case 'criteria':
      return {
        theme: lines[0] || '',
        focus: lines[1] || '',
      }
    default:
      return { customPrompt: input }
  }
}
