import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, Globe, FileText } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface AutoFillDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (data: {
    title: string
    tagline: string
    city?: string
    startAt: string
    endAt: string
    prizePool?: string
    docsUrl?: string
    organizer?: string
    source?: string
    tracks?: string[]
  }) => void
}

type ParsedField = {
  key: string
  label: string
  value: string
  confidence: number
}

export function AutoFillDialog({ open, onOpenChange, onApply }: AutoFillDialogProps) {
  const [inputType, setInputType] = useState<'url' | 'text'>('url')
  const [input, setInput] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [parsedFields, setParsedFields] = useState<ParsedField[] | null>(null)
  const [rawText, setRawText] = useState('')

  const handleParse = async () => {
    if (!input.trim()) {
      toast.error('请输入内容')
      return
    }
    setIsParsing(true)
    setParsedFields(null)
    try {
      const result = await api.autoFillHackathon({ input: input.trim(), inputType })
      if (!result.success || !result.data) {
        toast.error('解析失败')
        return
      }
      const { data } = result
      const fields: ParsedField[] = [
        { key: 'title', label: '赛事名称', value: data.title || '', confidence: data.confidence?.title ?? 0 },
        { key: 'tagline', label: '标语', value: data.tagline || '', confidence: data.confidence?.tagline ?? 0 },
        { key: 'city', label: '城市', value: data.city || '', confidence: data.confidence?.city ?? 0 },
        { key: 'startAt', label: '开始日期', value: data.startAt || '', confidence: data.confidence?.startAt ?? 0 },
        { key: 'endAt', label: '结束日期', value: data.endAt || '', confidence: data.confidence?.endAt ?? 0 },
        { key: 'prizePool', label: '奖金池', value: data.prizePool || '', confidence: data.confidence?.prizePool ?? 0 },
        { key: 'externalUrl', label: '外部链接', value: data.externalUrl || '', confidence: data.confidence?.externalUrl ?? 0 },
        { key: 'organizer', label: '主办方', value: data.organizer || '', confidence: data.confidence?.organizer ?? 0 },
        { key: 'source', label: '来源', value: data.source || '', confidence: data.confidence?.source ?? 0 },
        { key: 'tracks', label: '赛道', value: (data.tracks || []).join(', '), confidence: data.confidence?.tracks ?? 0 },
      ]
      setParsedFields(fields)
      setRawText(result.rawExtractedText || '')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '解析失败，请重试')
    } finally {
      setIsParsing(false)
    }
  }

  const handleApply = () => {
    if (!parsedFields) return
    const getValue = (key: string) => parsedFields.find((f) => f.key === key)?.value || ''
    onApply({
      title: getValue('title'),
      tagline: getValue('tagline'),
      city: getValue('city') || undefined,
      startAt: getValue('startAt'),
      endAt: getValue('endAt'),
      prizePool: getValue('prizePool') || undefined,
      docsUrl: getValue('externalUrl') || undefined,
      organizer: getValue('organizer') || undefined,
      source: getValue('source') || undefined,
      tracks: getValue('tracks')
        ? getValue('tracks').split(',').map((t) => t.trim()).filter(Boolean)
        : undefined,
    })
    setParsedFields(null)
    setInput('')
    onOpenChange(false)
    toast.success('已填充到表单')
  }

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.85) {
      return <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="h-3 w-3" /> 高</span>
    }
    if (confidence >= 0.6) {
      return <span className="inline-flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="h-3 w-3" /> 中</span>
    }
    return <span className="inline-flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="h-3 w-3" /> 低</span>
  }

  const getFieldBorderColor = (confidence: number) => {
    if (confidence >= 0.85) return 'border-green-300 focus-visible:ring-green-500'
    if (confidence >= 0.6) return 'border-amber-300 focus-visible:ring-amber-500'
    return 'border-red-300 focus-visible:ring-red-500'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI 自动填写
          </DialogTitle>
        </DialogHeader>

        {!parsedFields ? (
          <div className="space-y-4">
            <Tabs value={inputType} onValueChange={(v) => setInputType(v as 'url' | 'text')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url" className="gap-1">
                  <Globe className="h-4 w-4" /> URL
                </TabsTrigger>
                <TabsTrigger value="text" className="gap-1">
                  <FileText className="h-4 w-4" /> 文本
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {inputType === 'url' ? (
              <div className="space-y-2">
                <Label>黑客松页面链接</Label>
                <Input
                  placeholder="https://ethglobal.com/events/istanbul"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>黑客松介绍文本</Label>
                <Textarea
                  placeholder="粘贴黑客松的介绍文本..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={6}
                />
              </div>
            )}

            <Button
              className="w-full gap-2"
              onClick={handleParse}
              disabled={isParsing || !input.trim()}
            >
              {isParsing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  解析中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  开始解析
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              AI 已解析出以下字段，黄色/红色标注的字段请重点核对：
            </p>

            <div className="space-y-3">
              {parsedFields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">{field.label}</Label>
                    {getConfidenceBadge(field.confidence)}
                  </div>
                  <Input
                    value={field.value}
                    onChange={(e) => {
                      const next = parsedFields.map((f) =>
                        f.key === field.key ? { ...f, value: e.target.value } : f
                      )
                      setParsedFields(next)
                    }}
                    className={`text-sm ${getFieldBorderColor(field.confidence)}`}
                  />
                </div>
              ))}
            </div>

            {rawText && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">查看原始提取文本</summary>
                <div className="mt-2 max-h-32 overflow-y-auto rounded bg-muted p-2 whitespace-pre-wrap">
                  {rawText}
                </div>
              </details>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setParsedFields(null)}>
                重新解析
              </Button>
              <Button className="flex-1 gap-1" onClick={handleApply}>
                <CheckCircle2 className="h-4 w-4" />
                确认填充
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
