import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { SubmissionConfigBuilder } from '@/components/SubmissionConfigBuilder'
import { ScoringCriteriaBuilder } from '@/components/ScoringCriteriaBuilder'
import { SetupWizardDialog } from '@/components/SetupWizardDialog'
import { SubmissionField, ScoringCriterion, SubmissionSchemaConfig } from '@/lib/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Check, FileText, BookOpenText, Trash2, Wand2, ChevronDown, Lock, Play, AlertTriangle, Upload } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { buildAdminPath, useAdminRoutes } from '@/lib/admin-routing'

const GRADIENT_PRESETS = [
  { name: 'Violet Fusion', value: 'from-violet-600/20 via-fuchsia-500/10 to-indigo-600/20' },
  { name: 'Ocean Breeze', value: 'from-blue-500/20 via-sky-500/10 to-indigo-500/20' },
  { name: 'Emerald Teal', value: 'from-emerald-500/20 via-teal-500/10 to-cyan-500/20' },
  { name: 'Sunset Glow', value: 'from-orange-500/20 via-amber-500/10 to-yellow-500/20' },
  { name: 'Rose Garden', value: 'from-rose-500/20 via-pink-500/10 to-red-500/20' },
  { name: 'Forest Green', value: 'from-green-500/20 via-lime-500/10 to-emerald-600/20' },
  { name: 'Slate Storm', value: 'from-slate-600/20 via-gray-500/10 to-zinc-600/20' },
  { name: 'Purple Haze', value: 'from-purple-600/20 via-violet-500/10 to-fuchsia-500/20' },
  { name: 'Coral Reef', value: 'from-red-400/20 via-orange-400/10 to-pink-500/20' },
  { name: 'Midnight Blue', value: 'from-blue-800/20 via-indigo-700/10 to-slate-800/20' },
]

