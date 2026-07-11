import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mainnet, polygon, base, arbitrum, optimism, sepolia, baseSepolia } from 'wagmi/chains'

// WalletConnect project ID. Get one free at https://cloud.walletconnect.com
// Falls back to a placeholder so the app still builds without it (injected
// wallets like MetaMask still work; WalletConnect QR needs a real ID).
const WALLETCONNECT_PROJECT_ID =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'openhackathon-dev-placeholder'

const APP_NAME = import.meta.env.VITE_APP_NAME || 'OpenHackathon'

export const wagmiConfig = getDefaultConfig({
  appName: APP_NAME,
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [mainnet, polygon, base, arbitrum, optimism, sepolia, baseSepolia],
  ssr: false,
})

// Maps a wagmi chain id to our backend chain identifier string.
export const CHAIN_ID_TO_NAME: Record<number, string> = {
  [mainnet.id]: 'ethereum',
  [sepolia.id]: 'ethereum',
  [polygon.id]: 'polygon',
  [base.id]: 'base',
  [baseSepolia.id]: 'base',
  [arbitrum.id]: 'arbitrum',
  [optimism.id]: 'optimism',
}

/**
 * Maps a wagmi chain id to our backend chain identifier string.
 *
 * Returns `null` if the chain is not in our supported set — callers MUST
 * check `isChainSupported` first. The legacy implementation silently
 * returned `'ethereum'` for unknown chains, which let BSC and other
 * unsupported networks impersonate mainnet to the backend (audit §1 #2).
 */
export function chainNameFromId(chainId: number | undefined): string | null {
  if (chainId === undefined || chainId === null) return null
  return CHAIN_ID_TO_NAME[chainId] ?? null
}

/**
 * Whether a wagmi chain id is one we accept sign-ins from. Used to disable
 * the "Sign in" button on unsupported networks (audit §3, residual row 11).
 */
export function isChainSupported(chainId: number | undefined): boolean {
  return chainNameFromId(chainId) !== null
}
