type WalletAvatarProps = {
  address: string
  chain?: string
  size?: number
  showChain?: boolean
  className?: string
}

const CHAIN_COLORS: Record<string, string> = {
  ethereum: 'bg-[#627eea]',
  polygon: 'bg-[#8247e5]',
  base: 'bg-[#0052ff]',
  arbitrum: 'bg-[#28a0f0]',
  optimism: 'bg-[#ff0420]',
  solana: 'bg-gradient-to-br from-[#9945ff] to-[#14f195]',
}

/** Shorten a wallet address for display: 0x1234…abcd */
export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 2) return address
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`
}

/**
 * Deterministic gradient avatar derived from the address, with an optional
 * chain badge. No external image dependency.
 */
export function WalletAvatar({ address, chain, size = 32, showChain = true, className = '' }: WalletAvatarProps) {
  // Derive a hue from the address for a stable color.
  const hue = parseInt(address.slice(2, 8), 16) % 360
  const gradient = `linear-gradient(135deg, hsl(${hue}, 70%, 55%), hsl(${(hue + 60) % 360}, 70%, 45%))`
  const chainColor = chain ? CHAIN_COLORS[chain.toLowerCase()] : undefined

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <div
        className="rounded-full border border-border/40"
        style={{ width: size, height: size, background: gradient }}
        title={address}
      />
      {showChain && chainColor && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-background ${chainColor}`}
          style={{ width: size * 0.4, height: size * 0.4 }}
          title={chain}
        />
      )}
    </div>
  )
}