function isValidHttpOrRootRelativeUrl(value: string): boolean {
  if (value.startsWith('/') && !value.startsWith('//')) return true
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

type HackathonFormValues = {
  title: string
  tagline: string
  city?: string
  prizePool?: string
  startAt: string
  endAt: string
  docsUrl?: string
  submissionSuccessHintText?: string
  submissionSuccessHintImageUrl?: string
}

type HackathonUpdateValues = Partial<HackathonFormValues> & {
  coverGradient?: string
  submissionSchema?: SubmissionSchemaConfig
  scoringCriteria?: ScoringCriterion[]
  judgesPerProject?: number
}

export function HackathonSettings() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { adminBasePath } = useAdminRoutes()
  const queryClient = useQueryClient()
  const hackathonSchema = useMemo(
    () =>
      z
        .object({
          title: z.string().trim().min(1, t('submission.validation.field_required', { field: t('hackathons.title') })),
          tagline: z.string().trim().min(1, t('submission.validation.field_required', { field: t('hackathons.tagline') })),
          city: z.string().optional(),
          prizePool: z.string().max(50).optional(),
          startAt: z.string().min(1, t('submission.validation.field_required', { field: t('hackathons.start_date') })),
          endAt: z.string().min(1, t('submission.validation.field_required', { field: t('hackathons.end_date') })),
          docsUrl: z.string().url(t('submission.validation.url_invalid')).optional().or(z.literal('')),
          submissionSuccessHintText: z.string().max(2000).optional(),
          submissionSuccessHintImageUrl: z
            .string()
            .optional()
            .or(z.literal(''))
            .refine((value) => !value || isValidHttpOrRootRelativeUrl(value), {
              message: t('submission.validation.url_invalid'),
            }),
        })
        .superRefine((values, ctx) => {
          if (values.startAt && values.endAt && values.startAt > values.endAt) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t('submission.validation.date_order_invalid'),
              path: ['endAt'],
            })
          }
        }),
    [t]
  )

  // Fetch hackathon data
  const { data: hackathon, isLoading: isLoadingHackathon } = useQuery({
    queryKey: ['hackathon', id],
    queryFn: () => api.getHackathon(id!),
    enabled: !!id,
  })

  const { data: markdownDoc } = useQuery({
    queryKey: ['hackathon-markdown-doc', id],
    queryFn: async () => {
      if (!id) return null
      try {
        return await api.getHackathonMarkdownDoc(id)
      } catch {
        return null
      }
    },
    enabled: !!id,
  })

  const [submissionSchema, setSubmissionSchema] = useState<SubmissionField[]>([])
  const [scoringCriteria, setScoringCriteria] = useState<ScoringCriterion[]>([])
  const [judgesPerProject, setJudgesPerProject] = useState(2)
  const [coverGradient, setCoverGradient] = useState('')
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Update local state when hackathon data loads — no defaults, use backend data as-is
  useEffect(() => {
    if (hackathon) {
      const fields = Array.isArray(hackathon.submissionSchema)
        ? hackathon.submissionSchema
        : hackathon.submissionSchema?.fields || []
      setSubmissionSchema(fields)
      setScoringCriteria(hackathon.scoringCriteria || [])
      setJudgesPerProject(hackathon.judgesPerProject ?? 2)
      setCoverGradient(hackathon.coverGradient || '')
    }
  }, [hackathon])

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<HackathonFormValues>({
    resolver: zodResolver(hackathonSchema),
    defaultValues: {
      title: '',
      tagline: '',
      city: '',
      prizePool: '',
      startAt: '',
      endAt: '',
      docsUrl: '',
      submissionSuccessHintText: '',
      submissionSuccessHintImageUrl: '',
    }
  })

  const watchedStartAt = watch('startAt')
  const watchedEndAt = watch('endAt')
  const watchedSubmissionSuccessHintImageUrl = watch('submissionSuccessHintImageUrl')

  // Update form values when hackathon data loads
  useEffect(() => {
    if (hackathon) {
      reset({
        title: hackathon.title,
        tagline: hackathon.tagline,
        city: hackathon.city || '',
        prizePool: hackathon.prizePool || '',
        startAt: hackathon.startAt ? new Date(hackathon.startAt).toISOString().split('T')[0] : '',
        endAt: hackathon.endAt ? new Date(hackathon.endAt).toISOString().split('T')[0] : '',
        docsUrl: hackathon.docsUrl || '',
        submissionSuccessHintText: hackathon.submissionSuccessHintText || '',
        submissionSuccessHintImageUrl: hackathon.submissionSuccessHintImageUrl || '',
      })
    }
  }, [hackathon, reset])

  // Update hackathon mutation
  const updateMutation = useMutation({
    mutationFn: (data: HackathonUpdateValues) => {
      if (!id) throw new Error('No hackathon ID')

      const nextSubmissionSchema = 'submissionSchema' in data
        ? data.submissionSchema
        : { fields: submissionSchema }
      const nextScoringCriteria = 'scoringCriteria' in data
        ? data.scoringCriteria
        : scoringCriteria
      const nextCoverGradient = 'coverGradient' in data
        ? data.coverGradient
        : coverGradient

      return api.updateHackathon(id, {
        ...data,
        coverGradient: nextCoverGradient,
        submissionSchema: nextSubmissionSchema,
        scoringCriteria: nextScoringCriteria,
      })
    },
    onSuccess: () => {
      toast.success(t('settings.saved'))
      queryClient.invalidateQueries({ queryKey: ['hackathon', id] })
      queryClient.invalidateQueries({ queryKey: ['hackathons'] })
      queryClient.invalidateQueries({ queryKey: ['current-hackathon'] })
    },
    onError: () => {
      toast.error(t('settings.save_error'))
    },
  })

  const uploadMarkdownMutation = useMutation({
    mutationFn: async (payload: { fileName?: string; content: string; isBase64?: boolean }) => {
      if (!id) throw new Error('No hackathon ID')
      return api.saveHackathonMarkdownDoc(id, payload)
    },
    onSuccess: () => {
      toast.success(t('settings.markdown_uploaded'))
      queryClient.invalidateQueries({ queryKey: ['hackathon-markdown-doc', id] })
    },
    onError: () => {
      toast.error(t('settings.markdown_upload_failed'))
    },
  })

  const deleteMarkdownMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No hackathon ID')
      return api.deleteHackathonMarkdownDoc(id)
    },
    onSuccess: () => {
      toast.success(t('settings.markdown_deleted'))
      queryClient.invalidateQueries({ queryKey: ['hackathon-markdown-doc', id] })
    },
    onError: () => {
      toast.error(t('settings.markdown_delete_failed'))
    },
  })

  const LOCKED_STATUSES = new Set(['active', 'judging', 'completed'])
  const isLocked = hackathon ? LOCKED_STATUSES.has(hackathon.status) : false

  const startHackathonMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No hackathon ID')
      return api.updateHackathon(id, { status: 'active' } as unknown as HackathonUpdateValues)
    },
    onSuccess: () => {
      toast.success(t('settings.started_success'))
      queryClient.invalidateQueries({ queryKey: ['hackathon', id] })
      queryClient.invalidateQueries({ queryKey: ['hackathons'] })
      queryClient.invalidateQueries({ queryKey: ['current-hackathon'] })
    },
    onError: () => {
      toast.error(t('settings.save_error'))
    },
  })

  const onSubmit = async (data: HackathonFormValues) => {
    if (isLocked) return
    updateMutation.mutate(data)
  }

  const onSaveSubmissionSchema = async (schema: SubmissionField[]) => {
    if (!id) return
    setSubmissionSchema(schema)
    updateMutation.mutate({
      submissionSchema: { fields: schema },
    })
  }

  const onSaveScoringCriteria = async (criteria: ScoringCriterion[]) => {
    if (!id) return
    setScoringCriteria(criteria)
    updateMutation.mutate({
      scoringCriteria: criteria,
    })
  }

  const onApplySetupWizard = async (data: {
    title: string
    tagline: string
    city?: string
    prizePool?: string
    startAt?: string
    endAt?: string
    docsUrl?: string
    submissionSchema: SubmissionSchemaConfig
    scoringCriteria: ScoringCriterion[]
  }) => {
    const normalized = {
      title: data.title.trim(),
      tagline: data.tagline.trim(),
      city: data.city?.trim() || '',
      prizePool: data.prizePool?.trim() || '',
      startAt: data.startAt || '',
      endAt: data.endAt || '',
      docsUrl: data.docsUrl?.trim() || '',
    }

    const validation = hackathonSchema.safeParse(normalized)
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message || t('settings.save_error'))
      return
    }

    await updateMutation.mutateAsync({
      ...data,
      title: validation.data.title,
      tagline: validation.data.tagline,
      city: validation.data.city || undefined,
      prizePool: validation.data.prizePool || undefined,
      startAt: validation.data.startAt,
      endAt: validation.data.endAt,
      docsUrl: validation.data.docsUrl || undefined,
    })
    setSubmissionSchema(data.submissionSchema.fields || [])
    setScoringCriteria(data.scoringCriteria)
    setIsSetupWizardOpen(false)
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const successHintImageInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploadingSuccessHintImage, setIsUploadingSuccessHintImage] = useState(false)

  const processMarkdownFile = useCallback(async (file: File) => {
    // Check if file is markdown or PDF
    const isMarkdown = file.name.match(/\.(md|markdown)$/i)
    const isPDF = file.name.match(/\.pdf$/i)

    if (!isMarkdown && !isPDF) {
      toast.error(t('settings.invalid_file_type', 'Only Markdown (.md/.markdown) or PDF (.pdf) files are supported'))
      return
    }

    try {
      if (isPDF) {
        // For PDF files, read as data URL and extract base64 payload
        const base64Content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : ''
            const commaIndex = result.indexOf(',')
            if (commaIndex < 0) {
              reject(new Error('Invalid PDF payload'))
              return
            }
            resolve(result.slice(commaIndex + 1))
          }
          reader.onerror = () => reject(reader.error || new Error('Failed to read PDF file'))
          reader.readAsDataURL(file)
        })
        await uploadMarkdownMutation.mutateAsync({ fileName: file.name, content: base64Content, isBase64: true })
      } else {
        // For markdown files, read as text
        const content = await file.text()
        await uploadMarkdownMutation.mutateAsync({ fileName: file.name, content })
      }
    } catch { /* mutation handles toast */ }
  }, [uploadMarkdownMutation, t])

  const handleMarkdownUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await processMarkdownFile(file)
    event.target.value = ''
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processMarkdownFile(file)
  }, [processMarkdownFile])

  const handleSuccessHintImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploadingSuccessHintImage(true)
    try {
      const uploaded = await api.uploadImage(file)
      setValue('submissionSuccessHintImageUrl', uploaded.url, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      })
      toast.success(t('settings.image_uploaded', 'Image uploaded'))
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : t('settings.image_upload_failed', 'Failed to upload image')
      toast.error(message || t('settings.image_upload_failed', 'Failed to upload image'))
    } finally {
      setIsUploadingSuccessHintImage(false)
      event.target.value = ''
    }
  }

  if (isLoadingHackathon) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!hackathon) {
    return <div>{t('settings.hackathon_not_found')}</div>
  }

  return (
    <div className="container max-w-4xl py-10">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(buildAdminPath(adminBasePath, `hackathons/${id}`))} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{t('settings.hackathon_settings')}</h1>
        <div className="flex items-center gap-2">
          {hackathon.status === 'draft' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="default" className="gap-2">
                  <Play className="h-4 w-4" />
                  {t('settings.start_hackathon')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    {t('settings.start_hackathon')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('settings.start_confirm')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => startHackathonMutation.mutate()}
                    disabled={startHackathonMutation.isPending}
                  >
                    {startHackathonMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('settings.start_hackathon')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {!isLocked && (
            <Button type="button" variant="outline" className="gap-2" onClick={() => setIsSetupWizardOpen(true)}>
              <Wand2 className="h-4 w-4" />
              {t('settings.setup_wizard.open')}
            </Button>
          )}
        </div>
      </div>

      {/* Status banner */}
      {hackathon.status !== 'draft' && (
        <div className={cn(
          'mb-6 flex items-center gap-3 rounded-xl border px-4 py-3',
          hackathon.status === 'active' && 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200',
          hackathon.status === 'judging' && 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200',
          hackathon.status === 'completed' && 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200',
        )}>
          <Lock className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">
            {t(`settings.status_banner.${hackathon.status}`)}
          </span>
        </div>
      )}

      <Tabs defaultValue="general">
        <TabsList className="flex flex-wrap w-full mb-8 h-auto gap-1 p-1">
          <TabsTrigger value="general" className="flex-1 min-w-[100px]">{t('settings.general')}</TabsTrigger>
          <TabsTrigger value="submission" className="flex-1 min-w-[100px]">{t('settings.submission')}</TabsTrigger>
          <TabsTrigger value="scoring" className="flex-1 min-w-[100px]">{t('settings.scoring')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.basic_info')}</CardTitle>
              <CardDescription>{t('settings.basic_info_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <fieldset disabled={isLocked} className="space-y-4">
                <p className="text-xs text-muted-foreground">{t('common.required_fields_hint')}</p>
                <div className="space-y-2">
                  <Label htmlFor="title">
                    {t('hackathons.title')}
                    <span className="ml-1 text-destructive">*</span>
                  </Label>
                  <Input id="title" {...register('title')} />
                  {errors.title && <p className="text-sm text-destructive">{errors.title.message as string}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tagline">
                    {t('hackathons.tagline')}
                    <span className="ml-1 text-destructive">*</span>
                  </Label>
                  <Input id="tagline" {...register('tagline')} />
                  {errors.tagline && <p className="text-sm text-destructive">{errors.tagline.message as string}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startAt">
                      {t('hackathons.start_date')}
                      <span className="ml-1 text-destructive">*</span>
                    </Label>
                    <Input id="startAt" type="date" {...register('startAt')} />
                    {errors.startAt && <p className="text-sm text-destructive">{errors.startAt.message as string}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endAt">
                      {t('hackathons.end_date')}
                      <span className="ml-1 text-destructive">*</span>
                    </Label>
                    <Input id="endAt" type="date" {...register('endAt')} />
                    {errors.endAt && <p className="text-sm text-destructive">{errors.endAt.message as string}</p>}
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/60 p-4">
                  <div className="flex items-center gap-2">
                    <BookOpenText className="h-4 w-4 text-primary" />
                    <Label>{t('settings.docs_section', '赛事详情内容')}</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('settings.docs_section_desc', '以下两种方式选其一。本地文档优先展示，外链作为备用。')}</p>

                  <div className="space-y-2">
                    <Label htmlFor="docsUrl" className="text-xs text-muted-foreground">{t('settings.docs_url', '外链（GitBook / Notion 等）')}</Label>
                    <Input id="docsUrl" type="url" placeholder="https://docs.example.com" {...register('docsUrl')} />
                    {errors.docsUrl && <p className="text-sm text-destructive">{errors.docsUrl.message as string}</p>}
                  </div>

                  <div className="relative flex items-center gap-3 py-1">
                    <div className="flex-1 border-t border-border/60" />
                    <span className="text-xs text-muted-foreground">{t('common.or', '或')}</span>
                    <div className="flex-1 border-t border-border/60" />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground">{t('settings.markdown_doc', '本地文档（MD / PDF）')}</Label>

                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".md,.markdown,.pdf"
                      className="hidden"
                      onChange={handleMarkdownUpload}
                      disabled={uploadMarkdownMutation.isPending || deleteMarkdownMutation.isPending}
                    />

                    {markdownDoc ? (
                      <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{markdownDoc.fileName}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {t('settings.markdown_updated_at', { updatedAt: new Date(markdownDoc.updatedAt).toLocaleString() })}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadMarkdownMutation.isPending || deleteMarkdownMutation.isPending}
                            >
                              {uploadMarkdownMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deleteMarkdownMutation.mutate()}
                              disabled={uploadMarkdownMutation.isPending || deleteMarkdownMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {markdownDoc.contentType === 'application/pdf' || markdownDoc.fileName.toLowerCase().endsWith('.pdf') ? (
                          <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
                            <iframe
                              src={`data:application/pdf;base64,${markdownDoc.content}`}
                              title={markdownDoc.fileName}
                              className="h-[420px] w-full border-0"
                            />
                          </div>
                        ) : (
                          <Textarea
                            readOnly
                            value={markdownDoc.content}
                            className="min-h-[200px] resize-y bg-background/80 font-mono text-xs"
                          />
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        disabled={uploadMarkdownMutation.isPending}
                        className={cn(
                          'flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 transition-colors',
                          isDragging
                            ? 'border-primary bg-primary/5'
                            : 'border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-muted/40',
                          uploadMarkdownMutation.isPending && 'pointer-events-none opacity-50'
                        )}
                      >
                        {uploadMarkdownMutation.isPending ? (
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        ) : (
                          <Upload className="h-8 w-8 text-muted-foreground/60" />
                        )}
                        <div className="text-center">
                          <p className="text-sm font-medium">{t('settings.markdown_upload_hint', 'Click to upload or drag & drop')}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{t('settings.markdown_upload_accept', 'Markdown (.md/.markdown) or PDF (.pdf) files')}</p>
                        </div>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="submissionSuccessHintText">{t('settings.success_hint_text', 'Submission Success Tip Text')}</Label>
                  <Textarea
                    id="submissionSuccessHintText"
                    rows={3}
                    placeholder={t(
                      'settings.success_hint_text_placeholder',
                      'Example: Join the event community and follow updates. You can scan the QR code below.'
                    )}
                    {...register('submissionSuccessHintText')}
                  />
                  {errors.submissionSuccessHintText && (
                    <p className="text-sm text-destructive">{errors.submissionSuccessHintText.message as string}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{t('settings.success_hint_image_url', 'Submission Success Image / QR')}</Label>
                  <input
                    ref={successHintImageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,.ico"
                    className="hidden"
                    onChange={handleSuccessHintImageUpload}
                    disabled={isLocked || isUploadingSuccessHintImage}
                  />
                  <input type="hidden" {...register('submissionSuccessHintImageUrl')} />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => successHintImageInputRef.current?.click()}
                      disabled={isLocked || isUploadingSuccessHintImage}
                    >
                      {isUploadingSuccessHintImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      {t('settings.upload_image', 'Upload')}
                    </Button>
                    {watchedSubmissionSuccessHintImageUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setValue('submissionSuccessHintImageUrl', '', { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
                        disabled={isLocked || isUploadingSuccessHintImage}
                      >
                        {t('settings.remove_image', 'Remove Image')}
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      'settings.success_hint_image_desc',
                      'Upload PNG/JPG/SVG images. Recommended for event QR code or support channel poster.'
                    )}
                  </p>
                  {watchedSubmissionSuccessHintImageUrl ? (
                    <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2">
                      <p className="break-all text-xs text-muted-foreground">{watchedSubmissionSuccessHintImageUrl}</p>
                      <img
                        src={watchedSubmissionSuccessHintImageUrl}
                        alt={t('submission.success_hint_image_alt', 'Submission success hint image')}
                        className="max-h-28 w-auto object-contain"
                      />
                    </div>
                  ) : null}
                  {errors.submissionSuccessHintImageUrl && (
                    <p className="text-sm text-destructive">{errors.submissionSuccessHintImageUrl.message as string}</p>
                  )}
                </div>


                <Button
                  type="button"
                  variant="ghost"
                  className="gap-2 text-muted-foreground"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <ChevronDown className={cn('h-4 w-4 transition-transform', showAdvanced && 'rotate-180')} />
                  {t('settings.more_options', 'More Options')}
                </Button>

                {showAdvanced && (
                  <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">{t('hackathons.city')}</Label>
                        <Input id="city" {...register('city')} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="prizePool">{t('hackathons.prize_pool')}</Label>
                        <Input id="prizePool" placeholder={t('hackathons.prize_pool_placeholder')} {...register('prizePool')} />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>{t('settings.cover_gradient')}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.cover_gradient_desc')}</p>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        {GRADIENT_PRESETS.map((preset) => (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => setCoverGradient(preset.value)}
                            className={`relative h-16 rounded-lg bg-gradient-to-r ${preset.value} border-2 transition-all hover:scale-105 ${
                              coverGradient === preset.value
                                ? 'border-primary ring-2 ring-primary/30'
                                : 'border-transparent hover:border-muted-foreground/30'
                            }`}
                            title={preset.name}
                          >
                            {coverGradient === preset.value && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Check className="h-5 w-5 text-primary" />
                              </div>
                            )}
                            <span className="absolute bottom-0.5 left-0 right-0 text-center text-[10px] text-muted-foreground truncate px-1">
                              {preset.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {!isLocked && (
                  <div className="pt-4">
                    <Button type="submit" disabled={updateMutation.isPending}>
                      {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t('common.save_changes')}
                    </Button>
                  </div>
                )}
                </fieldset>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="submission">
          {isLocked ? (
            <div className="pointer-events-none opacity-60">
              <SubmissionConfigBuilder
                initialSchema={submissionSchema}
                onSave={() => {}}
              />
            </div>
          ) : (
            <SubmissionConfigBuilder
              initialSchema={submissionSchema}
              onSave={(schema) => {
                setSubmissionSchema(schema)
                onSaveSubmissionSchema(schema)
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="scoring">
          <fieldset disabled={isLocked}>
          <div className="mb-6 space-y-3">
            <div>
              <h3 className="text-lg font-medium">{t('settings.judges_per_project')}</h3>
              <p className="text-sm text-muted-foreground mt-1">{t('settings.judges_per_project_desc')}</p>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={20}
                className="w-24"
                value={judgesPerProject}
                onChange={(e) => {
                  const v = Number.parseInt(e.target.value, 10)
                  if (v > 0) setJudgesPerProject(v)
                }}
              />
              {!isLocked && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await updateMutation.mutateAsync({ judgesPerProject })
                  }}
                  disabled={updateMutation.isPending}
                >
                  {t('common.save_changes')}
                </Button>
              )}
            </div>
          </div>
          </fieldset>
          {isLocked ? (
            <div className="pointer-events-none opacity-60">
              <ScoringCriteriaBuilder
                initialCriteria={scoringCriteria}
                onSave={() => {}}
              />
            </div>
          ) : (
            <ScoringCriteriaBuilder
              initialCriteria={scoringCriteria}
              onSave={(criteria) => {
                setScoringCriteria(criteria)
                onSaveScoringCriteria(criteria)
              }}
            />
          )}
        </TabsContent>

      </Tabs>

      <SetupWizardDialog
        open={isSetupWizardOpen}
        onOpenChange={setIsSetupWizardOpen}
        title={watch('title') || hackathon.title}
        tagline={watch('tagline') || hackathon.tagline}
        city={watch('city') || hackathon.city || ''}
        prizePool={watch('prizePool') || hackathon.prizePool || ''}
        startAt={watchedStartAt || hackathon.startAt}
        endAt={watchedEndAt || hackathon.endAt}
        docsUrl={watch('docsUrl') || hackathon.docsUrl || ''}
        existingSubmissionFields={submissionSchema}
        isApplying={updateMutation.isPending}
        onApply={onApplySetupWizard}
      />
    </div>
  )
}
