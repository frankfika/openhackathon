import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { getUserKeyForRole, getTokenKeyForRole } from '@/lib/auth'

export function SetupPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  // Admin fields
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')

  // Hackathon fields
  const [hackathonTitle, setHackathonTitle] = useState('')
  const [hackathonTagline, setHackathonTagline] = useState('')
  const [hackathonCity, setHackathonCity] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    api.getSetupStatus().then(({ needsSetup }) => {
      if (!needsSetup) {
        toast.info(t('initial_setup.already_initialized'))
        navigate('/admin/login', { replace: true })
      } else {
        setChecking(false)
      }
    }).catch(() => setChecking(false))
  }, [navigate, t])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    try {
      const result = await api.setup({
        admin: { email: adminEmail, name: adminName, password: adminPassword },
        hackathon: {
          title: hackathonTitle,
          tagline: hackathonTagline || undefined,
          city: hackathonCity || undefined,
          startAt: startDate || undefined,
          endAt: endDate || undefined,
        },
      })
      // Auto-login with the returned token
      const adminData = result.admin
      if (adminData.token) {
        localStorage.setItem(getTokenKeyForRole('admin'), adminData.token)
        const { token: _, ...userWithoutToken } = adminData
        localStorage.setItem(getUserKeyForRole('admin'), JSON.stringify(userWithoutToken))
      }
      toast.success(t('initial_setup.success'))
      // Full page reload so AuthProvider picks up the new token from localStorage
      setTimeout(() => { window.location.href = '/admin' }, 1000)
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
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Admin section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {t('initial_setup.admin_section')}
              </h3>
              <div className="space-y-2">
                <Label htmlFor="admin-name">{t('common.name')}</Label>
                <Input id="admin-name" required value={adminName} onChange={e => setAdminName(e.target.value)} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-email">{t('common.email')}</Label>
                <Input id="admin-email" type="email" required value={adminEmail} onChange={e => setAdminEmail(e.target.value)} disabled={isLoading} placeholder="admin@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">{t('common.password')}</Label>
                <Input id="admin-password" type="password" required minLength={8} value={adminPassword} onChange={e => setAdminPassword(e.target.value)} disabled={isLoading} />
                <p className="text-xs text-amber-600 dark:text-amber-400">{t('initial_setup.password_warning')}</p>
              </div>
            </div>

            {/* Hackathon section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {t('initial_setup.hackathon_section')}
              </h3>
              <div className="space-y-2">
                <Label htmlFor="hackathon-title">{t('initial_setup.hackathon_title')}</Label>
                <Input id="hackathon-title" required value={hackathonTitle} onChange={e => setHackathonTitle(e.target.value)} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hackathon-tagline">{t('initial_setup.hackathon_tagline')}</Label>
                <Input id="hackathon-tagline" value={hackathonTagline} onChange={e => setHackathonTagline(e.target.value)} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hackathon-city">{t('initial_setup.hackathon_city')}</Label>
                <Input id="hackathon-city" value={hackathonCity} onChange={e => setHackathonCity(e.target.value)} disabled={isLoading} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="start-date">{t('initial_setup.start_date')}</Label>
                  <Input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} disabled={isLoading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">{t('initial_setup.end_date')}</Label>
                  <Input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} disabled={isLoading} />
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
