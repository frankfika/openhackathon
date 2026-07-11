import { describe, it, expect } from 'vitest'
import { chainNameFromId, isChainSupported, CHAIN_ID_TO_NAME } from '@/lib/wagmi-config'

describe('chainNameFromId', () => {
  it('maps known chain ids to backend names', () => {
    expect(chainNameFromId(1)).toBe('ethereum') // mainnet
    expect(chainNameFromId(137)).toBe('polygon')
    expect(chainNameFromId(8453)).toBe('base')
  })

  it('returns null for unsupported chains (was "ethereum" before P0-5)', () => {
    // BSC, zkSync, Fantom, etc. — none of these are in our supported set.
    expect(chainNameFromId(56)).toBeNull() // BSC
    expect(chainNameFromId(324)).toBeNull() // zkSync
    expect(chainNameFromId(250)).toBeNull() // Fantom
  })

  it('returns null for undefined / null', () => {
    expect(chainNameFromId(undefined)).toBeNull()
    expect(chainNameFromId(null as unknown as number | undefined)).toBeNull()
  })

  it('CHAIN_ID_TO_NAME is the same map the hook reads', () => {
    // Ensure the map exports the keys we expect.
    expect(Object.keys(CHAIN_ID_TO_NAME).length).toBeGreaterThanOrEqual(5)
  })
})

describe('isChainSupported', () => {
  it('returns true for supported chain ids', () => {
    expect(isChainSupported(1)).toBe(true)
    expect(isChainSupported(137)).toBe(true)
    expect(isChainSupported(8453)).toBe(true)
    expect(isChainSupported(42161)).toBe(true) // arbitrum
    expect(isChainSupported(10)).toBe(true) // optimism
  })

  it('returns false for unsupported chain ids', () => {
    expect(isChainSupported(56)).toBe(false) // BSC
    expect(isChainSupported(0)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isChainSupported(undefined)).toBe(false)
  })
})
