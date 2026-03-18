import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth';
import { UserRole } from '@/lib/types';
import { useAdminRoutes } from '@/lib/admin-routing'

type LoginFormValues = {
  email: string
  password: string
}

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { adminBasePath } = useAdminRoutes()
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<UserRole>('admin');
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
  });

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    try {
      const authenticatedUser = await login(data.email, data.password);
      toast.success(t('auth.welcome'));
      const redirectPath = authenticatedUser.role === 'judge' ? '/judge' : adminBasePath;
      navigate(redirectPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('auth.sign_in_failed')
      toast.error(message)
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <Card className="surface-panel-strong w-full max-w-md border-0 shadow-none sm:rounded-3xl">
        <CardHeader className="space-y-1 text-center pb-6 pt-8">
          <Link to="/" className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </Link>
          <CardTitle className="text-2xl font-bold tracking-tight">{t('auth.welcome')}</CardTitle>
          <CardDescription>
            {t('auth.welcome_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pb-8 px-6">
          <Tabs defaultValue="admin" className="w-full mb-6" onValueChange={(v) => setActiveTab(v as UserRole)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="admin">{t('auth.admin')}</TabsTrigger>
              <TabsTrigger value="judge">{t('auth.judge')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-center text-xs text-muted-foreground">{t('auth.role_hint')}</p>

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
            <Button className="w-full h-10 shadow-sm grand-cta" type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('auth.sign_in')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
