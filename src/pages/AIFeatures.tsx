/**
 * AI功能演示页面
 * 管理员可以在这里测试和配置AI功能
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Loader2, CheckCircle2, AlertCircle, Wand2, Brain, Shield, FileText, Newspaper, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { AIGenerateModal } from '@/components/ai/AIGenerateModal'
import { useTranslation } from 'react-i18next'

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

export function AIFeatures() {
  const { t } = useTranslation()
  const { activeHackathon } = useActiveHackathon()
  const queryClient = useQueryClient()
  const [testContent, setTestContent] = useState('')
  const [generatedContent, setGeneratedContent] = useState('')
  const [aiMode, setAiMode] = useState<'description' | 'news' | 'criteria' | null>(null)

  // 批量分析项目
  const batchAnalyzeMutation = useMutation({
    mutationFn: async () => {
      return await api.batchAnalyzeProjects({ hackathonId: activeHackathon?.id })
    },
    onSuccess: () => {
      toast.success('已开始批量AI分析，请稍后刷新查看结果')
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: () => {
      toast.error('批量分析失败，请检查AI配置')
    },
  })

  // 评分一致性分析
  const { data: consistencyData, isLoading: isLoadingConsistency, refetch: refetchConsistency } = useQuery({
    queryKey: ['scoring-consistency', activeHackathon?.id],
    queryFn: async () => {
      if (!activeHackathon?.id) return null
      return await api.getScoringConsistency(activeHackathon.id)
    },
    enabled: false,
  })

  // 内容审核测试
  const moderateMutation = useMutation({
    mutationFn: async (content: string) => {
      return await api.moderateContent(content, 'project')
    },
  })

  // 内容优化测试
  const optimizeMutation = useMutation({
    mutationFn: async (content: string) => {
      return await api.optimizeDescription(content, 'zh', 'business')
    },
    onSuccess: (data) => {
      setGeneratedContent(data.optimized)
      toast.success('内容已优化')
    },
  })

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-purple-500" />
            AI功能控制台
          </h1>
          <p className="text-muted-foreground mt-2">
            测试和配置AI增强功能
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          <Brain className="h-4 w-4 mr-1" />
          AI v2.1
        </Badge>
      </div>

      <Tabs defaultValue="analyze" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="analyze">
            <Wand2 className="h-4 w-4 mr-2" />
            项目分析
          </TabsTrigger>
          <TabsTrigger value="consistency">
            <Brain className="h-4 w-4 mr-2" />
            评分一致性
          </TabsTrigger>
          <TabsTrigger value="moderate">
            <Shield className="h-4 w-4 mr-2" />
            内容审核
          </TabsTrigger>
          <TabsTrigger value="generate">
            <FileText className="h-4 w-4 mr-2" />
            内容生成
          </TabsTrigger>
        </TabsList>

        {/* 项目分析 */}
        <TabsContent value="analyze">
          <Card>
            <CardHeader>
              <CardTitle>批量项目质量分析</CardTitle>
              <CardDescription>
                使用AI自动分析所有项目，生成0-100分评分和详细报告
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 bg-muted/50">
                <h3 className="font-semibold mb-2">功能说明</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 自动评估项目的完整性、创新性、技术深度和呈现质量</li>
                  <li>• 识别项目亮点和潜在问题</li>
                  <li>• 提取技术标签和评估复杂度</li>
                  <li>• 分析结果会缓存24小时，避免重复调用</li>
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
                    分析中...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    开始批量分析
                  </>
                )}
              </Button>

              {batchAnalyzeMutation.isSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  批量分析任务已启动，结果将在几分钟内生成
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 评分一致性分析 */}
        <TabsContent value="consistency">
          <Card>
            <CardHeader>
              <CardTitle>评委评分一致性分析</CardTitle>
              <CardDescription>
                检测评委评分偏差，识别过严或过宽的评委
              </CardDescription>
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
                    分析中...
                  </>
                ) : (
                  <>
                    <Brain className="mr-2 h-4 w-4" />
                    分析评分一致性
                  </>
                )}
              </Button>

              {consistencyData && Array.isArray(consistencyData) && consistencyData.length > 0 && (
                <div className="space-y-3 mt-4">
                  {consistencyData.map((judge: ConsistencyJudge) => (
                    <div key={judge.judgeId} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{judge.judgeName}</h3>
                        <Badge variant={
                          judge.bias === 'balanced' ? 'default' :
                          judge.bias === 'too_strict' ? 'destructive' : 'secondary'
                        }>
                          {judge.bias === 'balanced' ? '均衡' :
                           judge.bias === 'too_strict' ? '偏严格' : '偏宽松'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                        <div>
                          <span className="text-muted-foreground">平均分：</span>
                          <span className="font-medium">{judge.avgScore.toFixed(1)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">标准差：</span>
                          <span className="font-medium">{judge.stdDeviation.toFixed(1)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">偏差：</span>
                          <span className={`font-medium ${judge.biasScore > 0 ? 'text-orange-600' : judge.biasScore < 0 ? 'text-blue-600' : ''}`}>
                            {judge.biasScore > 0 ? '+' : ''}{judge.biasScore.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{judge.suggestion}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 内容审核 */}
        <TabsContent value="moderate">
          <Card>
            <CardHeader>
              <CardTitle>内容安全审核测试</CardTitle>
              <CardDescription>
                测试AI内容审核功能，检测敏感内容和垃圾信息
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="输入要审核的内容..."
                value={testContent}
                onChange={(e) => setTestContent(e.target.value)}
                rows={6}
              />
              <Button
                onClick={() => moderateMutation.mutate(testContent)}
                disabled={moderateMutation.isPending || !testContent}
                size="lg"
                className="w-full"
              >
                {moderateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    审核中...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    审核内容
                  </>
                )}
              </Button>

              {moderateMutation.data && (
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    {moderateMutation.data.isAppropriate ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-green-600">内容合适</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        <span className="font-semibold text-red-600">内容不合适</span>
                      </>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="text-muted-foreground">建议操作：</span>
                      <Badge className="ml-2">
                        {moderateMutation.data.suggestedAction === 'approve' ? '批准' :
                         moderateMutation.data.suggestedAction === 'review' ? '人工审核' : '拒绝'}
                      </Badge>
                    </p>
                    {moderateMutation.data.flags?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium mb-2">检测到的问题：</p>
                        <ul className="space-y-1">
                          {moderateMutation.data.flags.map((flag: ModerationFlag, i: number) => (
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 内容生成 */}
        <TabsContent value="generate">
          <Card>
            <CardHeader>
              <CardTitle>智能内容优化</CardTitle>
              <CardDescription>
                使用AI优化项目描述，使其更专业、清晰、吸引人
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">原始描述</label>
                <Textarea
                  placeholder="输入项目描述..."
                  value={testContent}
                  onChange={(e) => setTestContent(e.target.value)}
                  rows={6}
                />
              </div>
              <Button
                onClick={() => optimizeMutation.mutate(testContent)}
                disabled={optimizeMutation.isPending || !testContent}
                size="lg"
                className="w-full"
              >
                {optimizeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    优化中...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    AI优化
                  </>
                )}
              </Button>

              {generatedContent && (
                <div>
                  <label className="text-sm font-medium mb-2 block">优化后</label>
                  <div className="rounded-lg border p-4 bg-muted/50">
                    <p className="text-sm whitespace-pre-wrap">{generatedContent}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 配置提示 */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">配置说明</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>请确保在 <code className="bg-muted px-1 py-0.5 rounded">.env</code> 文件中配置了以下环境变量：</p>
          <pre className="bg-muted p-3 rounded-lg overflow-x-auto">
{`AI_PROVIDER=claude
AI_API_KEY=sk-ant-your-key-here
AI_MODEL=claude-sonnet-4-20250514`}
          </pre>
          <p className="text-muted-foreground">
            💡 提示：支持Claude、OpenAI、DeepSeek和本地Ollama模型
          </p>
        </CardContent>
      </Card>

      {/* AI doc gen entry points — also reachable from this console for users who
          don't have a current hackathon open. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            AI 文档生成
          </CardTitle>
          <CardDescription>使用 AI 起草赛事说明、获奖新闻稿、评分维度建议</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setAiMode('description')}
            disabled={!activeHackathon?.id}
            className="gap-1"
            data-testid="ai-features-description"
          >
            <FileText className="h-4 w-4" />
            {t('ai.generate.open_button_description')}
          </Button>
          <Button
            variant="outline"
            onClick={() => setAiMode('news')}
            disabled={!activeHackathon?.id}
            className="gap-1"
            data-testid="ai-features-news"
          >
            <Newspaper className="h-4 w-4" />
            {t('ai.generate.open_button_news')}
          </Button>
          <Button
            variant="outline"
            onClick={() => setAiMode('criteria')}
            disabled={!activeHackathon?.id}
            className="gap-1"
            data-testid="ai-features-criteria"
          >
            <ListChecks className="h-4 w-4" />
            {t('ai.generate.open_button_criteria')}
          </Button>
          {!activeHackathon?.id && (
            <p className="text-xs text-muted-foreground w-full">请先选择当前黑客松。</p>
          )}
        </CardContent>
      </Card>

      {aiMode && activeHackathon?.id && (
        <AIGenerateModal
          hackathonId={activeHackathon.id}
          mode={aiMode}
          open
          onOpenChange={(o) => {
            if (!o) setAiMode(null)
          }}
        />
      )}
    </div>
  )
}
