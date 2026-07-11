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
} from '../services/identity';
import { logActivity } from '../utils/activity';
import { USER_PUBLIC_FIELDS, sanitizeUser } from '../utils/sanitize';
import { asUserRole } from '../utils/validation';

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

      const nonce = await generateNonce(prisma, normalized, chain, 'siwe');
      const message = buildSignInMessage({
        address: normalized,
        chain,
        nonce,
        domain: req.headers.host,
      });

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

      // Verify the signature FIRST so that a bad signature does not burn
      // the nonce (P1-2 in synth-design-spec §2.3). Nonce is consumed only
      // after signature + domain + chain checks all pass.
      const valid = await verifyWalletSignature({ address: normalized, chain, message, signature });
      if (!valid) {
        return res.status(401).json({ error: 'Invalid signature', code: 'SIGNATURE_INVALID' });
      }

      // Ensure the signed message contains the nonce (defense in depth)
      if (!message.includes(nonce)) {
        return res.status(401).json({ error: 'Nonce mismatch in signed message', code: 'NONCE_MISMATCH' });
      }

      // Validate nonce (single-use, DB-backed)
      const consumed = await consumeNonce(prisma, normalized, chain, 'siwe', nonce);
      if (!consumed) {
        return res.status(401).json({ error: 'Invalid or expired nonce', code: 'NONCE_INVALID' });
      }

      const chainId = typeof chainIdRaw === 'number' ? chainIdRaw : undefined;
      const user = await getOrCreateUserFromWallet(prisma, { address: normalized, chain, chainId });

      const userRole = asUserRole(user.role);
      if (!userRole) {
        return res.status(401).json({ error: 'Invalid user role', code: 'ROLE_INVALID' });
      }
      const authUser: AuthUser = {
        id: user.id,
        role: userRole,
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

      const publicUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        isWeb3User: user.isWeb3User,
      };
      res.json({ ...publicUser, token });
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

      // Verify signature first (P1-2: do not burn nonce on bad signature).
      const valid = await verifyWalletSignature({ address: normalized, chain, message, signature });
      if (!valid) {
        return res.status(401).json({ error: 'Invalid signature', code: 'SIGNATURE_INVALID' });
      }

      if (!message.includes(nonce)) {
        return res.status(401).json({ error: 'Nonce mismatch in signed message', code: 'NONCE_MISMATCH' });
      }

      const consumed = await consumeNonce(prisma, normalized, chain, 'link-wallet', nonce);
      if (!consumed) {
        return res.status(401).json({ error: 'Invalid or expired nonce', code: 'NONCE_INVALID' });
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

      const linkedUser = result.user;
      const publicLinkedUser = linkedUser
        ? {
            id: linkedUser.id,
            email: linkedUser.email,
            name: linkedUser.name,
            role: linkedUser.role,
            avatarUrl: linkedUser.avatarUrl,
            createdAt: linkedUser.createdAt,
            isWeb3User: linkedUser.isWeb3User,
          }
        : null;
      res.json({ success: true, user: publicLinkedUser ? sanitizeUser(publicLinkedUser) : null });
    } catch (error) {
      console.error('Link wallet error:', error);
      res.status(500).json({ error: 'Failed to link wallet' });
    }
  });
}
