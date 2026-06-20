import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Loader2, Wallet } from 'lucide-react'
import { useWeb3Auth } from '@/lib/use-web3-auth'

type WalletConnectProps = {
  /** Called with the login result after a successful sign-in. */
  onSignIn?: (result: Awaited<ReturnType<ReturnType<typeof useWeb3Auth>['signIn']>>) => void
  /** Label for the sign-in button after wallet is connected. */
  signInLabel?: string
}

/**
 * Combines RainbowKit's wallet connection with the backend sign-in flow.
 * When no wallet is connected, shows the Connect button.
 * Once connected, shows a "Sign in" button that triggers the SIWE flow.
 */
export function WalletConnect({ onSignIn, signInLabel }: WalletConnectProps) {
  const { t } = useTranslation()
  const { isConnected } = useAccount()
  const { signIn, isPending, error } = useWeb3Auth()

  async function handleSignIn() {
    const result = await signIn()
    if (result) {
      onSignIn?.(result)
    }
  }

  return (
    <div className="space-y-3">
      <ConnectButton.Custom>
        {({ account, chain, openConnectModal, openChainModal, openAccountModal, mounted }) => {
          const ready = mounted
          const connected = ready && account && chain

          return (
            <div className="w-full" aria-hidden={!ready}>
              {!connected ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10"
                  onClick={openConnectModal}
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  {t('wallet.connect_wallet')}
                </Button>
              ) : chain.unsupported ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full h-10"
                  onClick={openChainModal}
                >
                  {t('wallet.wrong_network')}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1 h-10 justify-start text-sm"
                    onClick={openAccountModal}
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      <img src={chain.iconUrl} alt={chain.name ?? ''} className="mr-2 h-4 w-4 rounded-full" />
                    )}
                    {account.displayName}
                  </Button>
                </div>
              )}
            </div>
          )
        }}
      </ConnectButton.Custom>

      {isConnected && (
        <Button type="button" className="w-full h-10" onClick={handleSignIn} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {signInLabel ?? t('auth.sign_in_with_wallet')}
        </Button>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
