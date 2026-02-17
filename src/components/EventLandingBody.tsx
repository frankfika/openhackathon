import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Hackathon } from '@/lib/mock-data'
import { ArrowRight, CheckCircle2, CircleHelp, Sparkles } from 'lucide-react'

type Props = {
  hackathon: Hackathon
}

function SectionHeader({
  kicker,
  title,
  desc,
}: {
  kicker: string
  title: string
  desc: string
}) {
  return (
    <div className="space-y-2">
      <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
        <Sparkles className="h-3.5 w-3.5" />
        <span>{kicker}</span>
      </div>
      <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        {desc}
      </p>
    </div>
  )
}

export function EventLandingBody({ hackathon }: Props) {
  const schedule = useMemo(
    () => [
      { title: '报名开启', date: hackathon.startAt, desc: '选手登录并完成报名，创建或加入团队。' },
      { title: '作品提交', date: hackathon.endAt, desc: '提交项目简介、演示链接与仓库链接。' },
      { title: '评审期', date: hackathon.endAt, desc: '评委在线评分与评语，管理员监控进度。' },
      { title: '大众投票', date: hackathon.endAt, desc: '公开投票（可开关），限额与反刷策略可配置。' },
    ],
    [hackathon.endAt, hackathon.startAt],
  )

  const rules = useMemo(
    () => [
      {
        title: '参赛规则',
        items: ['一队一作品', '遵守版权与开源许可', '禁止提交他人未授权内容'],
      },
      {
        title: '作品要求',
        items: ['必须提供清晰的一句话简介', '提供可访问的 Demo 或演示材料', '仓库需包含基础使用说明'],
      },
      {
        title: '评审维度',
        items: ['创新性', '技术深度', '完成度', '展示效果'],
      },
      {
        title: '投票规则',
        items: ['可设置匿名或登录投票', '支持投票限额与冷却时间', '管理员可开启验证码/反刷'],
      },
    ],
    [],
  )

  const faqs = useMemo(
    () => [
      {
        q: '是否需要提前组队？',
        a: '不需要。你可以先报名，再创建团队或接受邀请加入团队。',
      },
      {
        q: '作品提交可以修改吗？',
        a: '截止前可修改；截止后是否允许变更由管理员策略决定。',
      },
      {
        q: '投票是否必须登录？',
        a: '可选。平台支持匿名投票或邮箱验证码登录投票，并配套限额与反刷。',
      },
      {
        q: 'AI 功能怎么配置？',
        a: '只提供 OpenAI 兼容口子：baseUrl / apiKey / model，由管理员在后台配置。',
      },
    ],
    [],
  )

  return (
    <div className="mt-6 space-y-12">
      <div className="grid gap-10 lg:grid-cols-12">
        <section id="about" className="scroll-mt-24 lg:col-span-7">
          <SectionHeader
            kicker="About"
            title="赛事说明"
            desc="面向年轻创作者的产品冲刺：从灵感到 Demo，强调体验、可交付与可展示。"
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              {
                title: '面向人群',
                desc: '开发者 / 设计师 / 产品 / 学生团队',
              },
              {
                title: '提交物',
                desc: '一段 Demo + 一句话简介 + 仓库链接',
              },
              {
                title: '评审维度',
                desc: '创新、技术、完成度、展示',
              },
              {
                title: '公开展示',
                desc: '可开启大众投票与作品榜单',
              },
            ].map((x) => (
              <Card key={x.title} className="border-0 bg-white/60 shadow-sm backdrop-blur">
                <CardContent className="p-5">
                  <div className="text-sm font-semibold">{x.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{x.desc}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="signup" className="scroll-mt-24 lg:col-span-5">
          <SectionHeader kicker="Sign up" title="报名入口与流程" desc="先报名再组队，流程很短，支持本地 Demo 模式。" />
          <div className="mt-5 space-y-3">
            {[
              { title: '1. 登录 / 注册', desc: '邮箱或 GitHub 注册。' },
              { title: '2. 报名并填写资料', desc: '技能标签、参赛经验、联系方式。' },
              { title: '3. 创建 / 加入团队', desc: '邀请码邀请队友，随时可补充成员。' },
              { title: '4. 提交作品', desc: '提交链接与说明，截止前可更新。' },
            ].map((x) => (
              <div key={x.title} className="flex gap-3 rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm backdrop-blur">
                <div className="mt-0.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{x.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{x.desc}</div>
                </div>
              </div>
            ))}

            <div className="pt-1">
              <Link to="/register">
                <Button className="h-11 w-full rounded-full bg-apple-blue text-white shadow-sm hover:bg-apple-blue/90 hover:shadow">
                  现在就报名
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-10 lg:grid-cols-12">
        <section id="schedule" className="scroll-mt-24 lg:col-span-7">
          <SectionHeader kicker="Timeline" title="赛事日程" desc="按关键节点组织节奏，适合对外公示与社交传播。" />
          <div className="mt-6 space-y-3">
            {schedule.map((x) => (
              <div
                key={x.title}
                className="flex items-start justify-between gap-4 rounded-2xl border border-border/60 bg-white/60 p-5 shadow-sm backdrop-blur"
              >
                <div>
                  <div className="text-sm font-semibold">{x.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{x.desc}</div>
                </div>
                <div className="shrink-0 rounded-full bg-foreground/5 px-3 py-1 text-xs text-muted-foreground">{x.date}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="rules" className="scroll-mt-24 lg:col-span-5">
          <SectionHeader kicker="Rules" title="规则摘要" desc="对外展示用摘要，后台可维护完整版规则。" />
          <div className="mt-6 grid gap-3">
            {rules.map((r) => (
              <Card key={r.title} className="border-0 bg-white/60 shadow-sm backdrop-blur">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{r.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {r.items.map((it) => (
                      <li key={it} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground/35" />
                        <span className="min-w-0">{it}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>

      <section id="faq" className="scroll-mt-24">
        <SectionHeader kicker="FAQ" title="常见问题" desc="把疑问提前消化，报名转化会更高。" />
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {faqs.map((x) => (
            <Card key={x.q} className="border-0 bg-white/60 shadow-sm backdrop-blur">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className={cn('mt-0.5 rounded-xl bg-apple-blue/10 p-2 text-apple-blue')}>
                    <CircleHelp className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{x.q}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{x.a}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}

