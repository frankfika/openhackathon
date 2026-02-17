import React, { useState } from 'react'
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
import { hackathons, SubmissionField, ScoringCriterion } from '@/lib/mock-data'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
  const [isLoading, setIsLoading] = useState(false)

  // Mock data fetching
  const hackathon = hackathons.find(h => h.id === id) || hackathons[0]
  const [submissionSchema, setSubmissionSchema] = useState<SubmissionField[]>(hackathon.submissionSchema || [])
  const [scoringCriteria, setScoringCriteria] = useState<ScoringCriterion[]>(hackathon.scoringCriteria || [])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(hackathonSchema),
    defaultValues: {
      title: hackathon.title,
      tagline: hackathon.tagline,
      city: hackathon.city,
      startAt: hackathon.startAt,
      endAt: hackathon.endAt,
      gitbookUrl: hackathon.gitbookUrl || '',
    }
  })

  const onSubmit = async (data: HackathonFormValues) => {
    setIsLoading(true)
    // Simulate API call
    setTimeout(() => {
      console.log('Updating hackathon:', { ...data, submissionSchema })
      toast.success(t('settings.saved', 'Settings saved successfully'))
      setIsLoading(false)
    }, 1000)
  }

  const onSaveSubmissionSchema = async (schema: SubmissionField[]) => {
    setIsLoading(true)
    setTimeout(() => {
      console.log('Updating submission schema:', { hackathonId: hackathon.id, submissionSchema: schema })
      setSubmissionSchema(schema)
      toast.success(t('settings.saved', 'Settings saved successfully'))
      setIsLoading(false)
    }, 1000)
  }

  const onSaveScoringCriteria = async (criteria: ScoringCriterion[]) => {
    setIsLoading(true)
    setTimeout(() => {
      console.log('Updating scoring criteria:', { hackathonId: hackathon.id, scoringCriteria: criteria })
      setScoringCriteria(criteria)
      toast.success(t('settings.saved', 'Scoring criteria saved successfully'))
      setIsLoading(false)
    }, 1000)
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
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
