import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, prisma } from '../server';
import { createUser } from './factories';

// Valid checksum EVM address — used throughout the suite
const EVM_A = '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359';
const EVM_B = '0x1111111111111111111111111111111111111111';

// AUTH_DISABLED test mode: middleware reads the user identity from these headers.
function testAuthHeaders(userId: string, role: 'admin' | 'judge' = 'judge') {
  return {
    'x-test-user-id': userId,
    'x-test-role': role,
    'x-test-email': `${userId}@example.com`,
    'x-test-name': `Test ${role}`,
  };
}

describe('DELETE /api/auth/wallets', () => {
  it('returns 404 when no wallet exists for the default test user', async () => {
    // AUTH_DISABLED mode auto-populates x-test-user-id; no token required.
    const res = await request(app).delete(`/api/auth/wallets?address=${EVM_A}&chain=ethereum`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Wallet is not linked to this account');
  });

  it('returns 400 when address or chain is missing', async () => {
    const user = await createUser(prisma, { role: 'judge' });
    const headers = testAuthHeaders(user.id);

    const res1 = await request(app)
      .delete('/api/auth/wallets')
      .set(headers)
      .send({ address: EVM_A });
    expect(res1.status).toBe(400);

    const res2 = await request(app)
      .delete('/api/auth/wallets')
      .set(headers)
      .send({ chain: 'ethereum' });
    expect(res2.status).toBe(400);
  });

  it('returns 400 for an unsupported chain', async () => {
    const user = await createUser(prisma, { role: 'judge' });
    const res = await request(app)
      .delete(`/api/auth/wallets?address=${EVM_A}&chain=not-a-chain`)
      .set(testAuthHeaders(user.id));
    expect(res.status).toBe(400);
  });

  it('returns 404 when the wallet is not linked to the user', async () => {
    const user = await createUser(prisma, { role: 'judge' });
    const res = await request(app)
      .delete(`/api/auth/wallets?address=${EVM_A}&chain=ethereum`)
      .set(testAuthHeaders(user.id));
    expect(res.status).toBe(404);
  });

  it('removes a linked wallet and returns remainingWallets', async () => {
    const user = await createUser(prisma, { role: 'judge' });
    await prisma.walletAddress.create({
      data: { address: EVM_A, chain: 'ethereum', userId: user.id, isPrimary: true },
    });
    await prisma.walletAddress.create({
      data: { address: EVM_B, chain: 'base', userId: user.id, isPrimary: false },
    });

    const res = await request(app)
      .delete(`/api/auth/wallets?address=${EVM_A}&chain=ethereum`)
      .set(testAuthHeaders(user.id));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.remainingWallets).toBe(1);

    const after = await prisma.walletAddress.findMany({ where: { userId: user.id } });
    expect(after.length).toBe(1);
    expect(after[0]?.address).toBe(EVM_B);
  });

  it('promotes another wallet to primary when removing the primary', async () => {
    const user = await createUser(prisma, { role: 'judge' });
    await prisma.walletAddress.create({
      data: { address: EVM_A, chain: 'ethereum', userId: user.id, isPrimary: true },
    });
    await prisma.walletAddress.create({
      data: { address: EVM_B, chain: 'base', userId: user.id, isPrimary: false },
    });

    await request(app)
      .delete(`/api/auth/wallets?address=${EVM_A}&chain=ethereum`)
      .set(testAuthHeaders(user.id))
      .expect(200);

    const promoted = await prisma.walletAddress.findFirst({
      where: { userId: user.id, isPrimary: true },
    });
    expect(promoted?.address).toBe(EVM_B);
  });

  it('clears isWeb3User when removing the last wallet', async () => {
    const user = await createUser(prisma, { role: 'judge', isWeb3User: true });
    await prisma.walletAddress.create({
      data: { address: EVM_A, chain: 'ethereum', userId: user.id, isPrimary: true },
    });

    await request(app)
      .delete(`/api/auth/wallets?address=${EVM_A}&chain=ethereum`)
      .set(testAuthHeaders(user.id))
      .expect(200);

    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh?.isWeb3User).toBe(false);
  });

  it('blocks removing a wallet owned by another user', async () => {
    const owner = await createUser(prisma, { role: 'judge' });
    const stranger = await createUser(prisma, { role: 'judge' });
    await prisma.walletAddress.create({
      data: { address: EVM_A, chain: 'ethereum', userId: owner.id, isPrimary: true },
    });

    const res = await request(app)
      .delete(`/api/auth/wallets?address=${EVM_A}&chain=ethereum`)
      .set(testAuthHeaders(stranger.id));

    expect(res.status).toBe(404);

    const stillThere = await prisma.walletAddress.findUnique({
      where: { address_chain: { address: EVM_A, chain: 'ethereum' } },
    });
    expect(stillThere?.userId).toBe(owner.id);
  });
});
