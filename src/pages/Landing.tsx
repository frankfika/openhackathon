import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Gift,
  MapPin,
  Search,
  Sparkles,
  Trophy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDateRange } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useActiveHackathon } from '@/lib/active-hackathon'

const fadeUp = {
  initial: { opacity: 0, y: 28, filter: 'blur(10px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
}

const staggerContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.09, delayChildren: 0.08 } },
}

const statusColor: Record<string, string> = {
  active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400',
  upcoming: 'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400',
  completed: 'border-stone-500/25 bg-stone-500/10 text-stone-700 dark:border-stone-500/30 dark:bg-stone-500/10 dark:text-stone-400',
  draft: 'border-amber-500/30 bg-amber-400/14 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400',
  judging: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-400',
}

function CountdownBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 flex-1 text-center">
      <div className="font-display text-[30px] font-semibold leading-none tracking-[-0.04em] text-foreground md:text-[38px]">
        {String(value).padStart(2, '0')}
      </div>
      <div className="mt-2 text-xs font-medium text-muted-foreground md:text-sm">{label}</div>
    </div>
  )
}

function HeroSection() {
  const { t } = useTranslation()
  const { activeHackathon: h } = useActiveHackathon()

  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0 })
  const targetDate = h.status === 'active' ? h.endAt : h.startAt
  const [countdownExpired, setCountdownExpired] = useState(false)
  const isEnded = h.status === 'completed' || (h.status === 'active' && countdownExpired)
  const displayTitle = h.title && h.title !== 'Loading…' ? h.title : 'OpenHackathon'
  const displayTagline = h.tagline || 'A focused hackathon workspace for builders, judges, and organizers.'
  const hasSchedule = Boolean(h.startAt && h.endAt)
  const scheduleText = hasSchedule ? formatDateRange(h.startAt, h.endAt) : 'Ready for builders, judges, and organizers'

  useEffect(() => {
    function calc() {
      const target = new Date(targetDate)
      const now = new Date()
      if (target <= now || Number.isNaN(target.getTime())) {
        setCountdownExpired(true)
        return { days: 0, hours: 0, minutes: 0 }
      }
      setCountdownExpired(false)
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

  const stats = [
    { value: h.prizePool || 'Live', label: t('landing.stats.prizes'), icon: Gift },
    { value: h.status === 'active' ? 'Open' : t('landing.status.' + h.status, h.status), label: t('landing.hero.submit_project'), icon: CheckCircle2 },
    { value: h.city || 'Online', label: h.city ? t('common.location', 'Location') : 'Global access', icon: MapPin },
  ]

  return (
    <section className="dinq-hero relative isolate grid min-h-[calc(100dvh-4rem)] grid-rows-[1fr_auto] overflow-hidden px-5 pb-12 pt-20 md:min-h-[calc(100dvh-4rem)] md:px-8 md:pb-16 md:pt-28">
      <div className="dinq-dot-bg" aria-hidden="true" />
      <div className="dinq-grain" aria-hidden="true" />

      <div className="dinq-world-map" aria-hidden="true">
        <svg viewBox="0 0 1200 420" preserveAspectRatio="xMidYMid meet">
          <defs>
            <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#a98150" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#a98150" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="routeGrad" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="18%" stopColor="#a98150" stopOpacity="0.36" />
              <stop offset="82%" stopColor="#a98150" stopOpacity="0.36" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {Array.from({ length: 126 }).map((_, index) => {
            const col = index % 18
            const row = Math.floor(index / 18)
            const x = 88 + col * 58 + ((row % 2) * 19)
            const y = 44 + row * 48 + ((col % 3) * 5)
            const opacity = 0.06 + ((index * 7) % 8) / 100
            return <circle key={index} cx={x} cy={y} r="2.4" className="text-foreground" fill="currentColor" opacity={opacity} />
          })}
          <path className="dinq-map-route" d="M185 238 C360 92 610 92 752 226" stroke="url(#routeGrad)" />
          <path className="dinq-map-route dinq-map-route-delay" d="M752 226 C850 138 970 146 1050 224" stroke="url(#routeGrad)" />
          <path className="dinq-map-route dinq-map-route-slow" d="M185 238 C462 34 840 42 1050 224" stroke="url(#routeGrad)" />
          {[
            [185, 238],
            [752, 226],
            [1050, 224],
          ].map(([cx, cy]) => (
            <g key={`${cx}-${cy}`}>
              <circle className="dinq-map-pulse" cx={cx} cy={cy} r="23" fill="url(#nodeGlow)" />
              <circle cx={cx} cy={cy} r="5.5" className="text-primary" fill="currentColor" />
            </g>
          ))}
        </svg>
      </div>

      <motion.div
        className="relative z-10 mx-auto flex w-full max-w-[1040px] flex-col items-center self-center text-center"
        initial="initial"
        animate="animate"
        variants={staggerContainer}
      >
        <motion.div variants={fadeUp} transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}>
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] backdrop-blur-md',
              statusColor[h.status] || statusColor.draft
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t('landing.status.' + h.status, h.status)}
          </span>
        </motion.div>

        <motion.h1
          className="dinq-display mt-7 max-w-[980px] text-balance text-[clamp(3.25rem,9.5vw,8.6rem)] font-semibold leading-[0.84] tracking-[-0.075em] text-foreground"
          variants={fadeUp}
          transition={{ duration: 0.72, ease: [0.23, 1, 0.32, 1] }}
        >
          {displayTitle}
        </motion.h1>

        <motion.p
          className="mt-7 max-w-[760px] text-pretty text-base leading-7 text-muted-foreground md:text-lg"
          variants={fadeUp}
          transition={{ duration: 0.65, ease: [0.23, 1, 0.32, 1] }}
        >
          {displayTagline}
        </motion.p>

        <motion.div
          className="dinq-search mt-9 flex min-h-[60px] w-full max-w-[880px] items-center rounded-full border border-foreground/80 bg-background/80 pl-5 pr-[66px] shadow-[0_22px_48px_rgba(24,27,32,0.09),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl dark:border-white/30 dark:bg-slate-900/80 dark:shadow-[0_22px_48px_rgba(0,0,0,0.35)] md:pl-7"
          variants={fadeUp}
          transition={{ duration: 0.65, ease: [0.23, 1, 0.32, 1] }}
        >
          <span className="mr-3 hidden text-primary md:inline-flex">
            <Search className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-sm text-muted-foreground md:text-base">
            {h.city ? `${h.city} · ${scheduleText}` : scheduleText}
          </span>
          <Link
            to="/submit"
            className="absolute bottom-1 right-1 top-1 inline-grid aspect-square place-items-center rounded-full bg-foreground text-background transition-all duration-300 hover:scale-[1.03] hover:bg-foreground/90 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            aria-label={t('landing.hero.submit_project')}
          >
            <ArrowRight className="h-5 w-5" />
          </Link>
        </motion.div>

        <motion.div
          className="mt-6 flex flex-wrap items-center justify-center gap-3"
          variants={fadeUp}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        >
          <Button asChild size="lg" className="dinq-primary-button h-12 rounded-full px-6 text-[15px]">
            <Link to="/submit">
              {t('landing.hero.submit_project')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="dinq-secondary-button h-12 rounded-full px-6 text-[15px]">
            <Link to="/docs">
              <BookOpen className="h-4 w-4" />
              {t('landing.hero.view_docs')}
            </Link>
          </Button>
        </motion.div>

        {hasSchedule && !isEnded ? (
          <motion.div
            className="relative mt-12 w-full max-w-[880px]"
            variants={fadeUp}
            transition={{ duration: 0.68, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="dinq-countdown-glow" aria-hidden="true" />
            <div className="grid grid-cols-3 divide-x divide-border">
              <CountdownBlock value={countdown.days} label={t('landing.hero.countdown_days')} />
              <CountdownBlock value={countdown.hours} label={t('landing.hero.countdown_hours')} />
              <CountdownBlock value={countdown.minutes} label={t('landing.hero.countdown_minutes')} />
            </div>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {h.status === 'active' ? t('landing.hero.countdown_to_submission') : t('landing.hero.countdown_to_start')}
            </p>
          </motion.div>
        ) : hasSchedule ? (
          <motion.p className="mt-10 text-sm font-medium text-muted-foreground" variants={fadeUp}>
            {t('landing.hero.event_ended')}
          </motion.p>
        ) : null}
      </motion.div>

      <motion.ul
        className="relative z-10 mx-auto mt-12 grid w-full max-w-[960px] grid-cols-1 gap-3 p-0 sm:grid-cols-3"
        initial="initial"
        animate="animate"
        variants={staggerContainer}
        aria-label="Hackathon highlights"
      >
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <motion.li
              key={stat.label}
              className="dinq-stat-card list-none rounded-[24px] border border-border bg-background/60 p-5 text-left backdrop-blur-xl dark:bg-slate-900/60"
              variants={fadeUp}
              transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
            >
              <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background dark:bg-white dark:text-slate-900">
                <Icon className="h-4 w-4" />
              </div>
              <div className="truncate font-display text-2xl font-semibold tracking-[-0.04em] text-foreground">{stat.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
            </motion.li>
          )
        })}
      </motion.ul>
    </section>
  )
}

