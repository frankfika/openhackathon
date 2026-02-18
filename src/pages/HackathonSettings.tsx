import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SubmissionConfigBuilder } from '@/components/SubmissionConfigBuilder'
import { ScoringCriteriaBuilder } from '@/components/ScoringCriteriaBuilder'
import { SubmissionField, ScoringCriterion } from '@/lib/mock-data'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const hackathonSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  tagline: z.string().min(1, 'Tagline is required'),
  city: z.string().optional(),
  startAt: z.string(),
  endAt: z.string(),
  gitbookUrl: z.string().url().optional().or(z.literal('')),
})

type HackathonFormValues = z.infer<typeof hackathonSchema>

export function HackathonSettings() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // Fetch hackathon data
  const { data: hackathon, isLoading: isLoadingHackathon } = useQuery({
    queryKey: ['hackathon', id],
    queryFn: () => api.getHackathon(id!),
    enabled: !!id,
  })

  const [submissionSchema, setSubmissionSchema] = useState<SubmissionField[]>([])
  const [scoringCriteria, setScoringCriteria] = useState<ScoringCriterion[]>([])

  // Update local state when hackathon data loads
  useEffect(() => {
    if (hackathon) {
      setSubmissionSchema(hackathon.submissionSchema?.fields || [])
      setScoringCriteria(hackathon.scoringCriteria || [])
    }
  }, [hackathon])

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(hackathonSchema),
    defaultValues: {
      title: '',
      tagline: '',
      city: '',
      startAt: '',
      endAt: '',
      gitbookUrl: '',
    }
  })

  // Update form values when hackathon data loads
  useEffect(() => {
    if (hackathon) {
      reset({
        title: hackathon.title,
        tagline: hackathon.tagline,
        city: hackathon.city || '',
        startAt: hackathon.startAt ? new Date(hackathon.startAt).toISOString().split('T')[0] : '',
        endAt: hackathon.endAt ? new Date(hackathon.endAt).toISOString().split('T')[0] : '',
        gitbookUrl: hackathon.gitbookUrl || '',
      })
    }
  }, [hackathon, reset])

  // Update hackathon mutation
  const updateMutation = useMutation({
    mutationFn: (data: Partial<HackathonFormValues>) => {
      if (!id) throw new Error('No hackathon ID')
      return api.updateHackathon(id, {
        ...data,
        submissionSchema: { fields: submissionSchema },
        scoringCriteria,
      })
    },
    onSuccess: () => {
      toast.success(t('settings.saved', 'Settings saved successfully'))
      queryClient.invalidateQueries({ queryKey: ['hackathon', id] })
    },
    onError: () => {
      toast.error(t('settings.save_error', 'Failed to save settings'))
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
    } as any)
  }

  const onSaveScoringCriteria = async (criteria: ScoringCriterion[]) => {
    if (!id) return
    setScoringCriteria(criteria)
    updateMutation.mutate({
      scoringCriteria: criteria,
    } as any)
  }

  if (isLoadingHackathon) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!hackathon) {
    return <div>Hackathon not found</div>
  }

  return (
    <div className="container max-w-4xl py-10">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/hackathons')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('common.back', 'Back')}
        </Button>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{t('settings.hackathon_settings', 'Hackathon Settings')}</h1>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="general">{t('settings.general', 'General Info')}</TabsTrigger>
          <TabsTrigger value="submission">{t('settings.submission', 'Submission Form')}</TabsTrigger>
          <TabsTrigger value="scoring">{t('settings.scoring', 'Scoring Criteria')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.basic_info', 'Basic Information')}</CardTitle>
              <CardDescription>{t('settings.basic_info_desc', 'Manage the core details of your hackathon.')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">{t('hackathons.title', 'Title')}</Label>
                  <Input id="title" {...register('title')} />
                  {errors.title && <p className="text-sm text-destructive">{errors.title.message as string}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tagline">{t('hackathons.tagline', 'Tagline')}</Label>
                  <Input id="tagline" {...register('tagline')} />
                  {errors.tagline && <p className="text-sm text-destructive">{errors.tagline.message as string}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startAt">{t('hackathons.start_date', 'Start Date')}</Label>
                    <Input id="startAt" type="date" {...register('startAt')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endAt">{t('hackathons.end_date', 'End Date')}</Label>
                    <Input id="endAt" type="date" {...register('endAt')} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">{t('hackathons.city', 'City')}</Label>
                  <Input id="city" {...register('city')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gitbookUrl">{t('settings.gitbook_url', 'GitBook URL')}</Label>
                  <Input id="gitbookUrl" type="url" placeholder="https://docs.example.com" {...register('gitbookUrl')} />
                  <p className="text-xs text-muted-foreground">{t('settings.gitbook_url_desc', 'Embed a GitBook page on the landing page for event details.')}</p>
                  {errors.gitbookUrl && <p className="text-sm text-destructive">{errors.gitbookUrl.message as string}</p>}
                </div>

                <div className="pt-4">
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('common.save', 'Save Changes')}
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
          <ScoringCriteriaBuilder
            initialCriteria={scoringCriteria}
            onSave={(criteria) => {
              setScoringCriteria(criteria)
              onSaveScoringCriteria(criteria)
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
