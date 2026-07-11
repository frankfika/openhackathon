import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccount, useSignMessage, useChainId } from 'wagmi'
import { api } from './api'
import { chainNameFromId, isChainSupported } from './wagmi-config'
import { extractApiErrorMessage } from './api-error'
import type { User } from './types'

export type Web3ErrorCode =
  | 'CHAIN_UNSUPPORTED'
  | 'WALLET_DISCONNECTED'
  | 'NONCE_INVALID'
  | 'NONCE_MISMATCH'
  | 'SIGNATURE_INVALID'
  | 'SIGNATURE_REJECTED'
  | 'NETWORK_MISMATCH'

export type Web3Error = {
  code: Web3ErrorCode | 'UNKNOWN'
  message: string
}

const KNOWN_WEB3_CODES: ReadonlyArray<Web3ErrorCode> = [
  'CHAIN_UNSUPPORTED',
  'WALLET_DISCONNECTED',
  'NONCE_INVALID',
  'NONCE_MISMATCH',
  'SIGNATURE_INVALID',
  'SIGNATURE_REJECTED',
  'NETWORK_MISMATCH',
]

function classifyError(err: unknown, fallback: Web3ErrorCode): Web3Error {
  const codeOrFallback = extractApiErrorMessage(err, fallback) as string
  const code = (KNOWN_WEB3_CODES as ReadonlyArray<string>).includes(codeOrFallback)
    ? (codeOrFallback as Web3ErrorCode)
    : 'UNKNOWN'
  return { code, message: codeOrFallback }
}

/**
 * Encapsulates the SIWE-style flow:
 * 1. request nonce from backend
 * 2. sign the message with the connected wallet
 * 3. verify with backend (login) or link to current account
 *
 * Error model: a single `error` object on the hook (not a string) so the
 * UI can decide whether to show a translated message, a chain warning,
 * or a "reconnect" prompt. The error type carries a code, not a message,
 * so callers always go through i18n.
 */
export function useWeb3Auth() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { signMessageAsync } = useSignMessage()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<Web3Error | null>(null)

  // Mirror the latest connection state into a ref so async callbacks can
  // re-read the *current* state (not the snapshot from when the callback
  // was created). This is the only way to detect a wallet disconnect
  // that happened between renders — React would otherwise re-create
  // the useCallback, but the in-flight call still has the stale closure.
  const stateRef = useRef({ address, isConnected, chainId })
  useEffect(() => {
    stateRef.current = { address, isConnected, chainId }
  }, [address, isConnected, chainId])

  const chainSupported = isChainSupported(chainId)
  const backendChain = chainNameFromId(chainId)

  const signIn = useCallback(async (): Promise<(User & { token?: string }) | null> => {
    // Always read the latest state from the ref, not the closure.
    const current = stateRef.current
    setError(null)
    if (!current.address || !current.isConnected) {
      setError({ code: 'WALLET_DISCONNECTED', message: 'WALLET_DISCONNECTED' })
      return null
    }
    if (!isChainSupported(current.chainId)) {
      setError({ code: 'CHAIN_UNSUPPORTED', message: 'CHAIN_UNSUPPORTED' })
      return null
    }
    const chain = chainNameFromId(current.chainId)
    if (!chain) {
      setError({ code: 'CHAIN_UNSUPPORTED', message: 'CHAIN_UNSUPPORTED' })
      return null
    }

    setIsPending(true)
    const signedAddress = current.address
    const signedChainId = current.chainId
    try {
      const { nonce, message, address: normalized } = await api.getWeb3Nonce(signedAddress, chain)
      // Re-check the latest state in case the wallet was disconnected
      // or switched chains during the nonce round-trip.
      const after = stateRef.current
      if (!after.isConnected || !after.address || after.address !== signedAddress) {
        setError({ code: 'WALLET_DISCONNECTED', message: 'WALLET_DISCONNECTED' })
        return null
      }
      if (after.chainId !== signedChainId) {
        setError({ code: 'NETWORK_MISMATCH', message: 'NETWORK_MISMATCH' })
        return null
      }
      const signature = await signMessageAsync({ account: signedAddress, message })
      const result = await api.verifyWeb3({
        address: normalized,
        chain,
        chainId: signedChainId,
        signature,
        message,
        nonce,
      })
      return result
    } catch (err) {
      setError(classifyError(err, 'SIGNATURE_REJECTED'))
      return null
    } finally {
      setIsPending(false)
    }
  }, [signMessageAsync])

  const linkWallet = useCallback(async (): Promise<User | null> => {
    const current = stateRef.current
    setError(null)
    if (!current.address || !current.isConnected) {
      setError({ code: 'WALLET_DISCONNECTED', message: 'WALLET_DISCONNECTED' })
      return null
    }
    if (!isChainSupported(current.chainId)) {
      setError({ code: 'CHAIN_UNSUPPORTED', message: 'CHAIN_UNSUPPORTED' })
      return null
    }
    const chain = chainNameFromId(current.chainId)
    if (!chain) {
      setError({ code: 'CHAIN_UNSUPPORTED', message: 'CHAIN_UNSUPPORTED' })
      return null
    }

    setIsPending(true)
    const signedAddress = current.address
    const signedChainId = current.chainId
    try {
      const { nonce, message, address: normalized } = await api.getWeb3Nonce(signedAddress, chain)
      const after = stateRef.current
      if (!after.isConnected || !after.address || after.address !== signedAddress) {
        setError({ code: 'WALLET_DISCONNECTED', message: 'WALLET_DISCONNECTED' })
        return null
      }
      if (after.chainId !== signedChainId) {
        setError({ code: 'NETWORK_MISMATCH', message: 'NETWORK_MISMATCH' })
        return null
      }
      const signature = await signMessageAsync({ account: signedAddress, message })
      const result = await api.linkWallet({
        address: normalized,
        chain,
        chainId: signedChainId,
        signature,
        message,
        nonce,
      })
      return result.user
    } catch (err) {
      setError(classifyError(err, 'SIGNATURE_REJECTED'))
      return null
    } finally {
      setIsPending(false)
    }
  }, [signMessageAsync])

  return {
    signIn,
    linkWallet,
    isPending,
    error,
    address,
    isConnected,
    chainId,
    isChainSupported: chainSupported,
  }
}
