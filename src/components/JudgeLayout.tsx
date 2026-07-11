import React, { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ClipboardList, LogOut, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { useSiteBranding } from '@/lib/site-branding'
import { ThemeLanguageSwitcher } from '@/components/ThemeLanguageSwitcher'
export function JudgeLayout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const { activeHackathon } = useActiveHackathon()
  const { settings } = useSiteBranding()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/judge/login')
  }

  const links = [{ to: '/judge', label: t('nav.my_tasks'), icon: ClipboardList }]

  return (
    <div className="min-h-screen text-foreground premium-grid-bg">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/70 shadow-[0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-6">
            <Link to="/judge" className="text-lg font-semibold tracking-tight">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt={settings.siteName} className="h-8" />
              ) : (
                settings.siteName
              )}
            </Link>

            <nav className="hidden items-center gap-2 md:flex">
              {links.map((item) => {
                const active = location.pathname === item.to
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all',
                      active
                        ? 'bg-gradient-to-r from-primary via-sky-500 to-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                        : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <span className="grand-chip">
              {activeHackathon.title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeLanguageSwitcher />
            <div className="hidden text-right md:block">
              <div className="text-sm font-medium">{user?.name}</div>
              <div className="text-xs text-muted-foreground">{t('auth.judge')}</div>
            </div>
            <Button type="button" variant="outline" className="hidden rounded-full md:inline-flex" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              {t('nav.logout')}
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label={t('common.open_menu')}>
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-border/60 bg-background/95 px-4 py-3 md:hidden">
            <div className="mb-3 rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur dark:bg-slate-900/80">
              {activeHackathon.title}
            </div>
            <div className="grid gap-2">
              {links.map((item) => (
                <Link
                  key={`mobile-${item.to}`}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg border border-border/70 px-3 py-2 text-sm font-medium"
                >
                  {item.label}
                </Link>
              ))}
              <Button type="button" variant="outline" className="justify-center" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                {t('nav.logout')}
              </Button>
            </div>
          </div>
        )}
      </header>

      <main className="container py-6 md:py-8">
        <div key={location.pathname} className="route-enter">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
