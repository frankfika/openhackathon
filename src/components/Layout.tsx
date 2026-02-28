import React, { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Menu, X } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { useSiteBranding } from '@/lib/site-branding'
import { ThemeLanguageSwitcher } from './ThemeLanguageSwitcher'

export function Layout() {
  const location = useLocation()
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const { activeHackathon } = useActiveHackathon()
  const { settings } = useSiteBranding()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isAuthPage = ['/login', '/register'].includes(location.pathname)

  const navItems = useMemo(
    () => [
      { to: '/', label: t('nav.home'), exact: true },
      { to: '/docs', label: t('nav.docs') },
      { to: '/submit', label: t('nav.submit') },
      { to: '/leaderboard', label: t('nav.leaderboard') },
    ],
    [t]
  )

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  if (isAuthPage) {
    return <Outlet />
  }

  const dashboardPath = user?.role === 'admin' ? '/dashboard' : '/judge'

  const isNavActive = (to: string, exact?: boolean) => {
    return exact ? location.pathname === to : location.pathname.startsWith(to)
  }

  return (
    <div className="min-h-screen flex flex-col text-foreground premium-grid-bg">
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/70 shadow-[0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-4 md:gap-7">
            <Link to="/" className="text-lg font-semibold tracking-tight">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt={settings.siteName} className="h-8" />
              ) : (
                settings.siteName
              )}
            </Link>

            <nav className="hidden items-center gap-1 text-sm md:flex">
              {navItems.map((link) => {
                const active = isNavActive(link.to, link.exact)
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={cn(
                      'rounded-full px-3.5 py-1.5 transition-all font-medium',
                      active
                        ? 'bg-gradient-to-r from-primary via-sky-500 to-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                        : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                    )}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="hidden items-center gap-2 grand-chip lg:flex">
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="max-w-[220px] truncate">{activeHackathon.title}</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              {t(`landing.status.${activeHackathon.status}`)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeLanguageSwitcher />

            {user ? (
              <>
                <Link to={dashboardPath}>
                  <Button variant="default" size="sm" className="rounded-full px-4 grand-cta">
                    {t('nav.dashboard')}
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden rounded-full md:inline-flex"
                  onClick={logout}
                >
                  {t('nav.logout')}
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button variant="ghost" size="sm" className="rounded-full font-medium">
                  {t('nav.login')}
                </Button>
              </Link>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen((prev) => !prev)}
            >
              <span className="sr-only">{t('common.open_menu')}</span>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-border/60 bg-background/95 px-4 py-3 md:hidden">
            <div className="mb-3 flex items-center justify-between rounded-xl border border-border/70 bg-white/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
              <span className="truncate">{activeHackathon.title}</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {t(`landing.status.${activeHackathon.status}`)}
              </span>
            </div>

            <nav className="grid grid-cols-2 gap-2">
              {navItems.map((link) => {
                const active = isNavActive(link.to, link.exact)
                return (
                  <Link
                    key={`mobile-${link.to}`}
                    to={link.to}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-medium',
                      active
                        ? 'border-primary/40 bg-primary/10 text-foreground'
                        : 'border-border/70 bg-background text-muted-foreground'
                    )}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {user ? (
                <>
                  <Link to={dashboardPath}>
                    <Button className="w-full rounded-lg grand-cta" size="sm">
                      {t('nav.dashboard')}
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" className="w-full rounded-lg" onClick={logout}>
                    {t('nav.logout')}
                  </Button>
                </>
              ) : (
                <Link to="/login" className="col-span-2">
                  <Button variant="outline" className="w-full rounded-lg" size="sm">
                    {t('nav.login')}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex flex-1 flex-col">
        <div key={location.pathname} className="route-enter flex flex-1 flex-col">
          <Outlet />
        </div>
      </main>

      <FooterSection />
    </div>
  )
}

function FooterSection() {
  const { t } = useTranslation()
  const { settings } = useSiteBranding()

  return (
    <footer className="border-t border-border/50 bg-background/70 py-5 backdrop-blur">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3 text-sm font-medium">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={settings.siteName} className="h-7" />
            ) : (
              <>
                <div className="h-7 w-7 rounded-md bg-primary" />
                <span>{settings.siteName}</span>
              </>
            )}
          </div>

          <nav className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link to="/docs" className="hover:text-foreground transition-colors">
              {t('nav.docs')}
            </Link>
            <Link to="/submit" className="hover:text-foreground transition-colors">
              {t('nav.submit')}
            </Link>
            <Link to="/leaderboard" className="hover:text-foreground transition-colors">
              {t('nav.leaderboard')}
            </Link>
          </nav>

          {settings.showPoweredBy && (
            <a
              href={settings.poweredByUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground/80 hover:text-foreground transition-colors"
            >
              {settings.poweredByText}
            </a>
          )}
        </div>
      </div>
    </footer>
  )
}
