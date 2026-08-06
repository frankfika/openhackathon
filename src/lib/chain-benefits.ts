export type ChainBenefitsInfo = {
  label: string;
  benefits: string[];
};

const CHAIN_BENEFITS: Record<string, ChainBenefitsInfo> = {
  ethereum: {
    label: 'Ethereum',
    benefits: [
      'Highest eligibility for ecosystem airdrops',
      'Featured on the global leaderboard',
      'Cross-hackathon recognition across mainnet events',
    ],
  },
  polygon: {
    label: 'Polygon',
    benefits: [
      'Polygon-builder multiplier on participation points',
      'Eligible for Polygon ecosystem showcases',
      'Cross-hackathon recognition on PoS events',
    ],
  },
  base: {
    label: 'Base',
    benefits: [
      'Base-builder onchain multiplier',
      'Eligible for Base ecosystem showcases',
      'Cross-hackathon recognition on Base events',
    ],
  },
  arbitrum: {
    label: 'Arbitrum',
    benefits: [
      'Arbitrum-builder multiplier on participation points',
      'Eligible for Arbitrum DAO ecosystem showcases',
    ],
  },
  optimism: {
    label: 'Optimism',
    benefits: [
      'OP-builder multiplier on participation points',
      'Eligible for Optimism RetroPGF-style showcases',
    ],
  },
  solana: {
    label: 'Solana',
    benefits: [
      'Solana-builder multiplier on participation points',
      'Eligible for Solana ecosystem showcases',
    ],
  },
};

export function getBenefitsForChain(chain: string): ChainBenefitsInfo | null {
  if (!chain) return null;
  const info = CHAIN_BENEFITS[chain.toLowerCase()];
  return info ?? null;
}
