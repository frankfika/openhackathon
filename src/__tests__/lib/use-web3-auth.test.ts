import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
// `fireEvent` is intentionally imported only when needed for tests below.

// Mock wagmi hooks at the module level. The real `useAccount` and
// `useChainId` would require a full WagmiProvider; for unit tests of the
// wrapper logic, we just inject state.
const mockAccount = vi.fn()
const mockChainId = vi.fn()
const mockSignMessageAsync = vi.fn()
vi.mock('wagmi', () => ({
  useAccount: () => mockAccount(),
  useChainId: () => mockChainId(),
  useSignMessage: () => ({ signMessageAsync: mockSignMessageAsync }),
}))

// Mock the api layer
const mockGetWeb3Nonce = vi.fn()
const mockVerifyWeb3 = vi.fn()
vi.mock('@/lib/api', () => ({
  api: {
    getWeb3Nonce: (...args: unknown[]) => mockGetWeb3Nonce(...args),
    verifyWeb3: (...args: unknown[]) => mockVerifyWeb3(...args),
  },
}))

import { useWeb3Auth } from '@/lib/use-web3-auth'

describe('useWeb3Auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAccount.mockReturnValue({ address: '0xABC', isConnected: true })
    mockChainId.mockReturnValue(1) // mainnet — supported
    mockSignMessageAsync.mockResolvedValue('0xsignature')
    mockGetWeb3Nonce.mockResolvedValue({
      nonce: 'n',
      message: 'msg',
      address: '0xabc',
    })
    mockVerifyWeb3.mockResolvedValue({ id: '1', email: '', name: '', role: 'admin' })
  })

  it('exposes chainId and isChainSupported for supported networks', async () => {
    const { result } = renderHook(() => useWeb3Auth())
    expect(result.current.chainId).toBe(1)
    expect(result.current.isChainSupported).toBe(true)
    expect(result.current.isConnected).toBe(true)
  })

  it('reports isChainSupported=false for unsupported chains (BSC, zkSync, ...)', () => {
    mockChainId.mockReturnValue(56) // BSC
    const { result } = renderHook(() => useWeb3Auth())
    expect(result.current.isChainSupported).toBe(false)
  })

  it('signIn returns null and sets CHAIN_UNSUPPORTED on unsupported chain', async () => {
    mockChainId.mockReturnValue(56) // BSC
    const { result } = renderHook(() => useWeb3Auth())

    let response: unknown = 'unset'
    await act(async () => {
      response = await result.current.signIn()
    })

    expect(response).toBeNull()
    await waitFor(() => {
      expect(result.current.error?.code).toBe('CHAIN_UNSUPPORTED')
    })
    expect(mockGetWeb3Nonce).not.toHaveBeenCalled()
  })

  it('signIn returns null and sets WALLET_DISCONNECTED when not connected', async () => {
    mockAccount.mockReturnValue({ address: undefined, isConnected: false })
    const { result } = renderHook(() => useWeb3Auth())

    let response: unknown = 'unset'
    await act(async () => {
      response = await result.current.signIn()
    })

    expect(response).toBeNull()
    await waitFor(() => {
      expect(result.current.error?.code).toBe('WALLET_DISCONNECTED')
    })
  })

  it('signIn happy path returns user from verifyWeb3', async () => {
    mockVerifyWeb3.mockResolvedValue({
      id: '1',
      email: 'a@t.com',
      name: 'A',
      role: 'admin',
      token: 'tok',
    })
    const { result } = renderHook(() => useWeb3Auth())

    let response: unknown
    await act(async () => {
      response = await result.current.signIn()
    })

    expect((response as { id: string }).id).toBe('1')
    await waitFor(() => {
      expect(result.current.error).toBeNull()
    })
    expect(mockGetWeb3Nonce).toHaveBeenCalledWith('0xABC', 'ethereum')
    expect(mockVerifyWeb3).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '0xabc', // backend-normalized
        chain: 'ethereum',
        chainId: 1,
        signature: '0xsignature',
      })
    )
  })

  it('signIn surfaces a server-provided error code (NONCE_INVALID)', async () => {
    // Server returns 401 with a code in the body — extractApiErrorMessage
    // should surface that code, and the hook should preserve it.
    const err = {
      response: {
        status: 401,
        data: { error: 'Invalid or expired nonce', code: 'NONCE_INVALID' },
      },
    }
    mockVerifyWeb3.mockRejectedValue(err)

    const { result } = renderHook(() => useWeb3Auth())

    let response: unknown = 'unset'
    await act(async () => {
      response = await result.current.signIn()
    })

    expect(response).toBeNull()
    // The server's "code" field is preserved on the error object so
    // the UI can drive i18n lookup.
    await waitFor(() => {
      expect(result.current.error?.code).toBe('NONCE_INVALID')
    })
  })

  it('signIn falls back to UNKNOWN for unrecognized error codes', async () => {
    const err = {
      response: {
        status: 500,
        data: { error: 'something exploded', code: 'SOMETHING_NEW' },
      },
    }
    mockVerifyWeb3.mockRejectedValue(err)

    const { result } = renderHook(() => useWeb3Auth())

    let response: unknown = 'unset'
    await act(async () => {
      response = await result.current.signIn()
    })

    expect(response).toBeNull()
    await waitFor(() => {
      expect(result.current.error?.code).toBe('UNKNOWN')
    })
  })

  it('signIn does not call signMessageAsync if the user is disconnected at the start', async () => {
    mockAccount.mockReturnValue({ address: undefined, isConnected: false })
    const { result } = renderHook(() => useWeb3Auth())

    await act(async () => {
      await result.current.signIn()
    })

    expect(mockGetWeb3Nonce).not.toHaveBeenCalled()
    expect(mockSignMessageAsync).not.toHaveBeenCalled()
    expect(mockVerifyWeb3).not.toHaveBeenCalled()
  })
})
