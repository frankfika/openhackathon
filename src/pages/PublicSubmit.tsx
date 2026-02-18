import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { SubmissionField } from '@/lib/mock-data'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

// Default schema if none is configured
const defaultSubmissionSchema: SubmissionField[] = [
  { id: 'title', label: 'Project Name', type: 'text', required: true, placeholder: 'My Awesome Project' },
  { id: 'oneLiner', label: 'One Liner', type: 'text', required: true, placeholder: 'A short catchy description' },
  { id: 'description', label: 'Detailed Description', type: 'textarea', required: true, placeholder: 'Tell us more about your project...' },
  { id: 'repoUrl', label: 'Repository URL', type: 'url', required: true, placeholder: 'https://github.com/...' },
  { id: 'demoUrl', label: 'Demo URL', type: 'url', required: false, placeholder: 'https://...' },
]

export function PublicSubmit() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const { activeHackathon: hackathon } = useActiveHackathon()

  // Fetch existing projects to check for duplicates
  const { data: existingProjects = [] } = useQuery({
    queryKey: ['projects', hackathon?.id],
    queryFn: () => api.getProjects({ hackathonId: hackathon?.id }),
    enabled: !!hackathon?.id,
  })

  const schema = hackathon.submissionSchema?.fields || defaultSubmissionSchema

  // Dynamic Zod schema generation - includes email fields
  const formSchema = z.object({
    submitterEmail: z.string().email('Please enter a valid email address'),
    submitterName: z.string().min(1, 'Name is required'),
    ...schema.reduce((acc, field) => {
      let validator: z.ZodTypeAny

      if (field.type === 'url') {
        if (field.required) {
          validator = z.string().min(1, `${field.label} is required`).url('Must be a valid URL')
        } else {
          validator = z
            .string()
            .optional()
            .refine((val) => !val || z.string().url().safeParse(val).success, 'Must be a valid URL')
        }
      } else {
        validator = field.required ? z.string().min(1, `${field.label} is required`) : z.string().optional()
      }

      acc[field.id] = validator
      return acc
    }, {} as Record<string, z.ZodTypeAny>)
  }).refine((data) => {
    // Check if project name already exists in this hackathon
    const titleField = schema.find(f => f.id === 'title' || f.id === 'project_name')?.id
    const rawTitle = titleField ? (data as Record<string, unknown>)[titleField] : undefined
    if (typeof rawTitle === 'string' && rawTitle.trim().length > 0) {
      const normalizedTitle = rawTitle.toLowerCase()
      const exists = existingProjects.some(
        (p) => p.title?.toLowerCase() === normalizedTitle
      )
      return !exists
    }
    return true
  }, {
    message: "Project name already exists in this hackathon",
    path: ["title"],
  })

  type FormData = z.infer<typeof formSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  const onSubmit = async (data: Record<string, unknown>) => {
    setIsLoading(true)

    try {
      // Extract standard fields
      const { submitterEmail, submitterName, ...rest } = data

      // Build submissionData from dynamic fields
      const submissionData: Record<string, unknown> = {}
      const standardFields = ['title', 'oneLiner', 'description', 'repoUrl', 'demoUrl', 'tags']

      for (const field of schema) {
        if (!standardFields.includes(field.id)) {
          submissionData[field.id] = rest[field.id]
        }
      }

      // Find active session
      const activeSession = hackathon.sessions?.find(s => s.status === 'active') || hackathon.sessions?.[0]

      await api.createProject({
        hackathonId: hackathon.id,
        sessionId: activeSession?.id,
        submitterEmail: submitterEmail as string,
        submitterName: submitterName as string,
        title: (rest.title as string) || '',
        oneLiner: (rest.oneLiner as string) || '',
        description: (rest.description as string) || '',
        repoUrl: (rest.repoUrl as string) || '',
        demoUrl: (rest.demoUrl as string) || '',
        tags: rest.tags ? (rest.tags as string).split(',').map(t => t.trim()) : [],
        submissionData,
      })

      toast.success(t('submission.success', 'Project submitted successfully!'))
      navigate('/submit/success')
    } catch (error) {
      console.error('Submit error:', error)
      toast.error(t('submission.error', 'Failed to submit project. Please try again.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container max-w-2xl py-6 md:py-10">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{t('submission.submit_project', 'Submit Project')}</CardTitle>
          <CardDescription>
            {t('submission.submit_desc', 'Submit your project for')} <span className="font-semibold text-foreground">{hackathon.title}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Contact Information Section */}
            <div className="space-y-4 pb-4 border-b">
              <h3 className="text-sm font-semibold text-foreground">Contact Information</h3>

              <div className="space-y-2">
                <Label htmlFor="submitterEmail">
                  Email Address
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Input
                  id="submitterEmail"
                  type="email"
                  placeholder="your@email.com"
                  className={errors.submitterEmail ? 'border-destructive' : ''}
                  {...register('submitterEmail')}
                />
                {errors.submitterEmail && (
                  <p className="text-sm text-destructive">
                    {errors.submitterEmail?.message as string}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="submitterName">
                  Your Name
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Input
                  id="submitterName"
                  type="text"
                  placeholder="John Doe"
                  className={errors.submitterName ? 'border-destructive' : ''}
                  {...register('submitterName')}
                />
                {errors.submitterName && (
                  <p className="text-sm text-destructive">
                    {errors.submitterName?.message as string}
                  </p>
                )}
              </div>
            </div>

            {/* Dynamic Project Fields */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Project Details</h3>

              {schema.map((field) => (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={field.id}>
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>

                  {field.type === 'textarea' ? (
                    <Textarea
                      id={field.id}
                      placeholder={field.placeholder}
                      className={errors[field.id] ? 'border-destructive' : ''}
                      {...register(field.id as any)}
                    />
                  ) : (
                    <Input
                      id={field.id}
                      type={field.type === 'url' ? 'url' : 'text'}
                      placeholder={field.placeholder}
                      className={errors[field.id] ? 'border-destructive' : ''}
                      {...register(field.id as any)}
                    />
                  )}

                  {errors[field.id] && (
                    <p className="text-sm text-destructive">
                      {errors[field.id]?.message as string}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {errors.root && (
               <p className="text-sm text-destructive text-center">
                 {errors.root.message}
               </p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('submission.submit_button', 'Submit Project')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
