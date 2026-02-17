import React from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Hackathon } from '@/lib/mock-data'
import { ArrowRight, Calendar, Gavel, Sparkles, Users } from 'lucide-react'

type Props = {
  hackathon: Hackathon
}

const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
}

export function EventLandingHero({ hackathon }: Props) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-background/60 shadow-sm backdrop-blur">
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-sky-400/35 to-fuchsia-400/25 blur-3xl"
        animate={{ x: [0, 18, 0], y: [0, 10, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-emerald-400/25 to-indigo-400/25 blur-3xl"
        animate={{ x: [0, -16, 0], y: [0, 12, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative p-6 md:p-10">
        <motion.div
          className="grid gap-8 lg:grid-cols-12"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.div className="lg:col-span-7" variants={fadeUp} transition={{ duration: 0.5 }}>
            <div className="inline-flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-foreground/90 px-3 py-1 text-xs font-medium text-background">
                {hackathon.status.toUpperCase()}
              </span>
              {[
                { href: '#about', label: '赛事说明' },
                { href: '#signup', label: '报名' },
                { href: '#schedule', label: '日程' },
                { href: '#rules', label: '规则' },
                { href: '#faq', label: 'FAQ' },
              ].map((x) => (
                <a
                  key={x.href}
                  href={x.href}
                  className="inline-flex items-center rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-background"
                >
                  {x.label}
                </a>
              ))}
            </div>

            <h1 className="mt-5 text-balance font-display text-3xl font-semibold tracking-tight md:text-5xl">
              <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {hackathon.title}
              </span>
            </h1>
            <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
              {hackathon.tagline}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 rounded-full bg-foreground/5 px-3 py-1">
                <Calendar className="h-4 w-4" />
                {hackathon.startAt} – {hackathon.endAt}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-foreground/5 px-3 py-1">
                <Users className="h-4 w-4" />
                选手报名 / 组队 / 提交
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-foreground/5 px-3 py-1">
                <Gavel className="h-4 w-4" />
                评审 + 投票（可选）
              </span>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/register">
                <Button className="h-11 rounded-full bg-apple-blue px-6 text-white shadow-sm hover:bg-apple-blue/90 hover:shadow">
                  立即报名
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/projects">
                <Button variant="outline" className="h-11 rounded-full bg-background/70 px-6 backdrop-blur hover:bg-background">
                  浏览作品
                </Button>
              </Link>
            </div>
          </motion.div>

          <motion.div className="lg:col-span-5" variants={fadeUp} transition={{ duration: 0.5, delay: 0.1 }}>
            <Card className="border-0 bg-white/60 shadow-sm backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">快速入口</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { href: '#signup', title: '报名入口', desc: '填写资料、组队、确认' },
                  { href: '#schedule', title: '关键日程', desc: '报名/提交/评审/投票' },
                  { href: '#rules', title: '规则说明', desc: '作品要求、评审维度' },
                ].map((x) => (
                  <a
                    key={x.href}
                    href={x.href}
                    className="group flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 p-4 transition-colors hover:bg-background"
                  >
                    <div>
                      <div className="text-sm font-semibold">{x.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{x.desc}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </a>
                ))}

                <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-foreground/90 to-foreground p-4 text-background">
                  <div className="flex items-center gap-2 text-xs text-white/70">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>AI 兼容口子</span>
                  </div>
                  <div className="mt-2 text-sm font-semibold">baseUrl / apiKey / model</div>
                  <div className="mt-1 text-xs text-white/70">管理员可配置 OpenAI 兼容网关（DeepSeek/硅基流动等）。</div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}

