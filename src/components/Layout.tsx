import React from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { siteConfig } from '@/lib/site-config'

import { ThemeLanguageSwitcher } from './ThemeLanguageSwitcher'

export function Layout() {
  const location = useLocation()
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const isAuthPage = ['/login', '/register'].includes(location.pathname)

  if (isAuthPage) {
    return <Outlet />
  }

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-foreground [background:radial-gradient(1200px_circle_at_20%_0%,rgba(0,113,227,0.14),transparent_35%),radial-gradient(900px_circle_at_80%_10%,rgba(217,70,239,0.10),transparent_45%),radial-gradient(700px_circle_at_50%_100%,rgba(16,185,129,0.10),transparent_40%)]">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-lg font-bold tracking-tight">
              {siteConfig.organizerLogo ? (
                <img src={siteConfig.organizerLogo} alt={siteConfig.organizerName} className="h-8" />
              ) : (
                siteConfig.organizerName
              )}
            </Link>
            <nav className="hidden items-center gap-1 text-sm md:flex">
              {[
                { to: '/', label: t('nav.home', 'Home'), exact: true },
                { to: '/docs', label: t('nav.docs', 'Docs') },
                { to: '/submit', label: t('nav.submit', 'Submit Project') },
                { to: '/leaderboard', label: t('nav.leaderboard', 'Leaderboard') },
              ].map((link) => {
                const active = link.exact
                  ? location.pathname === link.to
                  : location.pathname.startsWith(link.to)
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={cn(
                      'rounded-full px-3 py-1 transition-colors font-medium',
                      active
                        ? 'bg-foreground/5 text-foreground'
                        : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                    )}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <ThemeLanguageSwitcher />
            {user ? (
              <>
                <Link to={user.role === 'admin' ? '/dashboard' : '/judge'}>
                  <Button variant="default" size="sm" className="rounded-full">
                    {t('nav.dashboard')}
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" className="rounded-full" onClick={logout}>
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
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
      <FooterSection />
    </div>
  )
}

// ─── Footer ──────────────────────────────────────────────────────────
function FooterSection() {
  const { t } = useTranslation()
  const { activeHackathon: h } = useActiveHackathon()

  return (
    <footer className="border-t border-border/40 py-4">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-3">
            {siteConfig.organizerLogo ? (
              <img src={siteConfig.organizerLogo} alt={siteConfig.organizerName} className="h-8" />
            ) : (
              <>
                <div className="h-8 w-8 rounded-lg bg-primary" />
                <span className="text-sm font-bold">{siteConfig.organizerName}</span>
              </>
            )}
          </div>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/docs" className="hover:text-foreground transition-colors">
              {t('nav.docs', 'Docs')}
            </Link>
            {h.rulesUrl && (
              <a href={h.rulesUrl} target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">
                {t('landing.footer.rules')}
              </a>
            )}
          </nav>
          {siteConfig.poweredBy.show && (
            <a
              href={siteConfig.poweredBy.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              {siteConfig.poweredBy.text}
            </a>
          )}
        </div>
      </div>
    </footer>
  )
}
