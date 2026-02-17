import React from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
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
    <div className="min-h-screen bg-background font-sans text-foreground [background:radial-gradient(1200px_circle_at_20%_0%,rgba(0,113,227,0.14),transparent_35%),radial-gradient(900px_circle_at_80%_10%,rgba(217,70,239,0.10),transparent_45%),radial-gradient(700px_circle_at_50%_100%,rgba(16,185,129,0.10),transparent_40%)]">
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
                { to: '/projects', label: t('nav.projects', 'Projects') },
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
                <Link to="/dashboard">
                  <Button variant="default" size="sm" className="rounded-full">
                    Dashboard
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" className="rounded-full" onClick={logout}>
                  Log out
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button variant="ghost" size="sm" className="rounded-full font-medium">
                  Log in
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
