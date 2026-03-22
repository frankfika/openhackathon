import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, Scale } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth'

type LoginFormValues = {
  email: string
  password: string
}

export function JudgeLogin() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const loginSchema = useMemo(
    () =>
      z.object({
        email: z.string().email(t('auth.invalid_email')),
        password: z.string().min(1, t('auth.password_required')),
      }),
    [t]
  )

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true)
    try {
      const authenticatedUser = await login(data.email, data.password)
      if (authenticatedUser.role !== 'judge') {
        toast.error(t('auth.judge_login_wrong_role'))
        return
      }
      toast.success(t('auth.welcome'))
      navigate('/judge')
    } catch (error) {
      const message = error instanceof Error ? error.message : t('auth.sign_in_failed')
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <Card className="surface-panel-strong w-full max-w-md border-0 shadow-none sm:rounded-3xl">
        <CardHeader className="space-y-1 text-center pb-6 pt-8">
          <div className="mx-auto mb-4 flex flex-col items-center gap-2">
            <Link to="/" className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm hover:bg-amber-600 transition-colors">
              <Scale className="h-5 w-5" />
            </Link>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <Scale className="h-3 w-3" />
              {t('auth.judge')}
            </span>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">{t('auth.judge_login_title')}</CardTitle>
          <CardDescription>
            {t('auth.judge_login_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pb-8 px-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                disabled={isLoading}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                type="password"
                disabled={isLoading}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>
            <Button className="w-full h-10 shadow-sm bg-amber-500 hover:bg-amber-600 text-white" type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('auth.sign_in')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
