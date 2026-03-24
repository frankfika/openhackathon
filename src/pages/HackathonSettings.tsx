import { useMemo, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SetupWizardDialog } from '@/components/SetupWizardDialog'
import { SubmissionField, ScoringCriterion, SubmissionSchemaConfig } from '@/lib/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Play, AlertTriangle, Wand2, Lock } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { buildAdminPath, useAdminRoutes } from '@/lib/admin-routing'
import { GeneralTab, HackathonFormValues } from './hackathon-settings/GeneralTab'
import { SubmissionTab } from './hackathon-settings/SubmissionTab'
import { ScoringTab } from './hackathon-settings/ScoringTab'

function isValidHttpOrRootRelativeUrl(value: string): boolean {
  if (value.startsWith('/') && !value.startsWith('//')) return true
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
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
          <GeneralTab
            register={register}
            errors={errors}
            setValue={setValue}
            watch={watch}
            handleSubmit={handleSubmit}
            onSubmit={onSubmit}
            isLocked={isLocked}
            updateMutationIsPending={updateMutation.isPending}
            coverGradient={coverGradient}
            setCoverGradient={setCoverGradient}
            markdownDoc={markdownDoc}
            uploadMarkdownMutation={uploadMarkdownMutation}
            deleteMarkdownMutation={deleteMarkdownMutation}
          />
        </TabsContent>

        <TabsContent value="submission">
          <SubmissionTab
            isLocked={isLocked}
            submissionSchema={submissionSchema}
            onSaveSubmissionSchema={(schema) => {
              setSubmissionSchema(schema)
              onSaveSubmissionSchema(schema)
            }}
          />
        </TabsContent>

        <TabsContent value="scoring">
          <ScoringTab
            isLocked={isLocked}
            scoringCriteria={scoringCriteria}
            judgesPerProject={judgesPerProject}
            setJudgesPerProject={setJudgesPerProject}
            onSaveScoringCriteria={(criteria) => {
              setScoringCriteria(criteria)
              onSaveScoringCriteria(criteria)
            }}
            onSaveJudgesPerProject={async () => {
              await updateMutation.mutateAsync({ judgesPerProject })
            }}
            updateMutationIsPending={updateMutation.isPending}
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
