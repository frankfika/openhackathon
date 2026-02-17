import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard,
  Trophy,
  FolderGit2,
  CheckSquare,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import { ThemeLanguageSwitcher } from '@/components/ThemeLanguageSwitcher'
import { HackathonSwitcher } from '@/components/HackathonSwitcher'
import { useAuth } from '@/lib/auth';
import { siteConfig } from '@/lib/site-config';
import { useTranslation } from 'react-i18next'

export function DashboardLayout() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin'

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    toast.success(t('auth.logout_success', 'Logged out successfully'))
    navigate('/login');
  }

  const navigation = React.useMemo(() => {
    const role = user?.role || 'user'

    const allNav = [
      { name: t('nav.dashboard'), href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'judge', 'user'] },
      { name: t('nav.hackathons'), href: '/dashboard/hackathons', icon: Trophy, roles: ['admin'] },
      { name: t('nav.projects'), href: '/dashboard/projects', icon: FolderGit2, roles: ['admin', 'judge', 'user'] },
      { name: t('nav.judging'), href: '/dashboard/judging', icon: CheckSquare, roles: ['admin', 'judge'] },
      { name: t('nav.leaderboard', 'Leaderboard'), href: '/dashboard/leaderboard', icon: BarChart3, roles: ['admin', 'judge', 'user'] },
      { name: t('settings.title'), href: '/dashboard/settings', icon: Settings, roles: ['admin', 'judge', 'user'] },
    ];

    return allNav.filter(item => item.roles.includes(role))
  }, [user, t])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform border-r border-border/60 bg-background/90 shadow-lg backdrop-blur transition-transform duration-200 ease-in-out lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b bg-background px-6">
            <Link to="/" className="flex items-center gap-3 px-2">
              {siteConfig.organizerLogo ? (
                <img src={siteConfig.organizerLogo} alt={siteConfig.organizerName} className="h-8" />
              ) : (
                <>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <span className="text-lg font-bold">{siteConfig.organizerName.charAt(0)}</span>
                  </div>
                  <span className="font-semibold tracking-tight">{siteConfig.organizerName}</span>
                </>
              )}
            </Link>
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {isAdmin && (
            <div className="px-4 pt-4">
              <HackathonSwitcher />
            </div>
          )}

          <nav className="space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50",
                  item.href === location.pathname
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-5 w-5 flex-shrink-0",
                    isActive ? "text-apple-blue" : "text-gray-400 group-hover:text-gray-500"
                  )}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border/60 p-4">
          <div className="mb-4 flex justify-center">
            <ThemeLanguageSwitcher />
          </div>
          <div className="mb-2 flex items-center rounded-md bg-foreground/5 p-2">
            <div className="h-8 w-8 rounded-full bg-apple-blue/20 flex items-center justify-center text-apple-blue">
              <User className="h-4 w-4" />
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">{user?.role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-red-500 hover:bg-red-500/10 hover:text-red-600"
            onClick={handleSignOut}
          >
            <LogOut className="mr-3 h-5 w-5" />
            {t('nav.logout')}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-16 items-center justify-between border-b border-border/60 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>

          <div className="flex items-center gap-2 lg:hidden">
            <span className="text-lg font-semibold tracking-tight">{siteConfig.organizerName}</span>
          </div>

          <div className="flex flex-1 justify-end items-center gap-4">
            <ThemeLanguageSwitcher />
            <div className="hidden md:flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <User className="h-4 w-4" />
              </div>
              <div className="text-sm">
                <div className="font-medium">{user?.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{user?.role}</div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

      <div className="flex-1 overflow-y-auto bg-gray-50/50 p-6 dark:bg-gray-900/50">
            <div className="mx-auto max-w-6xl space-y-8">
              <Outlet />
            </div>
          </div>
      </div>
    </div>
  );
}
