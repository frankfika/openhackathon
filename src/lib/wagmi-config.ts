import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mainnet, polygon, base, arbitrum, optimism, sepolia, baseSepolia } from 'wagmi/chains'

// WalletConnect project ID. Get one free at https://cloud.walletconnect.com
// Falls back to a placeholder so the app still builds without it (injected
// wallets like MetaMask still work; WalletConnect QR needs a real ID).
const WALLETCONNECT_PROJECT_ID =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'openhackathon-dev-placeholder'

export const wagmiConfig = getDefaultConfig({
  appName: 'OpenHackathon',
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

export function chainNameFromId(chainId: number): string {
  return CHAIN_ID_TO_NAME[chainId] || 'ethereum'
}
