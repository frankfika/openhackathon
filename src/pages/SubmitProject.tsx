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
import { projects, SubmissionField } from '@/lib/mock-data'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { toast } from 'sonner'
import { Loader2, ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// Default schema if none is configured
const defaultSubmissionSchema: SubmissionField[] = [
  { id: 'title', label: 'Project Name', type: 'text', required: true, placeholder: 'My Awesome Project' },
  { id: 'oneLiner', label: 'One Liner', type: 'text', required: true, placeholder: 'A short catchy description' },
  { id: 'description', label: 'Detailed Description', type: 'textarea', required: true, placeholder: 'Tell us more about your project...' },
  { id: 'repoUrl', label: 'Repository URL', type: 'url', required: true, placeholder: 'https://github.com/...' },
  { id: 'demoUrl', label: 'Demo URL', type: 'url', required: false, placeholder: 'https://...' },
]

export function SubmitProject() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const { activeHackathon: hackathon } = useActiveHackathon()

  const schema = hackathon.submissionSchema || defaultSubmissionSchema

  // Dynamic Zod schema generation
  const formSchema = z.object(
    schema.reduce((acc, field) => {
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
  ).refine((data) => {
    // Check if project name already exists in this hackathon
    // We assume the field with id 'title' or 'project_name' is the title
    const titleField = schema.find(f => f.id === 'title' || f.id === 'project_name')?.id
    const rawTitle = titleField ? (data as Record<string, unknown>)[titleField] : undefined
    if (typeof rawTitle === 'string' && rawTitle.trim().length > 0) {
      const normalizedTitle = rawTitle.toLowerCase()
      const exists = projects.some(
        (p) => p.hackathonId === hackathon.id && p.title.toLowerCase() === normalizedTitle
      )
      return !exists
    }
    return true
  }, {
    message: "Project name already exists in this hackathon",
    path: ["title"], // This might need adjustment if the field id is different
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
  })

  const onSubmit = async (data: Record<string, unknown>) => {
    setIsLoading(true)
    
    // Simulate API call
    setTimeout(() => {
      console.log('Submitted data:', data)
      toast.success(t('submission.success', 'Project submitted successfully!'))
      navigate('/dashboard/projects')
      setIsLoading(false)
    }, 1000)
  }

  return (
    <div className="container max-w-2xl py-6 md:py-10">
      <div className="mb-4 md:mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/projects')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('common.back', 'Back')}
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{t('submission.submit_project', 'Submit Project')}</CardTitle>
          <CardDescription>
            {t('submission.submit_desc', 'Submit your project for')} <span className="font-semibold text-foreground">{hackathon.title}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                    {...register(field.id)}
                  />
                ) : (
                  <Input
                    id={field.id}
                    type={field.type === 'url' ? 'url' : 'text'}
                    placeholder={field.placeholder}
                    className={errors[field.id] ? 'border-destructive' : ''}
                    {...register(field.id)}
                  />
                )}
                
                {errors[field.id] && (
                  <p className="text-sm text-destructive">
                    {errors[field.id]?.message as string}
                  </p>
                )}
              </div>
            ))}
            
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
