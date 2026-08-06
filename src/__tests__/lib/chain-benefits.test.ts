import { describe, expect, it } from 'vitest';
import { getBenefitsForChain } from '@/lib/chain-benefits';

describe('getBenefitsForChain', () => {
  it('returns known chain metadata case-insensitively', () => {
    expect(getBenefitsForChain('ethereum')?.label).toBe('Ethereum');
    expect(getBenefitsForChain('ETHEREUM')?.label).toBe('Ethereum');
    expect(getBenefitsForChain('solana')?.label).toBe('Solana');
    expect(getBenefitsForChain('base')?.label).toBe('Base');
  });

  it('returns benefits array with at least one entry for known chains', () => {
    const info = getBenefitsForChain('ethereum');
    expect(info?.benefits.length).toBeGreaterThan(0);
  });

  it('returns null for unknown chains', () => {
    expect(getBenefitsForChain('not-a-chain')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(getBenefitsForChain('')).toBeNull();
  });
});
