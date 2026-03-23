import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { getUserKeyForRole, getTokenKeyForRole } from '@/lib/auth'
import { useAdminRoutes } from '@/lib/admin-routing'

type SetupFormValues = {
  adminName: string
  adminEmail: string
  adminPassword: string
  hackathonTitle: string
  hackathonTagline: string
  hackathonCity: string
  startDate: string
  endDate: string
}

export function SetupPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { adminBasePath, adminLoginPath } = useAdminRoutes()
  const [isLoading, setIsLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  const setupSchema = useMemo(
    () =>
      z
        .object({
          adminName: z.string().trim().min(1, t('submission.validation.field_required', { field: t('common.name') })),
          adminEmail: z
            .string()
            .trim()
            .min(1, t('submission.validation.field_required', { field: t('common.email') }))
            .email(t('auth.invalid_email')),
          adminPassword: z
            .string()
            .min(8, t('initial_setup.password_length_invalid'))
            .max(72, t('initial_setup.password_length_invalid')),
          hackathonTitle: z
            .string()
            .trim()
            .min(1, t('submission.validation.field_required', { field: t('initial_setup.hackathon_title') })),
          hackathonTagline: z
            .string()
            .trim()
            .min(1, t('submission.validation.field_required', { field: t('initial_setup.hackathon_tagline') })),
          hackathonCity: z
            .string()
            .trim()
            .min(1, t('submission.validation.field_required', { field: t('initial_setup.hackathon_city') })),
          startDate: z
            .string()
            .min(1, t('submission.validation.field_required', { field: t('initial_setup.start_date') })),
          endDate: z
            .string()
            .min(1, t('submission.validation.field_required', { field: t('initial_setup.end_date') })),
        })
        .superRefine((values, ctx) => {
          if (values.startDate && values.endDate && values.startDate > values.endDate) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t('submission.validation.date_order_invalid'),
              path: ['endDate'],
            })
          }
        }),
    [t]
  )

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetupFormValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      adminName: '',
      adminEmail: '',
      adminPassword: '',
      hackathonTitle: '',
      hackathonTagline: '',
      hackathonCity: '',
      startDate: '',
      endDate: '',
    },
  })

  useEffect(() => {
    api.getSetupStatus().then(({ needsSetup }) => {
      if (!needsSetup) {
        toast.info(t('initial_setup.already_initialized'))
        navigate(adminLoginPath, { replace: true })
      } else {
        setChecking(false)
      }
    }).catch(() => setChecking(false))
  }, [adminLoginPath, navigate, t])

  async function onSubmit(values: SetupFormValues) {
    setIsLoading(true)
    try {
      const result = await api.setup({
        admin: {
          email: values.adminEmail.trim(),
          name: values.adminName.trim(),
          password: values.adminPassword,
        },
        hackathon: {
          title: values.hackathonTitle.trim(),
          tagline: values.hackathonTagline.trim(),
          city: values.hackathonCity.trim(),
          startAt: values.startDate,
          endAt: values.endDate,
        },
      })
      // Auto-login with the returned token
      const adminData = result.admin
      if (adminData.token) {
        localStorage.setItem(getTokenKeyForRole('admin'), adminData.token)
        const userWithoutToken = { ...adminData }
        delete userWithoutToken.token
        localStorage.setItem(getUserKeyForRole('admin'), JSON.stringify(userWithoutToken))
      }
      toast.success(t('initial_setup.success'))
      // Full page reload so AuthProvider picks up the new token from localStorage
      setTimeout(() => { window.location.href = adminBasePath }, 1000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Setup failed'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <CardTitle className="text-2xl">{t('initial_setup.title')}</CardTitle>
          <CardDescription>{t('initial_setup.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <p className="text-xs text-muted-foreground">{t('common.required_fields_hint')}</p>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {t('initial_setup.admin_section')}
              </h3>
              <div className="space-y-2">
                <Label htmlFor="admin-name">
                  {t('common.name')}
                  <span className="ml-1 text-destructive">*</span>
                </Label>
                <Input id="admin-name" disabled={isLoading} {...register('adminName')} />
                {errors.adminName && <p className="text-sm text-destructive">{errors.adminName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-email">
                  {t('common.email')}
                  <span className="ml-1 text-destructive">*</span>
                </Label>
                <Input id="admin-email" type="email" disabled={isLoading} placeholder="admin@example.com" {...register('adminEmail')} />
                {errors.adminEmail && <p className="text-sm text-destructive">{errors.adminEmail.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">
                  {t('common.password')}
                  <span className="ml-1 text-destructive">*</span>
                </Label>
                <Input id="admin-password" type="password" disabled={isLoading} {...register('adminPassword')} />
                <p className="text-xs text-amber-600 dark:text-amber-400">{t('initial_setup.password_warning')}</p>
                {errors.adminPassword && <p className="text-sm text-destructive">{errors.adminPassword.message}</p>}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {t('initial_setup.hackathon_section')}
              </h3>
              <div className="space-y-2">
                <Label htmlFor="hackathon-title">
                  {t('initial_setup.hackathon_title')}
                  <span className="ml-1 text-destructive">*</span>
                </Label>
                <Input id="hackathon-title" disabled={isLoading} {...register('hackathonTitle')} />
                {errors.hackathonTitle && <p className="text-sm text-destructive">{errors.hackathonTitle.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="hackathon-tagline">
                  {t('initial_setup.hackathon_tagline')}
                  <span className="ml-1 text-destructive">*</span>
                </Label>
                <Input id="hackathon-tagline" disabled={isLoading} {...register('hackathonTagline')} />
                {errors.hackathonTagline && <p className="text-sm text-destructive">{errors.hackathonTagline.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="hackathon-city">
                  {t('initial_setup.hackathon_city')}
                  <span className="ml-1 text-destructive">*</span>
                </Label>
                <Input id="hackathon-city" disabled={isLoading} {...register('hackathonCity')} />
                {errors.hackathonCity && <p className="text-sm text-destructive">{errors.hackathonCity.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="start-date">
                    {t('initial_setup.start_date')}
                    <span className="ml-1 text-destructive">*</span>
                  </Label>
                  <Input id="start-date" type="date" disabled={isLoading} {...register('startDate')} />
                  {errors.startDate && <p className="text-sm text-destructive">{errors.startDate.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">
                    {t('initial_setup.end_date')}
                    <span className="ml-1 text-destructive">*</span>
                  </Label>
                  <Input id="end-date" type="date" disabled={isLoading} {...register('endDate')} />
                  {errors.endDate && <p className="text-sm text-destructive">{errors.endDate.message}</p>}
                </div>
              </div>
            </div>

            <Button className="w-full h-11 grand-cta" type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? t('initial_setup.setting_up') : t('initial_setup.complete_setup')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