function FeatureBand() {
  const { t } = useTranslation()

  const items = [
    {
      title: t('landing.hero.view_docs'),
      desc: t('landing.quick_actions.docs_desc'),
      href: '/docs',
      icon: BookOpen,
    },
    {
      title: t('landing.hero.submit_project'),
      desc: t('landing.quick_actions.submit_desc'),
      href: '/submit',
      icon: Sparkles,
    },
    {
      title: t('nav.leaderboard'),
      desc: t('landing.quick_actions.leaderboard_desc'),
      href: '/leaderboard',
      icon: Trophy,
    },
  ]

  return (
    <section className="px-5 py-12 md:px-8 md:py-16">
      <div className="mx-auto max-w-[1160px]">
        <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">OpenHackathon</p>
            <h2 className="dinq-display mt-3 max-w-[620px] text-4xl font-semibold tracking-[-0.06em] text-foreground md:text-6xl">
              Build, submit, judge. All in one flow.
            </h2>
          </div>
          <p className="max-w-[360px] text-sm leading-6 text-muted-foreground">
            A calm public face for participants, with direct paths into every important action.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.title} to={item.href} className="dinq-feature-card group rounded-[28px] border border-border bg-background/70 p-6 backdrop-blur-xl dark:bg-slate-900/70">
                <div className="mb-10 flex items-center justify-between">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent text-foreground dark:bg-slate-800 dark:text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-foreground opacity-40 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
                </div>
                <h3 className="text-xl font-semibold tracking-[-0.03em] text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.desc}</p>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function Landing() {
  return (
    <div className="flex flex-1 flex-col">
      <HeroSection />
      <FeatureBand />
    </div>
  )
}
