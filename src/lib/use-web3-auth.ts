import { useCallback, useState } from 'react'
import { useAccount, useSignMessage, useChainId } from 'wagmi'
import { api } from './api'
import { chainNameFromId } from './wagmi-config'
import { extractApiErrorMessage } from './api-error'
import type { User } from './types'

/**
 * Encapsulates the SIWE-style flow:
 * 1. request nonce from backend
 * 2. sign the message with the connected wallet
 * 3. verify with backend (login) or link to current account
 */
export function useWeb3Auth() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { signMessageAsync } = useSignMessage()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signIn = useCallback(async (): Promise<(User & { token?: string }) | null> => {
    if (!address || !isConnected) {
      setError('Please connect your wallet first')
      return null
    }
    setError(null)
    setIsPending(true)
    try {
      const chain = chainNameFromId(chainId)
      const { nonce, message, address: normalized } = await api.getWeb3Nonce(address, chain)
      const signature = await signMessageAsync({ account: address, message })
      const result = await api.verifyWeb3({
        address: normalized,
        chain,
        chainId,
        signature,
        message,
        nonce,
      })
      return result
    } catch (err) {
      const message = extractApiErrorMessage(err, 'Wallet sign-in failed. Please try again.')
      setError(message)
      return null
    } finally {
      setIsPending(false)
    }
  }, [address, isConnected, chainId, signMessageAsync])

  const linkWallet = useCallback(async (): Promise<User | null> => {
    if (!address || !isConnected) {
      setError('Please connect your wallet first')
      return null
    }
    setError(null)
    setIsPending(true)
    try {
      const chain = chainNameFromId(chainId)
      const { nonce, message, address: normalized } = await api.getWeb3Nonce(address, chain)
      const signature = await signMessageAsync({ account: address, message })
      const result = await api.linkWallet({
        address: normalized,
        chain,
        chainId,
        signature,
        message,
        nonce,
      })
      return result.user
    } catch (err) {
      const message = extractApiErrorMessage(err, 'Failed to link wallet. Please try again.')
      setError(message)
      return null
    } finally {
      setIsPending(false)
    }
  }, [address, isConnected, chainId, signMessageAsync])

  return { signIn, linkWallet, isPending, error, address, isConnected }
}
