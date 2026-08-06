import type { Express, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { asString, ENABLE_WEB3_LOGIN, SUPPORTED_CHAINS } from '../config';
import type { AuthUser, UserRole } from '../types';
import { signTokenForUser } from '../utils/crypto';
import {
  generateNonce,
  consumeNonce,
  buildSignInMessage,
  normalizeWalletAddress,
  verifyWalletSignature,
} from '../utils/siwe';
import {
  getOrCreateUserFromWallet,
  linkWalletToUser,
  unlinkWalletFromUser,
} from '../services/identity';
import { logActivity } from '../utils/activity';
import { logger } from '../logger';

function sanitizeUser(user: { password?: string | null }) {
  const copy = { ...user };
  delete (copy as { password?: string | null }).password;
  return copy;
}

export function registerWeb3AuthRoutes(
  app: Express,
  prisma: PrismaClient,
  { authRateLimiter, requireAuth }: { authRateLimiter: RequestHandler; requireAuth: RequestHandler },
) {
  // Rate-limit the auth endpoints
  app.use('/api/auth/web3/nonce', authRateLimiter);
  app.use('/api/auth/web3/verify', authRateLimiter);

  // 1. Request a nonce to sign
  app.post('/api/auth/web3/nonce', async (req, res) => {
    if (!ENABLE_WEB3_LOGIN) {
      return res.status(403).json({ error: 'Web3 login is disabled' });
    }
    try {
      const address = asString(req.body?.address);
      const chain = asString(req.body?.chain)?.toLowerCase();
      if (!address || !chain) {
        return res.status(400).json({ error: 'address and chain are required' });
      }
      if (!SUPPORTED_CHAINS.includes(chain)) {
        return res.status(400).json({ error: `Unsupported chain: ${chain}` });
      }

      const normalized = normalizeWalletAddress(address, chain);
      if (!normalized) {
        return res.status(400).json({ error: 'Invalid wallet address' });
      }

      const nonce = generateNonce(normalized);
      const message = buildSignInMessage({ address: normalized, chain, nonce });

      res.json({ nonce, message, address: normalized });
    } catch (error) {
      console.error('Web3 nonce error:', error);
      res.status(500).json({ error: 'Failed to generate nonce' });
    }
  });

  // 2. Verify signature and log in (creates user if new)
  app.post('/api/auth/web3/verify', async (req, res) => {
    if (!ENABLE_WEB3_LOGIN) {
      return res.status(403).json({ error: 'Web3 login is disabled' });
    }
    try {
      const address = asString(req.body?.address);
      const chain = asString(req.body?.chain)?.toLowerCase();
      const chainIdRaw = req.body?.chainId;
      const signature = asString(req.body?.signature);
      const message = asString(req.body?.message);
      const nonce = asString(req.body?.nonce);

      if (!address || !chain || !signature || !message || !nonce) {
        return res.status(400).json({ error: 'address, chain, signature, message, and nonce are required' });
      }
      if (!SUPPORTED_CHAINS.includes(chain)) {
        return res.status(400).json({ error: `Unsupported chain: ${chain}` });
      }

      const normalized = normalizeWalletAddress(address, chain);
      if (!normalized) {
        return res.status(400).json({ error: 'Invalid wallet address' });
      }

      // Validate nonce (single-use)
      if (!consumeNonce(normalized, nonce)) {
        return res.status(401).json({ error: 'Invalid or expired nonce' });
      }

      // Ensure the signed message contains the nonce (defense in depth)
      if (!message.includes(nonce)) {
        return res.status(401).json({ error: 'Nonce mismatch in signed message' });
      }

      // Verify the signature
      const valid = await verifyWalletSignature({ address: normalized, chain, message, signature });
      if (!valid) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const chainId = typeof chainIdRaw === 'number' ? chainIdRaw : undefined;
      const user = await getOrCreateUserFromWallet(prisma, { address: normalized, chain, chainId });

      const authUser: AuthUser = {
        id: user.id,
        role: (user.role === 'admin' ? 'admin' : 'judge') as UserRole,
        email: user.email,
        name: user.name,
      };
      const token = signTokenForUser(authUser);

      await logActivity(prisma, {
        actorId: user.id,
        actorRole: authUser.role,
        actorName: user.name,
        action: 'web3_login',
        entityType: 'user',
        entityId: user.id,
        metadata: { address: normalized, chain },
        ipAddress: req.ip,
      });

      res.json({ ...sanitizeUser(user), token });
    } catch (error) {
      console.error('Web3 verify error:', error);
      res.status(500).json({ error: 'Web3 verification failed' });
    }
  });

  // 3. Link a wallet to the currently authenticated account
  app.post('/api/auth/link-wallet', requireAuth, async (req, res) => {
    if (!ENABLE_WEB3_LOGIN) {
      return res.status(403).json({ error: 'Web3 login is disabled' });
    }
    try {
      const userId = req.authUser!.id;
      const address = asString(req.body?.address);
      const chain = asString(req.body?.chain)?.toLowerCase();
      const chainIdRaw = req.body?.chainId;
      const signature = asString(req.body?.signature);
      const message = asString(req.body?.message);
      const nonce = asString(req.body?.nonce);

      if (!address || !chain || !signature || !message || !nonce) {
        return res.status(400).json({ error: 'address, chain, signature, message, and nonce are required' });
      }
      if (!SUPPORTED_CHAINS.includes(chain)) {
        return res.status(400).json({ error: `Unsupported chain: ${chain}` });
      }

      const normalized = normalizeWalletAddress(address, chain);
      if (!normalized) {
        return res.status(400).json({ error: 'Invalid wallet address' });
      }

      if (!consumeNonce(normalized, nonce)) {
        return res.status(401).json({ error: 'Invalid or expired nonce' });
      }
      if (!message.includes(nonce)) {
        return res.status(401).json({ error: 'Nonce mismatch in signed message' });
      }

      const valid = await verifyWalletSignature({ address: normalized, chain, message, signature });
      if (!valid) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const chainId = typeof chainIdRaw === 'number' ? chainIdRaw : undefined;
      const result = await linkWalletToUser(prisma, { userId, address: normalized, chain, chainId });

      if (result.error === 'wallet_taken') {
        return res.status(409).json({ error: 'This wallet is already linked to another account' });
      }

      await logActivity(prisma, {
        actorId: userId,
        actorRole: req.authUser!.role,
        actorName: req.authUser!.name,
        action: 'link_wallet',
        entityType: 'user',
        entityId: userId,
        metadata: { address: normalized, chain },
        ipAddress: req.ip,
      });

      res.json({ success: true, user: sanitizeUser(result.user!) });
    } catch (error) {
      console.error('Link wallet error:', error);
      res.status(500).json({ error: 'Failed to link wallet' });
    }
  });

  // 4. Unlink a wallet from the currently authenticated account
  app.delete('/api/auth/wallets', requireAuth, async (req, res) => {
    if (!ENABLE_WEB3_LOGIN) {
      return res.status(403).json({ error: 'Web3 login is disabled' });
    }
    try {
      const userId = req.authUser!.id;
      const address = asString(req.query?.address ?? req.body?.address);
      const chain = asString(req.query?.chain ?? req.body?.chain)?.toLowerCase();

      if (!address || !chain) {
        return res.status(400).json({ error: 'address and chain are required' });
      }
      if (!SUPPORTED_CHAINS.includes(chain)) {
        return res.status(400).json({ error: `Unsupported chain: ${chain}` });
      }

      const normalized = normalizeWalletAddress(address, chain);
      if (!normalized) {
        return res.status(400).json({ error: 'Invalid wallet address' });
      }

      const result = await unlinkWalletFromUser(prisma, {
        userId,
        address: normalized,
        chain,
      });

      if (!result.success) {
        return res.status(404).json({ error: 'Wallet is not linked to this account' });
      }

      await logActivity(prisma, {
        actorId: userId,
        actorRole: req.authUser!.role,
        actorName: req.authUser!.name,
        action: 'unlink_wallet',
        entityType: 'user',
        entityId: userId,
        metadata: { address: normalized, chain },
        ipAddress: req.ip,
      });

      res.json({ success: true, remainingWallets: result.remainingWallets });
    } catch (error) {
      logger.error('Unlink wallet error', { err: error });
      res.status(500).json({ error: 'Failed to unlink wallet' });
    }
  });
}
