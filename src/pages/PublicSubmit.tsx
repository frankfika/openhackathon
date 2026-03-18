import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SubmissionField, formatDateRange } from '@/lib/types'
import { getSubmissionFields } from '@/lib/submission-fields'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { toast } from 'sonner'
import { CalendarDays, ClipboardList, Loader2, Mail, Sparkles, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export function PublicSubmit() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const { activeHackathon: hackathon } = useActiveHackathon()

  const asNonEmptyString = (value: unknown) => {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  const schema: SubmissionField[] = useMemo(() => {
    return getSubmissionFields(hackathon.submissionSchema)
  }, [hackathon.submissionSchema])

  const formSchema = useMemo(
    () =>
      z
        .object({
          submitterEmail: z.string().email(t('submission.validation.email_invalid')),
          submitterName: z.string().optional(),
          ...schema.reduce((acc, field) => {
            const requiredMessage = t('submission.validation.field_required', { field: field.label })
            let validator: z.ZodTypeAny

            if (field.type === 'url') {
              validator = field.required
                ? z
                    .string()
                    .trim()
                    .min(1, requiredMessage)
                    .refine((value) => z.string().url().safeParse(value).success, t('submission.validation.url_invalid'))
                : z
                    .string()
                    .optional()
                    .refine(
                      (value) => !value || z.string().url().safeParse(value).success,
                      t('submission.validation.url_invalid')
                    )
            } else if (field.type === 'select') {
              const options = field.options || []
              validator = field.required
                ? z
                    .string()
                    .trim()
                    .min(1, requiredMessage)
                    .refine((value) => options.length === 0 || options.includes(value), t('submission.validation.option_invalid'))
                : z
                    .string()
                    .optional()
                    .refine((value) => !value || options.length === 0 || options.includes(value), t('submission.validation.option_invalid'))
            } else {
              validator = field.required
                ? z.string().trim().min(1, requiredMessage)
                : z.string().optional()
            }

            acc[field.id] = validator
            return acc
          }, {} as Record<string, z.ZodTypeAny>),
        }),
    [schema, t]
  )

  type FormData = z.infer<typeof formSchema>

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  const customRequiredFieldCount = schema.filter((field) => field.required).length
  const requiredFieldCount = 1 + customRequiredFieldCount
  const hasCustomFields = schema.length > 0

  // Fields that map directly to Project model columns
  const PROJECT_COLUMN_FIELDS = ['title', 'oneLiner', 'description', 'repoUrl', 'demoUrl', 'tags']

  const onSubmit = async (data: Record<string, unknown>) => {
    setIsLoading(true)

    try {
      if (!hackathon.id) {
        toast.error(t('submission.error'))
        return
      }

      const { submitterEmail, submitterName, ...rest } = data
      const submitterEmailValue = asNonEmptyString(submitterEmail)
      const submitterNameValue = asNonEmptyString(submitterName)

      if (!submitterEmailValue) {
        toast.error(t('submission.validation.email_invalid'))
        return
      }

      // Build submissionData from custom fields (not standard Project columns)
      const submissionData: Record<string, unknown> = {}
      for (const field of schema) {
        if (!PROJECT_COLUMN_FIELDS.includes(field.id)) {
          submissionData[field.id] = rest[field.id]
        }
      }

      const titleValue =
        asNonEmptyString(rest.title) ||
        asNonEmptyString(rest.project_name) ||
        `${t('submission.submit_project')} ${submitterEmailValue}`
      const oneLinerValue = asNonEmptyString(rest.oneLiner) || ''
      const descriptionValue = asNonEmptyString(rest.description) || ''
      const repoUrlValue = asNonEmptyString(rest.repoUrl) || ''
      const demoUrlValue = asNonEmptyString(rest.demoUrl) || ''
      const tagsValue = asNonEmptyString(rest.tags)
        ? (rest.tags as string).split(',').map((item) => item.trim()).filter(Boolean)
        : []

      const payload = {
        hackathonId: hackathon.id,
        submitterEmail: submitterEmailValue,
        submitterName: submitterNameValue,
        title: titleValue,
        oneLiner: oneLinerValue,
        description: descriptionValue,
        repoUrl: repoUrlValue,
        demoUrl: demoUrlValue,
        tags: tagsValue,
        submissionData: Object.keys(submissionData).length > 0 ? submissionData : undefined,
      }

      // Use anonymous fetch here to keep submit flow independent from login state.
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json().catch(() => ({})) as {
        id?: string
        error?: string
        receipt?: {
          id?: string
          email?: string
          issuedAt?: string
          emailSent?: boolean
          emailFailureReason?: string
        }
      }

      if (!response.ok) {
        throw new Error(result.error || `Submit failed with status ${response.status}`)
      }

      toast.success(t('submission.success'))
      navigate('/submit/success', {
        state: {
          receiptId: result.receipt?.id || result.id,
          submitterEmail: result.receipt?.email || submitterEmailValue,
          issuedAt: result.receipt?.issuedAt,
          emailSent: result.receipt?.emailSent,
          emailFailureReason: result.receipt?.emailFailureReason,
        },
      })
    } catch (error) {
      console.error('Submit error:', error)
      toast.error(t('submission.error'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container max-w-6xl py-6 md:py-10">
      <div className="grid gap-5 lg:grid-cols-12">
        <aside className="lg:col-span-4">
          <div className="surface-panel-strong space-y-5 p-5 md:p-6 lg:sticky lg:top-24">
            <div className="grand-chip">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {t('submission.side_title')}
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {t('submission.submit_project')}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('submission.side_desc')}
              </p>
            </div>

            <div className="surface-inset space-y-3 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('submission.submit_desc')}
              </div>
              <div className="text-base font-semibold">{hackathon.title}</div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>
                  {formatDateRange(hackathon.startAt, hackathon.endAt)}
                </span>
              </div>
              <Badge variant="outline" className="w-fit">
                {t('submission.required_fields_hint', { count: requiredFieldCount })}
              </Badge>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 text-primary" />
                <span>{t('submission.step_contact')}</span>
              </div>
              <div className="flex items-start gap-3">
                <ClipboardList className="mt-0.5 h-4 w-4 text-primary" />
                <span>{t('submission.step_project')}</span>
              </div>
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                <span>{t('submission.step_review')}</span>
              </div>
            </div>
          </div>
        </aside>

        <section className="lg:col-span-8">
          <Card className="surface-panel-strong border-none shadow-none">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grand-chip">{t('submission.sections.contact_info')}</span>
                <span className="grand-chip">{t('submission.sections.project_details')}</span>
              </div>
              <CardTitle className="text-2xl md:text-3xl">{t('submission.submit_project')}</CardTitle>
              <CardDescription>
                {t('submission.submit_desc')}{' '}
                <span className="font-semibold text-foreground">{hackathon.title}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="surface-inset space-y-4 p-4 md:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">{t('submission.sections.contact_info')}</h3>
                    <Badge variant="outline">{t('submission.required_fields_hint', { count: requiredFieldCount })}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('submission.contact_help')}
                  </p>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="submitterEmail" className="inline-flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        {t('submission.contact_email_label')}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="submitterEmail"
                        type="email"
                        placeholder={t('submission.contact_email_placeholder')}
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
                      <Label htmlFor="submitterName" className="inline-flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {t('submission.contact_name_label')}
                        <span className="text-muted-foreground">({t('submission.optional')})</span>
                      </Label>
                      <Input
                        id="submitterName"
                        type="text"
                        placeholder={t('submission.contact_name_placeholder')}
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
                </div>

                <div className="surface-inset space-y-4 p-4 md:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">{t('submission.sections.project_details')}</h3>
                    <Badge variant="outline">
                      {t('submission.required_fields_hint', { count: customRequiredFieldCount })}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('submission.project_help')}
                  </p>

                  {!hasCustomFields ? (
                    <div className="surface-inset border-dashed p-5 text-center text-muted-foreground">
                      <p className="text-sm font-medium">{t('submission.no_schema')}</p>
                      <p className="mt-1 text-xs">
                        {t('submission.no_schema_desc')}
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {schema.map((field) => (
                        <div
                          key={field.id}
                          className={cn('space-y-2', field.type === 'textarea' ? 'md:col-span-2' : undefined)}
                        >
                          <Label htmlFor={field.id}>
                            {field.label}
                            {field.required ? (
                              <span className="ml-1 text-destructive">*</span>
                            ) : (
                              <span className="ml-1 text-muted-foreground">({t('submission.optional')})</span>
                            )}
                          </Label>

                          {field.type === 'textarea' ? (
                            <Textarea
                              id={field.id}
                              placeholder={field.placeholder}
                              className={errors[field.id] ? 'border-destructive' : ''}
                              {...register(field.id as keyof FormData)}
                            />
                          ) : field.type === 'select' ? (
                            <Controller
                              control={control}
                              name={field.id as keyof FormData}
                              render={({ field: controlledField }) => (
                                <div className="space-y-2">
                                  <Select
                                    value={typeof controlledField.value === 'string' ? controlledField.value : ''}
                                    onValueChange={controlledField.onChange}
                                  >
                                    <SelectTrigger className={errors[field.id] ? 'border-destructive' : ''}>
                                      <SelectValue placeholder={field.placeholder || t('submission.select_placeholder')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(field.options || []).map((option) => (
                                        <SelectItem key={option} value={option}>
                                          {option}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {!field.required && controlledField.value ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-0 text-xs"
                                      onClick={() => controlledField.onChange('')}
                                    >
                                      {t('submission.clear_choice')}
                                    </Button>
                                  ) : null}
                                </div>
                              )}
                            />
                          ) : (
                            <Input
                              id={field.id}
                              type={field.type === 'url' ? 'url' : 'text'}
                              placeholder={field.placeholder}
                              className={errors[field.id] ? 'border-destructive' : ''}
                              {...register(field.id as keyof FormData)}
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
                  )}
                </div>

                {errors.root && (
                  <p className="text-sm text-destructive text-center">{errors.root.message}</p>
                )}

                <div className="surface-inset flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <p className="text-xs text-muted-foreground">
                    {t('submission.submit_tip')}
                  </p>
                  <Button type="submit" className="w-full grand-cta md:w-auto md:min-w-[180px]" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('submission.submit_button')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
