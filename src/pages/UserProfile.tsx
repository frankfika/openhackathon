import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Trophy,
  Award,
  Gavel,
  Rocket,
  Loader2,
  ExternalLink,
  CheckCircle2,
  Clock,
  Link2,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { WalletAvatar, shortenAddress } from '@/components/WalletAvatar'
import type { CrossHackathonActivityEntry } from '@/lib/types'

function activityIcon(type: string) {
  if (type.startsWith('won')) return <Trophy className="h-4 w-4 text-yellow-500" />
  if (type === 'judged') return <Gavel className="h-4 w-4 text-blue-500" />
  if (type === 'awarded') return <Award className="h-4 w-4 text-amber-600" />
  return <Rocket className="h-4 w-4 text-violet-500" />
}

function OnChainBadge({ activity, t }: { activity: CrossHackathonActivityEntry; t: (key: string) => string }) {
  if (!activity.onChain) return null
  const confirmed = activity.onChainStatus === 'confirmed'
  const content = (
    <Badge variant={confirmed ? 'default' : 'secondary'} className="gap-1 text-xs">
      {confirmed ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {confirmed ? t('userProfile.on_chain') : activity.onChainStatus ?? t('userProfile.pending')}
    </Badge>
  )
  if (activity.explorerUrl) {
    return (
      <a href={activity.explorerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
        {content}
        <ExternalLink className="h-3 w-3 text-muted-foreground" />
      </a>
    )
  }
  return content
}

export function UserProfile() {
  const { t } = useTranslation()
  const { userId } = useParams<{ userId: string }>()

  const ACTIVITY_LABELS: Record<string, string> = {
    participated: t('userProfile.activity_participated'),
    judged: t('userProfile.activity_judged'),
    awarded: t('userProfile.activity_awarded'),
    won_first: t('userProfile.activity_won_first'),
    won_second: t('userProfile.activity_won_second'),
    won_third: t('userProfile.activity_won_third'),
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['global-profile', userId],
    queryFn: () => api.getGlobalProfile(userId!),
    enabled: !!userId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t('common.loading')}
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center text-muted-foreground">
        {t('userProfile.not_found')}
      </div>
    )
  }

  const { user, stats, activities } = data
  const primaryWallet = user.wallets?.find((w) => w.isPrimary) ?? user.wallets?.[0]

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        {primaryWallet ? (
          <WalletAvatar address={primaryWallet.address} chain={primaryWallet.chain} size={64} />
        ) : (
          <WalletAvatar address={user.id} size={64} showChain={false} />
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{user.name}</h1>
          {primaryWallet && (
            <p className="text-sm text-muted-foreground">
              {shortenAddress(primaryWallet.address)} · {primaryWallet.chain}
            </p>
          )}
          {!user.isWeb3User && (
            <Badge variant="secondary" className="mt-1">{t('userProfile.not_opted_in')}</Badge>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Trophy className="h-4 w-4" />} label={t('userProfile.points')} value={stats.globalPoints} />
        <StatCard icon={<Rocket className="h-4 w-4" />} label={t('userProfile.participated')} value={stats.participationCount} />
        <StatCard icon={<Gavel className="h-4 w-4" />} label={t('userProfile.judged')} value={stats.judgeCount} />
        <StatCard icon={<Award className="h-4 w-4" />} label={t('userProfile.awards')} value={stats.awardCount} />
      </div>

      {/* Linked wallets */}
      {user.wallets && user.wallets.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-4 w-4" /> {t('userProfile.linked_wallets')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {user.wallets.map((w) => (
              <div key={`${w.chain}:${w.address}`} className="flex items-center gap-3">
                <WalletAvatar address={w.address} chain={w.chain} size={28} />
                <span className="font-mono text-sm">{shortenAddress(w.address, 6)}</span>
                <Badge variant="outline" className="text-xs">{w.chain}</Badge>
                {w.isPrimary && <Badge variant="secondary" className="text-xs">{t('userProfile.primary')}</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Activity timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('userProfile.activity')}</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('userProfile.no_activity')}</p>
          ) : (
            <div className="space-y-3">
              {activities.map((a, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-border/40 pb-3 last:border-0 last:pb-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    {activityIcon(a.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{ACTIVITY_LABELS[a.type] ?? a.type}</span>
                      <span className="truncate text-sm text-muted-foreground">· {a.hackathon}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>+{a.points} pts</span>
                      <span>·</span>
                      <span>{new Date(a.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <OnChainBadge activity={a} t={t} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-1 py-4">
        <div className="flex items-center gap-1 text-muted-foreground">{icon}</div>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}
