import React from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

export function Layout() {
  const location = useLocation()
  const isAuthPage = ['/login', '/register'].includes(location.pathname)

  if (isAuthPage) {
    return <Outlet />
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground [background:radial-gradient(1200px_circle_at_20%_0%,rgba(0,113,227,0.14),transparent_35%),radial-gradient(900px_circle_at_80%_10%,rgba(217,70,239,0.10),transparent_45%),radial-gradient(700px_circle_at_50%_100%,rgba(16,185,129,0.10),transparent_40%)]">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-sm font-semibold tracking-tight">
              OpenHackathon
            </Link>
            <nav className="hidden items-center gap-4 text-sm md:flex">
              <Link
                to="/hackathons"
                className={cn(
                  "rounded-full px-3 py-1 transition-colors",
                  location.pathname.startsWith('/hackathons') || location.pathname === '/'
                    ? 'bg-foreground/5 text-foreground'
                    : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                )}
              >
                Hackathons
              </Link>
              <Link
                to="/projects"
                className={cn(
                  "rounded-full px-3 py-1 transition-colors",
                  location.pathname.startsWith('/projects')
                    ? 'bg-foreground/5 text-foreground'
                    : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                )}
              >
                Projects
              </Link>
              <Link
                to="/dashboard/judging"
                className={cn(
                  "rounded-full px-3 py-1 transition-colors",
                  location.pathname.includes('/judging')
                    ? 'bg-foreground/5 text-foreground'
                    : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                )}
              >
                Judging
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard">
              <Button variant="outline" size="sm" className="rounded-full">
                Dashboard
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="ghost" size="sm" className="rounded-full">
                Log in
              </Button>
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
