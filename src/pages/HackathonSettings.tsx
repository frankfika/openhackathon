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
import { Badge } from '@/components/ui/badge'
import { SubmissionConfigBuilder } from '@/components/SubmissionConfigBuilder'
import { ScoringCriteriaBuilder } from '@/components/ScoringCriteriaBuilder'
import { SubmissionField, ScoringCriterion } from '@/lib/types'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Check, Bell, Puzzle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

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

const hackathonSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  tagline: z.string().min(1, 'Tagline is required'),
  city: z.string().optional(),
  prizePool: z.string().max(50).optional(),
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
  const [coverGradient, setCoverGradient] = useState('')

  // Update local state when hackathon data loads — no defaults, use backend data as-is
  useEffect(() => {
    if (hackathon) {
      const fields = Array.isArray(hackathon.submissionSchema)
        ? hackathon.submissionSchema
        : hackathon.submissionSchema?.fields || []
      setSubmissionSchema(fields)
      setScoringCriteria(hackathon.scoringCriteria || [])
      setCoverGradient(hackathon.coverGradient || '')
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
      prizePool: '',
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
        prizePool: hackathon.prizePool || '',
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
        coverGradient,
        submissionSchema: { fields: submissionSchema },
        scoringCriteria,
      })
    },
    onSuccess: () => {
      toast.success(t('settings.saved', 'Settings saved successfully'))
      queryClient.invalidateQueries({ queryKey: ['hackathon', id] })
      queryClient.invalidateQueries({ queryKey: ['hackathons'] })
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
    return <div>{t('settings.hackathon_not_found', 'Hackathon not found')}</div>
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
        <TabsList className="flex flex-wrap w-full mb-8 h-auto gap-1 p-1">
          <TabsTrigger value="general" className="flex-1 min-w-[100px]">{t('settings.general', 'General Info')}</TabsTrigger>
          <TabsTrigger value="submission" className="flex-1 min-w-[100px]">{t('settings.submission', 'Submission Form')}</TabsTrigger>
          <TabsTrigger value="scoring" className="flex-1 min-w-[100px]">{t('settings.scoring', 'Scoring Criteria')}</TabsTrigger>
          <TabsTrigger value="notifications" className="flex-1 min-w-[100px] gap-1">
            <Bell className="h-3.5 w-3.5" />
            {t('settings.notifications', 'Notifications')}
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex-1 min-w-[100px] gap-1">
            <Puzzle className="h-3.5 w-3.5" />
            {t('settings.integrations', 'Integrations')}
          </TabsTrigger>
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
                  <Label htmlFor="prizePool">{t('hackathons.prize_pool', 'Prize Pool')}</Label>
                  <Input id="prizePool" placeholder={t('hackathons.prize_pool_placeholder', 'e.g. $50,000+')} {...register('prizePool')} />
                  <p className="text-xs text-muted-foreground">{t('hackathons.prize_pool_desc', 'Enter the total prize amount or rewards description. Leave empty to hide.')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gitbookUrl">{t('settings.gitbook_url', 'GitBook URL')}</Label>
                  <Input id="gitbookUrl" type="url" placeholder="https://docs.example.com" {...register('gitbookUrl')} />
                  <p className="text-xs text-muted-foreground">{t('settings.gitbook_url_desc', 'Embed a GitBook page on the landing page for event details.')}</p>
                  {errors.gitbookUrl && <p className="text-sm text-destructive">{errors.gitbookUrl.message as string}</p>}
                </div>

                <div className="space-y-3">
                  <Label>{t('settings.cover_gradient', 'Cover Gradient')}</Label>
                  <p className="text-xs text-muted-foreground">{t('settings.cover_gradient_desc', 'Choose a gradient theme for your hackathon cover.')}</p>
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

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {t('settings.notifications', 'Notifications')}
                <Badge variant="secondary" className="text-xs">{t('common.coming_soon', 'Coming Soon')}</Badge>
              </CardTitle>
              <CardDescription>{t('settings.notifications_desc', 'Configure email and in-app notifications for your hackathon.')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
                <Bell className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">{t('settings.notifications_coming_soon', 'Email notifications coming soon')}</p>
                <p className="text-sm mt-1">{t('settings.notifications_coming_soon_desc', 'Notify judges of new assignments, remind participants of deadlines, and send automated updates.')}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Puzzle className="h-5 w-5" />
                {t('settings.integrations', 'Integrations')}
                <Badge variant="secondary" className="text-xs">{t('common.coming_soon', 'Coming Soon')}</Badge>
              </CardTitle>
              <CardDescription>{t('settings.integrations_desc', 'Connect third-party tools to enhance your hackathon.')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
                <Puzzle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">{t('settings.integrations_coming_soon', 'GitHub, Slack integrations coming soon')}</p>
                <p className="text-sm mt-1">{t('settings.integrations_coming_soon_desc', 'Auto-import projects from GitHub repos, send notifications to Slack channels, and more.')}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
