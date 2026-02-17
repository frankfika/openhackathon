import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns'
import {
  ArrowRight,
  BookOpen,
  Calendar,
  FolderGit2,
  Gift,
  MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { projects } from '@/lib/mock-data'
import { siteConfig } from '@/lib/site-config'

// ─── Animation variants ──────────────────────────────────────────────
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
}

const staggerContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.1 } },
}

const statusColor: Record<string, string> = {
  active: 'bg-emerald-500 text-white',
  upcoming: 'bg-blue-600 text-white',
  completed: 'bg-gray-500 text-white',
  draft: 'bg-yellow-500 text-black',
  judging: 'bg-purple-600 text-white',
}

// ─── Hero Section ────────────────────────────────────────────────────
function HeroSection() {
  const { t } = useTranslation()
  const { activeHackathon: h } = useActiveHackathon()

  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0 })
  const isEnded = h.status === 'completed'
  const targetDate = h.status === 'active' ? h.endAt : h.startAt

  useEffect(() => {
    function calc() {
      const target = new Date(targetDate)
      const now = new Date()
      if (target <= now) return { days: 0, hours: 0, minutes: 0 }
      return {
        days: differenceInDays(target, now),
        hours: differenceInHours(target, now) % 24,
        minutes: differenceInMinutes(target, now) % 60,
      }
    }
    setCountdown(calc())
    const id = setInterval(() => setCountdown(calc()), 60000)
    return () => clearInterval(id)
  }, [targetDate])

  // Stats: project count + prize pool
  const projectCount = useMemo(
    () => projects.filter((p) => p.hackathonId === h.id && p.status === 'submitted').length,
    [h.id]
  )

  return (
    <section className="relative flex min-h-[calc(100vh-3.5rem)] items-center overflow-hidden">
      {/* Animated gradient blobs */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-gradient-to-br from-sky-400/30 to-fuchsia-400/20 blur-3xl dark:from-sky-400/15 dark:to-fuchsia-400/10"
        animate={{ x: [0, 20, 0], y: [0, 12, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gradient-to-br from-emerald-400/20 to-indigo-400/20 blur-3xl dark:from-emerald-400/10 dark:to-indigo-400/10"
        animate={{ x: [0, -18, 0], y: [0, 14, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-gradient-to-t from-violet-400/15 to-transparent blur-3xl"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="container relative mx-auto px-4 py-20 md:px-6 md:py-32">
        <motion.div
          className="mx-auto max-w-4xl text-center"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          {/* Status badge */}
          <motion.div variants={fadeUp}>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wider',
                statusColor[h.status] || statusColor.draft
              )}
            >
              {t(`landing.status.${h.status}`)}
            </span>
          </motion.div>

          {/* Title */}
          <motion.h1
            className="mt-6 text-4xl font-extrabold tracking-tight md:text-6xl lg:text-7xl"
            variants={fadeUp}
          >
            <span className="bg-gradient-to-r from-foreground via-foreground/80 to-foreground/60 bg-clip-text text-transparent">
              {h.title}
            </span>
          </motion.h1>

          {/* Tagline */}
          <motion.p
            className="mt-4 text-lg text-muted-foreground md:text-xl"
            variants={fadeUp}
          >
            {h.tagline}
          </motion.p>

          {/* Location & date pills */}
          <motion.div
            className="mt-6 flex flex-wrap items-center justify-center gap-3"
            variants={fadeUp}
          >
            {h.city && (
              <span className="inline-flex items-center gap-2 rounded-full bg-foreground/5 px-4 py-1.5 text-sm text-muted-foreground dark:bg-foreground/10">
                <MapPin className="h-4 w-4" />
                {h.city}
              </span>
            )}
            <span className="inline-flex items-center gap-2 rounded-full bg-foreground/5 px-4 py-1.5 text-sm text-muted-foreground dark:bg-foreground/10">
              <Calendar className="h-4 w-4" />
              {h.startAt} – {h.endAt}
            </span>
          </motion.div>

          {/* Stats: projects + prize */}
          <motion.div
            className="mt-8 inline-flex items-center gap-6 rounded-2xl border border-border/40 bg-background/60 px-6 py-4 shadow-sm backdrop-blur dark:bg-background/40"
            variants={fadeUp}
          >
            <div className="flex items-center gap-2.5">
              <FolderGit2 className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <div className="text-2xl font-bold tabular-nums">{projectCount}</div>
                <div className="text-xs text-muted-foreground">{t('landing.stats.projects')}</div>
              </div>
            </div>
            {h.prizePool && (
              <>
                <div className="h-8 w-px bg-border" />
                <div className="flex items-center gap-2.5">
                  <Gift className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <div className="text-2xl font-bold">{h.prizePool}</div>
                    <div className="text-xs text-muted-foreground">{t('landing.stats.prizes')}</div>
                  </div>
                </div>
              </>
            )}
          </motion.div>

          {/* Countdown */}
          {!isEnded && (
            <motion.div className="mt-6" variants={fadeUp}>
              <div className="inline-flex items-center gap-4">
                {[
                  { val: countdown.days, label: t('landing.hero.countdown_days') },
                  { val: countdown.hours, label: t('landing.hero.countdown_hours') },
                  { val: countdown.minutes, label: t('landing.hero.countdown_minutes') },
                ].map((item, i) => (
                  <React.Fragment key={item.label}>
                    {i > 0 && (
                      <span className="text-xl font-light text-muted-foreground/40">:</span>
                    )}
                    <div className="text-center">
                      <div className="text-2xl font-bold tabular-nums md:text-3xl">
                        {String(item.val).padStart(2, '0')}
                      </div>
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {h.status === 'active'
                  ? t('landing.hero.countdown_to_submission')
                  : t('landing.hero.countdown_to_start')}
              </p>
            </motion.div>
          )}
          {isEnded && (
            <motion.p className="mt-6 text-sm text-muted-foreground" variants={fadeUp}>
              {t('landing.hero.event_ended')}
            </motion.p>
          )}

          {/* Two CTA buttons: Register + View Docs */}
          <motion.div
            className="mt-8 flex flex-wrap items-center justify-center gap-4"
            variants={fadeUp}
          >
            <Link to="/login">
              <Button
                size="lg"
                className="h-12 rounded-full bg-blue-600 px-8 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700"
              >
                {t('landing.hero.register')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/docs">
              <Button
                variant="outline"
                size="lg"
                className="h-12 rounded-full border-2 px-8"
              >
                <BookOpen className="mr-2 h-4 w-4" />
                {t('landing.hero.view_docs')}
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

// ─── Footer ──────────────────────────────────────────────────────────
function FooterSection() {
  const { t } = useTranslation()
  const { activeHackathon: h } = useActiveHackathon()

  return (
    <footer className="border-t border-border/40 py-8">
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
            <Link to="/projects" className="hover:text-foreground transition-colors">
              {t('landing.footer.projects')}
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

// ─── Main Landing Page ───────────────────────────────────────────────
export function Landing() {
  return (
    <div className="flex flex-col min-h-screen">
      <HeroSection />
      <FooterSection />
    </div>
  )
}
