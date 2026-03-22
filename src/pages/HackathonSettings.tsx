import React, { useMemo, useState, useEffect } from 'react'
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
import { ArrowLeft, Loader2, Check, FileText, Trash2, Wand2, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { shouldSuggestSetupWizard } from '@/lib/setup-wizard'
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

type HackathonFormValues = {
  title: string
  tagline: string
  city?: string
  prizePool?: string
  startAt: string
  endAt: string
  docsUrl?: string
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
      z.object({
        title: z.string().min(1, t('submission.validation.field_required', { field: t('hackathons.title') })),
        tagline: z.string().min(1, t('submission.validation.field_required', { field: t('hackathons.tagline') })),
        city: z.string().optional(),
        prizePool: z.string().max(50).optional(),
        startAt: z.string(),
        endAt: z.string(),
        docsUrl: z.string().url(t('submission.validation.url_invalid')).optional().or(z.literal('')),
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
    watch,
  } = useForm({
    resolver: zodResolver(hackathonSchema),
    defaultValues: {
      title: '',
      tagline: '',
      city: '',
      prizePool: '',
      startAt: '',
      endAt: '',
      docsUrl: '',
    }
  })

  const watchedStartAt = watch('startAt')
  const watchedEndAt = watch('endAt')

  const shouldSuggestWizard = useMemo(() => {
    if (!hackathon) return false
    return shouldSuggestSetupWizard({
      submissionFieldCount: submissionSchema.length,
      scoringCriteriaCount: scoringCriteria.length,
    })
  }, [hackathon, submissionSchema.length, scoringCriteria.length])

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
    mutationFn: async (payload: { fileName?: string; content: string }) => {
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

  const onSubmit = async (data: HackathonFormValues) => {
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
    await updateMutation.mutateAsync(data)
    setSubmissionSchema(data.submissionSchema.fields || [])
    setScoringCriteria(data.scoringCriteria)
    setIsSetupWizardOpen(false)
  }

  const handleMarkdownUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const content = await file.text()
      await uploadMarkdownMutation.mutateAsync({
        fileName: file.name,
        content,
      })
    } finally {
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
        <Button type="button" variant="outline" className="gap-2" onClick={() => setIsSetupWizardOpen(true)}>
          <Wand2 className="h-4 w-4" />
          {t('settings.setup_wizard.open')}
        </Button>
      </div>

      {shouldSuggestWizard ? (
        <Card className="mb-6 border border-primary/20 bg-primary/5 shadow-none">
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold">{t('settings.setup_wizard.title', 'Setup Wizard')}</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('settings.setup_wizard.dashboard_hint', 'This hackathon is still missing core setup. Run the wizard to configure the event profile, docs links, submission schema, judging flow, and scoring rubric.')}
              </p>
            </div>
            <Button type="button" className="gap-2" onClick={() => setIsSetupWizardOpen(true)}>
              <Wand2 className="h-4 w-4" />
              {t('settings.setup_wizard.open')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

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
                <div className="space-y-2">
                  <Label htmlFor="title">{t('hackathons.title')}</Label>
                  <Input id="title" {...register('title')} />
                  {errors.title && <p className="text-sm text-destructive">{errors.title.message as string}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tagline">{t('hackathons.tagline')}</Label>
                  <Input id="tagline" {...register('tagline')} />
                  {errors.tagline && <p className="text-sm text-destructive">{errors.tagline.message as string}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startAt">{t('hackathons.start_date')}</Label>
                    <Input id="startAt" type="date" {...register('startAt')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endAt">{t('hackathons.end_date')}</Label>
                    <Input id="endAt" type="date" {...register('endAt')} />
                  </div>
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

                    <div className="space-y-2">
                      <Label htmlFor="docsUrl">{t('settings.docs_url')}</Label>
                      <Input id="docsUrl" type="url" placeholder="https://docs.example.com" {...register('docsUrl')} />
                      <p className="text-xs text-muted-foreground">{t('settings.docs_url_desc')}</p>
                      {errors.docsUrl && <p className="text-sm text-destructive">{errors.docsUrl.message as string}</p>}
                    </div>

                    <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <Label htmlFor="markdownDoc">{t('settings.markdown_doc')}</Label>
                          </div>
                          <p className="text-xs text-muted-foreground">{t('settings.markdown_doc_desc')}</p>
                        </div>
                        <Badge variant={markdownDoc ? 'secondary' : 'outline'}>
                          {markdownDoc?.fileName || t('settings.markdown_empty')}
                        </Badge>
                      </div>

                      <Input
                        id="markdownDoc"
                        type="file"
                        accept=".md,.markdown"
                        onChange={handleMarkdownUpload}
                        disabled={uploadMarkdownMutation.isPending || deleteMarkdownMutation.isPending}
                      />

                      {markdownDoc ? (
                        <div className="space-y-3">
                          <p className="text-xs text-muted-foreground">
                            {t('settings.markdown_updated_at', { updatedAt: new Date(markdownDoc.updatedAt).toLocaleString() })}
                          </p>
                          <Textarea
                            readOnly
                            value={markdownDoc.content}
                            className="min-h-[220px] resize-y bg-background/80 font-mono text-xs"
                          />
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              className="gap-2 text-destructive hover:text-destructive"
                              onClick={() => deleteMarkdownMutation.mutate()}
                              disabled={uploadMarkdownMutation.isPending || deleteMarkdownMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                              {t('settings.markdown_delete')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{t('settings.markdown_empty_desc')}</p>
                      )}
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

                <div className="pt-4">
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('common.save_changes')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="submission">
          <SubmissionConfigBuilder
            initialSchema={submissionSchema}
            onSave={(schema) => {
              setSubmissionSchema(schema)
              onSaveSubmissionSchema(schema)
            }}
          />
        </TabsContent>

        <TabsContent value="scoring">
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
            </div>
          </div>
          <ScoringCriteriaBuilder
            initialCriteria={scoringCriteria}
            onSave={(criteria) => {
              setScoringCriteria(criteria)
              onSaveScoringCriteria(criteria)
            }}
          />
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
