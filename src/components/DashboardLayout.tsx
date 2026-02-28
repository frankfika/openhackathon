import React, { useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  FileText,
  FolderGit2,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Trophy,
  User,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import { ThemeLanguageSwitcher } from '@/components/ThemeLanguageSwitcher'
import { useAuth } from '@/lib/auth'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { useSiteBranding } from '@/lib/site-branding'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export function DashboardLayout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const { activeHackathon } = useActiveHackathon()
  const { settings } = useSiteBranding()

  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isAdmin = user?.role === 'admin'
  const roleLabel = isAdmin ? t('auth.admin') : t('auth.judge')

  const handleSignOut = () => {
    logout()
    toast.success(t('auth.logout_success'))
    navigate('/login')
  }

  const navigation = useMemo(() => {
    const allNav = [
      { name: t('nav.dashboard'), href: '/dashboard', icon: LayoutDashboard, adminOnly: false },
      {
        name: t('nav.hackathons'),
        href: activeHackathon.id ? `/dashboard/hackathons/${activeHackathon.id}/settings` : '/dashboard/hackathons',
        icon: Trophy,
        adminOnly: true,
      },
      { name: t('nav.projects'), href: '/dashboard/projects', icon: FolderGit2, adminOnly: false },
      { name: t('nav.assignments'), href: '/dashboard/assignments', icon: Users, adminOnly: true },
      { name: t('nav.promotions'), href: '/dashboard/promotions', icon: GitBranch, adminOnly: true },
      { name: t('nav.reports'), href: '/dashboard/reports', icon: FileText, adminOnly: true },
      { name: t('nav.leaderboard'), href: '/dashboard/leaderboard', icon: BarChart3, adminOnly: false },
      { name: t('settings.title'), href: '/dashboard/settings', icon: Settings, adminOnly: true },
    ]

    return allNav.filter((item) => (item.adminOnly ? isAdmin : true))
  }, [activeHackathon.id, isAdmin, t])

  return (
    <div className="flex h-screen overflow-hidden bg-transparent premium-grid-bg">
      {sidebarOpen && (
        <button
          aria-label={t('common.close')}
          className="fixed inset-0 z-40 bg-slate-900/45 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 transform border-r border-border/60 bg-background/75 backdrop-blur-xl transition-transform duration-300 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border/50 px-4">
          <Link to="/" className="flex items-center gap-3">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={settings.siteName} className="h-8" />
            ) : (
              <>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                  {settings.siteName.charAt(0)}
                </div>
                <span className="font-semibold tracking-tight">{settings.siteName}</span>
              </>
            )}
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-3">
          <div className="surface-panel rounded-2xl p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('nav.hackathons')}</p>
            <p className="mt-1 truncate text-sm font-semibold">{activeHackathon.title}</p>
            <p className="mt-2 inline-flex rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              {t(`landing.status.${activeHackathon.status}`)}
            </p>
          </div>
        </div>

        <nav className="space-y-1 px-3 py-1">
          {navigation.map((item) => {
            const active = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                  active
                    ? 'bg-gradient-to-r from-primary via-sky-500 to-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                    : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto border-t border-border/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
              </div>
            </div>
            <ThemeLanguageSwitcher />
          </div>
          <Button variant="outline" className="w-full justify-center rounded-full" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {t('nav.logout')}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-16 items-center justify-between border-b border-border/50 bg-background/70 px-4 backdrop-blur-xl md:px-6 lg:justify-end">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>

          <div className="hidden items-center gap-3 md:flex">
            <div className="text-right">
              <div className="text-sm font-medium">{user?.name}</div>
              <div className="text-xs text-muted-foreground">{roleLabel}</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground/5">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-7">
          <div className="mx-auto max-w-6xl space-y-5 md:space-y-8">
            <div key={location.pathname} className="route-enter">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
