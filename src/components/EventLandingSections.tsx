import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { Hackathon } from '@/lib/mock-data'
import { siteConfig } from '@/lib/site-config'
import { ArrowRight, Calendar, Users, Gavel, Sparkles, ChevronRight, Info, FileText, Clock, ExternalLink, Code2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

type Props = {
  hackathon: Hackathon
}

export function EventLandingSections({ hackathon }: Props) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('about')

  // Tabs configuration
  const tabs = [
    { id: 'about', label: t('hackathons.tabs.about', '赛事说明') },
    { id: 'schedule', label: t('hackathons.tabs.schedule', '日程') },
    { id: 'faq', label: t('hackathons.tabs.faq', 'FAQ') },
  ]

  // Status mapping
  const statusColor = {
    active: 'bg-black text-white dark:bg-white dark:text-black',
    upcoming: 'bg-blue-600 text-white',
    completed: 'bg-gray-500 text-white',
    draft: 'bg-yellow-500 text-black',
    judging: 'bg-purple-600 text-white',
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'schedule':
        return (
           <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="flex items-start gap-4 p-4 rounded-xl bg-white/50 dark:bg-white/5 border border-white/20">
               <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                 <Calendar className="h-5 w-5" />
               </div>
               <div>
                 <h3 className="font-semibold">报名开启</h3>
                 <p className="text-sm text-muted-foreground mt-1">{hackathon.startAt}</p>
                 <p className="text-sm mt-2">选手登录并完成报名，创建或加入团队。</p>
               </div>
             </div>
             <div className="flex items-start gap-4 p-4 rounded-xl bg-white/50 dark:bg-white/5 border border-white/20">
               <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg">
                 <Code2 className="h-5 w-5" />
               </div>
               <div>
                 <h3 className="font-semibold">作品提交截止</h3>
                 <p className="text-sm text-muted-foreground mt-1">{hackathon.endAt}</p>
                 <p className="text-sm mt-2">提交项目简介、演示链接与仓库链接。</p>
               </div>
             </div>
           </div>
        )
      case 'faq':
        return (
           <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="p-5 rounded-xl bg-white/50 dark:bg-white/5 border border-white/20 space-y-3">
               <h3 className="font-semibold flex items-center gap-2">
                 <Info className="h-4 w-4" /> 常见问题
               </h3>
               <div className="space-y-4">
                 <div>
                   <h4 className="text-sm font-medium">Q: 是否需要提前组队？</h4>
                   <p className="text-sm text-muted-foreground mt-1">不需要。你可以先报名，再创建团队或接受邀请加入团队。</p>
                 </div>
                 <div>
                   <h4 className="text-sm font-medium">Q: 作品提交可以修改吗？</h4>
                   <p className="text-sm text-muted-foreground mt-1">截止前可修改；截止后是否允许变更由管理员策略决定。</p>
                 </div>
               </div>
             </div>
           </div>
        )
      default: // about
        return (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
             <p className="text-lg leading-relaxed text-muted-foreground mb-6">
              {hackathon.tagline}
             </p>
             <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-8">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10">
                <Calendar className="h-4 w-4" />
                <span>{hackathon.startAt} – {hackathon.endAt}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10">
                <Users className="h-4 w-4" />
                <span>选手报名 / 组队 / 提交</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10">
                <Gavel className="h-4 w-4" />
                <span>评审 + 投票（可选）</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mb-10">
              <Link to="/login">
                <Button size="lg" className="rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 px-8 h-12">
                  立即报名
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/projects">
                <Button variant="outline" size="lg" className="rounded-full px-8 h-12 border-2">
                  浏览作品
                </Button>
              </Link>
              {hackathon.detailsUrl && (
                <a href={hackathon.detailsUrl} target="_blank" rel="noreferrer">
                   <Button variant="ghost" size="lg" className="rounded-full px-6 h-12 text-muted-foreground hover:text-foreground">
                    赛事详情文档
                    <ExternalLink className="ml-2 h-4 w-4" />
                   </Button>
                </a>
              )}
            </div>

            {/* Organizer */}
            <div className="pt-8 border-t border-black/5 dark:border-white/5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Presented By</p>
              <div className="flex flex-wrap gap-8 items-center">
                 <div className="font-bold text-xl flex items-center gap-2">
                   {siteConfig.organizerLogo ? (
                     <img src={siteConfig.organizerLogo} alt={siteConfig.organizerName} className="h-8" />
                   ) : (
                     <>
                       <div className="h-8 w-8 bg-primary rounded-lg"></div>
                       <span>{siteConfig.organizerName}</span>
                     </>
                   )}
                 </div>
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-blue-50 via-indigo-50/50 to-purple-50 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-950 shadow-xl backdrop-blur-xl">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-blue-400/20 to-purple-400/20 blur-[100px] rounded-full pointer-events-none -z-10" />
      
      <div className="grid lg:grid-cols-12 gap-8 p-8 md:p-12">
        {/* Left Column: Event Info */}
        <div className="lg:col-span-8 flex flex-col justify-between min-h-[400px]">
          <div>
            {/* Top Row: Status + Tabs */}
            <div className="flex flex-wrap items-center gap-3 mb-8">
              <span className={cn("px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase", statusColor[hackathon.status] || statusColor.draft)}>
                {hackathon.status}
              </span>
              <div className="flex items-center gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-full">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                      activeTab === tab.id
                        ? "bg-white dark:bg-white/10 text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground mb-4">
              {hackathon.title}
            </h1>
            
            {/* Dynamic Content Area */}
            {renderContent()}
          </div>
        </div>

        {/* Right Column: Quick Access Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white/60 dark:bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-sm h-full flex flex-col">
            <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider mb-4">
              {t('landing.quick_access', '快捷入口')}
            </h3>
            
            <div className="space-y-3 flex-1">
              <Link to="/login" className="group flex items-center justify-between p-4 rounded-xl bg-white dark:bg-white/5 border border-black/5 hover:border-blue-500/30 hover:shadow-md transition-all">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">报名入口</div>
                    <div className="text-xs text-muted-foreground mt-0.5">填写资料、组队、确认</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 transition-colors" />
              </Link>

              <button onClick={() => setActiveTab('schedule')} className="w-full group flex items-center justify-between p-4 rounded-xl bg-white dark:bg-white/5 border border-black/5 hover:border-purple-500/30 hover:shadow-md transition-all text-left">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">关键日程</div>
                    <div className="text-xs text-muted-foreground mt-0.5">报名/提交/评审/投票</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-purple-500 transition-colors" />
              </button>

              {hackathon.rulesUrl && (
                <a href={hackathon.rulesUrl} target="_blank" rel="noreferrer" className="w-full group flex items-center justify-between p-4 rounded-xl bg-white dark:bg-white/5 border border-black/5 hover:border-emerald-500/30 hover:shadow-md transition-all text-left">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600">
                      <Info className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">规则说明</div>
                      <div className="text-xs text-muted-foreground mt-0.5">查看完整规则文档 (GitHub)</div>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
                </a>
              )}
            </div>

            {/* AI Config Card */}
            <div className="mt-6 p-4 rounded-xl bg-slate-950 text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                <Sparkles className="h-12 w-12 text-white" />
              </div>
              <div className="flex items-center gap-2 text-xs text-white/60 mb-2">
                <Sparkles className="h-3 w-3" />
                <span>AI 兼容口子</span>
              </div>
              <div className="font-mono text-sm font-bold mb-1">baseUrl / apiKey / model</div>
              <div className="text-[10px] text-white/50 leading-relaxed">
                管理员可配置 OpenAI 兼容网关（DeepSeek/硅基流动等）。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
