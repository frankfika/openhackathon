import React, { useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Calendar,
  FolderGit2,
  Gavel,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Plus,
  Settings,
  User,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { ThemeLanguageSwitcher } from '@/components/ThemeLanguageSwitcher'
import { useAuth } from '@/lib/auth'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { useSiteBranding } from '@/lib/site-branding'
import { buildAdminPath, useAdminRoutes } from '@/lib/admin-routing'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDateRange } from '@/lib/types'

interface NavSection {
  label?: string
  items: NavItem[]
}

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
}

export function DashboardLayout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const { activeHackathon, setActiveHackathonId, refreshHackathons, hackathons, isMultiHackathonMode } = useActiveHackathon()
  const { settings } = useSiteBranding()
  const { adminBasePath, adminLoginPath } = useAdminRoutes()

  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newHackathon, setNewHackathon] = useState({
    title: '',
    tagline: '',
    startAt: '',
    endAt: '',
  })
  const hasInvalidCreateDateRange = Boolean(
    newHackathon.startAt && newHackathon.endAt && newHackathon.startAt > newHackathon.endAt
  )
  const canCreateHackathon = Boolean(
    newHackathon.title.trim()
      && newHackathon.tagline.trim()
      && newHackathon.startAt
      && newHackathon.endAt
      && !hasInvalidCreateDateRange
  )

  const isAdmin = user?.role === 'admin'
  const roleLabel = isAdmin ? t('auth.admin') : t('auth.judge')
  const hasMultipleHackathons = isMultiHackathonMode && hackathons.length > 1
  const hasStarted = activeHackathon.status === 'active' || activeHackathon.status === 'judging' || activeHackathon.status === 'completed'
  const activeHackathonRange =
    activeHackathon.startAt && activeHackathon.endAt
      ? formatDateRange(activeHackathon.startAt, activeHackathon.endAt)
      : ''

  const handleSignOut = () => {
    logout()
    toast.success(t('auth.logout_success'))
    navigate(adminLoginPath)
  }

  const handleCreate = async () => {
    if (!canCreateHackathon) {
      if (hasInvalidCreateDateRange) {
        toast.error(t('submission.validation.date_order_invalid'))
      }
      return
    }
    setCreating(true)
    try {
      const created = await api.createHackathon({
        title: newHackathon.title.trim(),
        tagline: newHackathon.tagline.trim(),
        startAt: newHackathon.startAt,
        endAt: newHackathon.endAt,
        status: 'draft',
      })
      refreshHackathons()
      setActiveHackathonId(created.id)
      setCreateOpen(false)
      setNewHackathon({ title: '', tagline: '', startAt: '', endAt: '' })
      toast.success(t('hackathons.create_success', 'Hackathon created'))
      navigate(adminBasePath)
    } catch {
      toast.error(t('hackathons.create_error', 'Failed to create hackathon'))
    } finally {
      setCreating(false)
    }
  }

  const navSections = useMemo<NavSection[]>(() => {
    const sections: NavSection[] = [
      {
        items: [
          { name: t('nav.dashboard'), href: adminBasePath, icon: LayoutDashboard, exact: true },
        ],
      },
    ]

    const hackathonItems: NavItem[] = [
      ...(hasMultipleHackathons
        ? [{ name: t('nav.hackathons', 'Hackathons'), href: buildAdminPath(adminBasePath, 'hackathons'), icon: Calendar }]
        : []),
      ...(hasStarted
        ? [
            { name: t('nav.projects'), href: buildAdminPath(adminBasePath, 'projects'), icon: FolderGit2 },
            { name: t('nav.assignments', 'Review Management'), href: buildAdminPath(adminBasePath, 'assignments'), icon: Gavel },
            { name: t('nav.leaderboard'), href: buildAdminPath(adminBasePath, 'leaderboard'), icon: BarChart3 },
          ]
        : []),
    ]

    if (hackathonItems.length > 0) {
      sections.push({
        label: t('nav.section_hackathon', 'Hackathon'),
        items: hackathonItems,
      })
    }

    if (isAdmin) {
      if (hasStarted) {
        sections.push({
          label: t('nav.section_judges', 'Judges'),
          items: [
            { name: t('nav.judges', 'Judge Management'), href: buildAdminPath(adminBasePath, 'judges'), icon: Users },
          ],
        })
      }

      sections.push({
        label: t('nav.section_settings', 'Settings'),
        items: [
          ...(activeHackathon.id
            ? [{ name: t('nav.hackathon_settings', 'Hackathon Settings'), href: buildAdminPath(adminBasePath, `hackathons/${activeHackathon.id}/settings`), icon: Settings }]
            : []),
          { name: t('nav.activity_log', 'Activity Log'), href: buildAdminPath(adminBasePath, 'activity'), icon: History },
          { name: t('nav.site_settings', 'Site Settings'), href: buildAdminPath(adminBasePath, 'settings'), icon: Settings },
        ],
      })
    }

    return sections
  }, [adminBasePath, isAdmin, activeHackathon.id, hasMultipleHackathons, hasStarted, t])

  const isActive = (item: NavItem) =>
    item.exact
      ? location.pathname === item.href
      : location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)

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
          'fixed inset-y-0 left-0 z-50 w-64 transform border-r border-border/60 bg-background/75 backdrop-blur-xl transition-transform duration-300 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border/50 px-4">
          <Link to={adminBasePath} className="flex items-center gap-2.5">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={settings.siteName} className="h-7" />
            ) : (
              <>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
                  {settings.siteName.charAt(0)}
                </div>
                <span className="text-sm font-semibold tracking-tight">{settings.siteName}</span>
              </>
            )}
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Current hackathon indicator */}
        {activeHackathon.id && (
          <div className="border-b border-border/40 px-4 py-2.5">
            <div className="truncate text-xs font-medium text-muted-foreground">{t('nav.current_hackathon', 'Current')}</div>
            <div className="truncate text-sm font-semibold">{activeHackathon.title}</div>
            {activeHackathonRange ? (
              <div className="truncate text-xs text-muted-foreground">{activeHackathonRange}</div>
            ) : null}
            {hasMultipleHackathons ? (
              <Link
                to={buildAdminPath(adminBasePath, 'hackathons')}
                className="mt-1 inline-flex text-xs font-medium text-primary hover:underline"
              >
                {t('nav.switch_hackathon', 'Switch Hackathon')}
              </Link>
            ) : null}
          </div>
        )}

        <nav className="flex-1 space-y-4 px-3 py-3">
          {navSections.map((section, idx) => (
            <div key={idx}>
              {section.label && (
                <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {section.label}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                      isActive(item)
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t border-border/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <User className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
              </div>
            </div>
            <ThemeLanguageSwitcher />
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={handleSignOut}>
            <LogOut className="mr-2 h-3.5 w-3.5" />
            {t('nav.logout')}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-14 items-center justify-between border-b border-border/50 bg-background/70 px-4 backdrop-blur-xl md:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            {isAdmin && !activeHackathon.id && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t('hackathons.create', 'Create Hackathon')}
              </Button>
            )}
            <div className="hidden items-center gap-2 md:flex">
              <div className="text-right">
                <div className="text-sm font-medium">{user?.name}</div>
                <div className="text-xs text-muted-foreground">{roleLabel}</div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('hackathons.create', 'Create Hackathon')}</DialogTitle>
            <DialogDescription>{t('hackathons.create_desc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">{t('common.required_fields_hint')}</p>
            <div className="space-y-2">
              <Label htmlFor="new-title">
                {t('hackathons.title')}
                <span className="ml-1 text-destructive">*</span>
              </Label>
              <Input
                id="new-title"
                placeholder={t('hackathons.title')}
                value={newHackathon.title}
                onChange={(e) => setNewHackathon((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-tagline">
                {t('hackathons.tagline')}
                <span className="ml-1 text-destructive">*</span>
              </Label>
              <Input
                id="new-tagline"
                placeholder={t('hackathons.tagline')}
                value={newHackathon.tagline}
                onChange={(e) => setNewHackathon((prev) => ({ ...prev, tagline: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-start">
                  {t('hackathons.start_date')}
                  <span className="ml-1 text-destructive">*</span>
                </Label>
                <Input
                  id="new-start"
                  type="date"
                  value={newHackathon.startAt}
                  onChange={(e) => setNewHackathon((prev) => ({ ...prev, startAt: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-end">
                  {t('hackathons.end_date')}
                  <span className="ml-1 text-destructive">*</span>
                </Label>
                <Input
                  id="new-end"
                  type="date"
                  value={newHackathon.endAt}
                  onChange={(e) => setNewHackathon((prev) => ({ ...prev, endAt: e.target.value }))}
                />
              </div>
            </div>
            {hasInvalidCreateDateRange && (
              <p className="text-sm text-destructive">{t('submission.validation.date_order_invalid')}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !canCreateHackathon}
            >
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('hackathons.create', 'Create Hackathon')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
