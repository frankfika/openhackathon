import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, Wallet, Trash2, Link2, Gift, Globe, Trophy } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { WalletAvatar } from '@/components/WalletAvatar'
import { WalletConnect } from '@/components/WalletConnect'
import { shortenAddress } from '@/lib/wallet'
import { getBenefitsForChain } from '@/lib/chain-benefits'

const BENEFITS = [
  { icon: Trophy, key: 'cross_hackathon_points' },
  { icon: Globe, key: 'global_profile' },
  { icon: Gift, key: 'chain_rewards' },
]

export function Account() {
  const { t } = useTranslation()
  const { user: authUser } = useAuth()
  const queryClient = useQueryClient()
  const [linkMode, setLinkMode] = useState(false)

  const profileQuery = useQuery({
    queryKey: ['global-profile', authUser?.id],
    queryFn: () => api.getGlobalProfile(authUser!.id),
    enabled: !!authUser?.id,
  })

  const unlinkMutation = useMutation({
    mutationFn: async (params: { address: string; chain: string }) => {
      await api.unlinkWallet(params.address, params.chain)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-profile', authUser?.id] })
      toast.success(t('account.wallet_unlinked', 'Wallet unlinked'))
    },
    onError: () => {
      toast.error(t('account.wallet_unlink_failed', 'Failed to unlink wallet'))
    },
  })

  if (!authUser) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        {t('common.loading')}
      </div>
    )
  }

  const user = profileQuery.data?.user ?? authUser
  const wallets = user.wallets ?? []

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('account.title', 'Account')}</h1>
        <p className="text-sm text-muted-foreground">{t('account.subtitle', 'Manage your profile and linked wallets.')}</p>
      </div>

      {/* Profile summary */}
      <Card className="surface-panel border-none shadow-none">
        <CardHeader>
          <CardTitle>{t('account.profile', 'Profile')}</CardTitle>
          <CardDescription>{t('account.profile_desc', 'Your basic account information.')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">{t('common.name')}</p>
              <p className="text-sm text-muted-foreground">{user.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{t('common.email')}</p>
              <p className="text-sm text-muted-foreground">{user.email ?? '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{t('auth.role')}</p>
              <p className="text-sm text-muted-foreground capitalize">{user.role}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Linked wallets */}
      <Card className="surface-panel border-none shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {t('account.wallets', 'Linked Wallets')}
          </CardTitle>
          <CardDescription>
            {t(
              'account.wallets_desc',
              'Link wallets to build a cross-hackathon identity. You can link multiple chains.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {wallets.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('account.no_wallets', 'No wallets linked yet.')}</p>
          ) : (
            <div className="space-y-3">
              {wallets.map((w) => (
                <div
                  key={`${w.chain}:${w.address}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-background/50 p-3"
                >
                  <div className="flex items-start gap-3">
                    <WalletAvatar address={w.address} chain={w.chain} size={36} />
                    <div className="space-y-1">
                      <p className="font-mono text-sm">{shortenAddress(w.address, 6)}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs capitalize">{w.chain}</Badge>
                        {w.isPrimary && (
                          <Badge variant="secondary" className="text-xs">{t('userProfile.primary')}</Badge>
                        )}
                      </div>
                      <WalletChainBenefits chain={w.chain} />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => unlinkMutation.mutate({ address: w.address, chain: w.chain })}
                    disabled={unlinkMutation.isPending}
                  >
                    {unlinkMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Separator />

          {!linkMode ? (
            <Button onClick={() => setLinkMode(true)} variant="outline" className="w-full sm:w-auto">
              <Link2 className="mr-2 h-4 w-4" />
              {t('account.link_wallet', 'Link a Wallet')}
            </Button>
          ) : (
            <div className="rounded-lg border border-border bg-background/50 p-4 space-y-4">
              <p className="text-sm font-medium">{t('account.link_wallet_title', 'Connect and sign to link')}</p>
              <WalletConnect
                signInLabel={t('account.link_wallet_sign', 'Link Wallet')}
                onSignIn={() => {
                  setLinkMode(false)
                  queryClient.invalidateQueries({ queryKey: ['global-profile', authUser.id] })
                  toast.success(t('account.wallet_linked', 'Wallet linked'))
                }}
              />
              <Button variant="ghost" size="sm" onClick={() => setLinkMode(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Benefits */}
      <Card className="surface-panel border-none shadow-none">
        <CardHeader>
          <CardTitle>{t('account.benefits', 'Wallet Benefits')}</CardTitle>
          <CardDescription>
            {t(
              'account.benefits_desc',
              'Linking a wallet is optional, but unlocks cross-hackathon perks.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {BENEFITS.map((benefit) => (
              <div key={benefit.key} className="rounded-lg border border-border bg-background/50 p-4">
                <benefit.icon className="mb-2 h-5 w-5 text-primary" />
                <p className="text-sm font-medium">{t(`account.benefit_${benefit.key}_title`)}</p>
                <p className="text-xs text-muted-foreground">{t(`account.benefit_${benefit.key}_desc`)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function WalletChainBenefits({ chain }: { chain: string }) {
  const { t } = useTranslation()
  const info = getBenefitsForChain(chain)
  if (!info) return null
  return (
    <div className="mt-1 rounded-md border border-border/60 bg-background/50 p-2">
      <p className="mb-1 flex items-center gap-1 text-xs font-medium text-primary">
        <Gift className="h-3 w-3" />
        {t('account.chain_benefits', '{{chain}} perks', { chain: info.label })}
      </p>
      <ul className="space-y-0.5">
        {info.benefits.map((b, i) => (
          <li key={i} className="text-xs text-muted-foreground">• {b}</li>
        ))}
      </ul>
    </div>
  )
}
