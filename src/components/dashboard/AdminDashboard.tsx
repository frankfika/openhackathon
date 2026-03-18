import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useActiveHackathon } from '@/lib/active-hackathon'
import {
  BarChart3,
  CheckCircle2,
  FileText,
  FolderGit2,
  Gavel,
  Loader2,
  Plus,
  Settings as SettingsIcon,
  Trophy,
  Users,
  Wand2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { buildAdminPath, useAdminRoutes } from '@/lib/admin-routing'
import { SetupWizardDialog } from '@/components/SetupWizardDialog'
import { ScoringCriterion, SubmissionField, SubmissionSchemaConfig } from '@/lib/types'
import { shouldSuggestSetupWizard } from '@/lib/setup-wizard'
import { toast } from 'sonner'

function toDateInputValue(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().split('T')[0]
}

export function AdminDashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { activeHackathon } = useActiveHackathon()
  const { adminBasePath } = useAdminRoutes()
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false)

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats', activeHackathon?.id],
    queryFn: () =>
      api.getDashboardStats({
        hackathonId: activeHackathon?.id,
        role: 'admin',
      }),
    enabled: !!activeHackathon?.id,
  })

  const submissionFields = useMemo<SubmissionField[]>(() => {
    if (Array.isArray(activeHackathon.submissionSchema)) {
      return activeHackathon.submissionSchema
    }
    return activeHackathon.submissionSchema?.fields || []
  }, [activeHackathon.submissionSchema])

  const scoringCriteria = useMemo<ScoringCriterion[]>(() => activeHackathon.scoringCriteria || [], [activeHackathon.scoringCriteria])

  const shouldSuggestWizard = useMemo(() => {
    if (!activeHackathon.id) return false
    return shouldSuggestSetupWizard({
      submissionFieldCount: submissionFields.length,
      scoringCriteriaCount: scoringCriteria.length,
    })
  }, [activeHackathon.id, scoringCriteria.length, submissionFields.length])

  const updateMutation = useMutation({
    mutationFn: (data: {
      title: string
      tagline: string
      city?: string
      prizePool?: string
      startAt?: string
      endAt?: string
      gitbookUrl?: string
      rulesUrl?: string
      detailsUrl?: string
      submissionSchema: SubmissionSchemaConfig
      scoringCriteria: ScoringCriterion[]
    }) => {
      if (!activeHackathon.id) throw new Error('No hackathon selected')
      return api.updateHackathon(activeHackathon.id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hackathons'] })
      queryClient.invalidateQueries({ queryKey: ['current-hackathon'] })
      queryClient.invalidateQueries({ queryKey: ['hackathon', activeHackathon.id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats', activeHackathon.id] })
      toast.success(t('settings.saved'))
      setIsSetupWizardOpen(false)
    },
    onError: () => {
      toast.error(t('settings.save_error'))
    },
  })

  const hackathonStatus = activeHackathon.status || 'draft'

  // Contextual next-step guidance based on hackathon status
  const nextSteps = useMemo(() => {
    if (!activeHackathon.id) return []

    if (shouldSuggestWizard) {
      return [
        {
          icon: Wand2,
          title: t('dashboard.next.run_wizard', 'Run Setup Wizard'),
          desc: t('dashboard.next.run_wizard_desc', 'Configure submission form and scoring criteria in one step.'),
          action: () => setIsSetupWizardOpen(true),
          primary: true,
        },
        {
          icon: SettingsIcon,
          title: t('dashboard.next.manual_setup', 'Manual Setup'),
          desc: t('dashboard.next.manual_setup_desc', 'Configure each section individually in Hackathon Settings.'),
          action: () => navigate(buildAdminPath(adminBasePath, `hackathons/${activeHackathon.id}/settings`)),
        },
      ]
    }

    switch (hackathonStatus) {
      case 'draft':
      case 'upcoming':
        return [
          {
            icon: FolderGit2,
            title: t('dashboard.next.check_projects', 'Check Submissions'),
            desc: t('dashboard.next.check_projects_desc', 'Review submitted projects before judging begins.'),
            action: () => navigate(buildAdminPath(adminBasePath, 'projects')),
            primary: true,
          },
          {
            icon: SettingsIcon,
            title: t('dashboard.next.settings', 'Hackathon Settings'),
            desc: t('dashboard.next.settings_desc', 'Fine-tune submission form and scoring.'),
            action: () => navigate(buildAdminPath(adminBasePath, `hackathons/${activeHackathon.id}/settings`)),
          },
        ]
      case 'active':
        return [
          {
            icon: FolderGit2,
            title: t('dashboard.next.view_projects', 'View Submissions'),
            desc: t('dashboard.next.view_projects_desc', { count: stats?.totalProjects || 0, defaultValue: '{{count}} projects submitted so far.' }),
            action: () => navigate(buildAdminPath(adminBasePath, 'projects')),
            primary: true,
          },
          {
            icon: Users,
            title: t('dashboard.next.assign', 'Assign Judges'),
            desc: t('dashboard.next.assign_desc', 'Distribute projects to judges for review.'),
            action: () => navigate(buildAdminPath(adminBasePath, 'assignments')),
          },
        ]
      case 'judging':
        return [
          {
            icon: Gavel,
            title: t('dashboard.next.track_judging', 'Track Judging Progress'),
            desc: t('dashboard.next.track_judging_desc', { count: stats?.pendingReviews || 0, defaultValue: '{{count}} reviews still pending.' }),
            action: () => navigate(buildAdminPath(adminBasePath, 'reviews')),
            primary: true,
          },
          {
            icon: FileText,
            title: t('dashboard.next.report', 'View Report'),
            desc: t('dashboard.next.report_desc', 'Detailed scoring breakdown and export.'),
            action: () => navigate(buildAdminPath(adminBasePath, 'reports')),
          },
        ]
      case 'completed':
        return [
          {
            icon: BarChart3,
            title: t('dashboard.next.leaderboard', 'Publish Leaderboard'),
            desc: t('dashboard.next.leaderboard_desc', 'Finalize rankings and announce winners.'),
            action: () => navigate(buildAdminPath(adminBasePath, 'leaderboard')),
            primary: true,
          },
          {
            icon: FileText,
            title: t('dashboard.next.export', 'Export Report'),
            desc: t('dashboard.next.export_desc', 'Download scoring data as CSV.'),
            action: () => navigate(buildAdminPath(adminBasePath, 'reports')),
          },
        ]
      default:
        return []
    }
  }, [activeHackathon.id, activeHackathon.status, shouldSuggestWizard, hackathonStatus, stats, adminBasePath, navigate, t])

  const statCards = [
    {
      label: t('dashboard.stats.total_projects', 'Projects'),
      value: stats?.totalProjects || 0,
      icon: FolderGit2,
      tone: 'bg-cyan-500/12 text-cyan-700 dark:text-cyan-400',
    },
    {
      label: t('dashboard.stats.judges', 'Judges'),
      value: stats?.totalJudges || 0,
      icon: Users,
      tone: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400',
    },
    {
      label: t('dashboard.stats.pending_reviews', 'Pending Reviews'),
      value: stats?.pendingReviews || 0,
      icon: FileText,
      tone: 'bg-orange-500/12 text-orange-700 dark:text-orange-400',
    },
  ]

  if (!activeHackathon.id) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
        <Trophy className="h-12 w-12 text-muted-foreground/40" />
        <div>
          <p className="text-lg font-semibold">{t('dashboard.no_events', 'No hackathon selected.')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('hackathons.create_desc', 'Fill in the basics to get started. You can configure everything else later.')}
          </p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const statusLabels: Record<string, string> = {
    draft: t('hackathons.status.draft', 'Draft'),
    upcoming: t('hackathons.status.upcoming', 'Upcoming'),
    active: t('hackathons.status.active', 'Active'),
    judging: t('hackathons.status.judging', 'Judging'),
    completed: t('hackathons.status.completed', 'Completed'),
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{activeHackathon.title}</h1>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {statusLabels[hackathonStatus] || hackathonStatus}
          </span>
        </div>
        {activeHackathon.tagline && (
          <p className="mt-1 text-sm text-muted-foreground">{activeHackathon.tagline}</p>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-none shadow-none bg-muted/30">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`rounded-xl p-2.5 ${stat.tone}`}>
                <stat.icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Next steps */}
      {nextSteps.length > 0 && (
        <Card className="border-none shadow-none bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('dashboard.next_steps', 'Next Steps')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {nextSteps.map((step, i) => (
              <button
                key={i}
                type="button"
                onClick={step.action}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors',
                  step.primary
                    ? 'bg-primary/8 hover:bg-primary/12'
                    : 'hover:bg-foreground/5'
                )}
              >
                <div className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  step.primary ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  <step.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{step.title}</div>
                  <div className="text-xs text-muted-foreground">{step.desc}</div>
                </div>
                {step.primary && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary/50" />
                )}
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <SetupWizardDialog
        open={isSetupWizardOpen}
        onOpenChange={setIsSetupWizardOpen}
        title={activeHackathon.title}
        tagline={activeHackathon.tagline}
        city={activeHackathon.city || ''}
        prizePool={activeHackathon.prizePool || ''}
        startAt={toDateInputValue(activeHackathon.startAt)}
        endAt={toDateInputValue(activeHackathon.endAt)}
        gitbookUrl={activeHackathon.gitbookUrl || ''}
        rulesUrl={activeHackathon.rulesUrl || ''}
        detailsUrl={activeHackathon.detailsUrl || ''}
        existingSubmissionFields={submissionFields}
        isApplying={updateMutation.isPending}
        onApply={async (payload) => {
          await updateMutation.mutateAsync(payload)
        }}
      />
    </div>
  )
}
