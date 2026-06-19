import React, { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Menu, X } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { useSiteBranding } from '@/lib/site-branding'
import { ThemeLanguageSwitcher } from './ThemeLanguageSwitcher'

export function Layout() {
  const location = useLocation()
  const { t } = useTranslation()
  const { activeHackathon } = useActiveHackathon()
  const { settings } = useSiteBranding()
  const [mobileOpen, setMobileOpen] = useState(false)

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

  const isNavActive = (to: string, exact?: boolean) => {
    return exact ? location.pathname === to : location.pathname.startsWith(to)
  }

  return (
    <div className="min-h-screen flex flex-col text-foreground premium-grid-bg">
      <header className="fixed left-0 top-0 z-50 w-full bg-transparent px-4 py-3 md:px-8">
        <div className="mx-auto flex h-12 max-w-[1200px] items-center justify-between gap-4 rounded-full border border-[#171717]/10 bg-white/64 px-3 shadow-[0_18px_46px_rgba(24,27,32,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-2xl md:px-4">
          <div className="flex items-center gap-4 md:gap-7">
            <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-[-0.04em] text-[#171717] transition-opacity hover:opacity-75">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt={settings.siteName} className="h-8" />
              ) : (
                <>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#171717] text-xs font-semibold text-white">
                    {settings.siteName.slice(0, 1)}
                  </span>
                  <span>{settings.siteName}</span>
                </>
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
                      'group relative rounded-full px-3.5 py-1.5 font-medium transition-all',
                      active
                        ? 'bg-[#171717] text-white shadow-lg shadow-stone-900/10'
                        : 'text-[#171717]/72 hover:bg-[#171717]/5 hover:text-[#171717]'
                    )}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-[#171717]/10 bg-white/58 px-3 py-1 text-xs font-semibold text-[#747474] backdrop-blur lg:flex">
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="max-w-[220px] truncate">{activeHackathon.title}</span>
            <span className="rounded-full bg-[#171717] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              {t(`landing.status.${activeHackathon.status}`)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeLanguageSwitcher />

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
          <div className="mx-auto mt-2 max-w-[1200px] rounded-[24px] border border-[#171717]/10 bg-white/92 px-4 py-3 shadow-[0_24px_60px_rgba(24,27,32,0.12)] backdrop-blur-xl md:hidden">
            <div className="mb-3 flex items-center justify-between rounded-xl border border-[#171717]/10 bg-white/80 px-3 py-2 text-xs text-[#747474] backdrop-blur">
              <span className="truncate">{activeHackathon.title}</span>
              <span className="rounded-full bg-[#171717] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
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
                        ? 'border-[#171717]/30 bg-[#171717] text-white'
                        : 'border-[#171717]/10 bg-white text-[#747474]'
                    )}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>
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
  const year = new Date().getFullYear()

  return (
      <footer className="border-t border-white/10 bg-[#24211f] py-12 text-white md:py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 text-sm font-medium">
                {settings.logoUrl ? (
                <img src={settings.logoUrl} alt={settings.siteName} className="h-7" />
              ) : (
                <>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-[#24211f]">
                    {settings.siteName.slice(0, 1)}
                  </div>
                  <span>{settings.siteName}</span>
                </>
              )}
            </div>
            <p className="text-xs text-white/50">
              © {year} {settings.siteName}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/submit" className="text-sm text-white/68 transition-colors hover:text-white">
              {t('nav.submit')}
            </Link>
            {settings.showPoweredBy && (
              <a
                href={settings.poweredByUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-white/50 transition-colors hover:text-white"
              >
                {settings.poweredByText}
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  )
}
