import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trophy, Medal, Award, Loader2, Gavel, Rocket, Link2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { WalletAvatar, shortenAddress } from '@/components/WalletAvatar'
import { cn } from '@/lib/utils'

function useChainOptions() {
  const { t } = useTranslation()
  return [
    { value: 'all', label: t('globalLeaderboard.all_chains') },
    { value: 'ethereum', label: 'Ethereum' },
    { value: 'polygon', label: 'Polygon' },
    { value: 'base', label: 'Base' },
    { value: 'arbitrum', label: 'Arbitrum' },
    { value: 'optimism', label: 'Optimism' },
    { value: 'solana', label: 'Solana' },
  ]
}

function rankBadge(rank: number) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-400" />
  if (rank === 3) return <Award className="h-5 w-5 text-amber-700" />
  return <span className="text-sm font-semibold text-muted-foreground w-5 text-center">{rank}</span>
}

export function GlobalLeaderboard() {
  const { t } = useTranslation()
  const CHAIN_OPTIONS = useChainOptions()
  const [chain, setChain] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['global-leaderboard', chain],
    queryFn: () => api.getGlobalLeaderboard(chain === 'all' ? {} : { chain }),
  })

  const leaderboard = data?.leaderboard ?? []

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
          <Trophy className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{t('globalLeaderboard.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('globalLeaderboard.subtitle')}</p>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {leaderboard.length} {leaderboard.length === 1 ? t('globalLeaderboard.builder') : t('globalLeaderboard.builders')}
        </p>
        <Select value={chain} onValueChange={setChain}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHAIN_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t('globalLeaderboard.loading')}
        </div>
      ) : leaderboard.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Rocket className="mx-auto mb-3 h-8 w-8 opacity-50" />
            {t('globalLeaderboard.empty_title')} {t('globalLeaderboard.empty_desc')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry) => (
            <Link key={entry.userId} to={`/profile/${entry.userId}`}>
              <Card className={cn('transition-colors hover:bg-accent/50', entry.rank <= 3 && 'border-primary/30')}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex w-8 items-center justify-center">{rankBadge(entry.rank)}</div>

                  {entry.primaryWallet ? (
                    <WalletAvatar address={entry.primaryWallet.address} chain={entry.primaryWallet.chain} size={40} />
                  ) : (
                    <WalletAvatar address={entry.userId} size={40} showChain={false} />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{entry.name}</span>
                      {entry.wallets.length > 1 && (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Link2 className="h-3 w-3" />
                          {t('globalLeaderboard.wallets', { count: entry.wallets.length })}
                        </Badge>
                      )}
                    </div>
                    {entry.primaryWallet && (
                      <span className="text-xs text-muted-foreground">
                        {shortenAddress(entry.primaryWallet.address)} · {entry.primaryWallet.chain}
                      </span>
                    )}
                  </div>

                  <div className="hidden items-center gap-4 text-sm text-muted-foreground sm:flex">
                    <span className="flex items-center gap-1" title={t('globalLeaderboard.participated')}>
                      <Rocket className="h-3.5 w-3.5" /> {entry.participationCount}
                    </span>
                    <span className="flex items-center gap-1" title={t('globalLeaderboard.judged')}>
                      <Gavel className="h-3.5 w-3.5" /> {entry.judgeCount}
                    </span>
                    <span className="flex items-center gap-1" title={t('globalLeaderboard.awards')}>
                      <Award className="h-3.5 w-3.5" /> {entry.awardCount}
                    </span>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-bold">{entry.globalPoints.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{t('globalLeaderboard.points')}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
