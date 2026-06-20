// Live HTTP end-to-end test of the Web3 auth endpoints.
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

const BASE = 'http://localhost:3939';

async function main() {
  console.log('Running live Web3 HTTP flow test...\n');

  const account = privateKeyToAccount(generatePrivateKey());
  const chain = 'ethereum';

  // 1. Request nonce
  const nonceRes = await fetch(`${BASE}/api/auth/web3/nonce`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: account.address, chain }),
  });
  if (!nonceRes.ok) throw new Error(`nonce failed: ${nonceRes.status} ${await nonceRes.text()}`);
  const { nonce, message, address } = await nonceRes.json();
  console.log('✓ Nonce endpoint returned nonce + message');

  // 2. Sign and verify
  const signature = await account.signMessage({ message });
  const verifyRes = await fetch(`${BASE}/api/auth/web3/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address, chain, chainId: 1, signature, message, nonce }),
  });
  if (!verifyRes.ok) throw new Error(`verify failed: ${verifyRes.status} ${await verifyRes.text()}`);
  const user = await verifyRes.json();
  if (!user.token || !user.id) throw new Error('verify did not return token/user');
  console.log('✓ Verify endpoint logged in, returned JWT token');
  console.log('  - user.name:', user.name);
  console.log('  - isWeb3User:', user.isWeb3User);

  // 3. Replay attack: reuse the same nonce should fail
  const replayRes = await fetch(`${BASE}/api/auth/web3/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address, chain, chainId: 1, signature, message, nonce }),
  });
  if (replayRes.ok) throw new Error('replay attack should have failed');
  console.log('✓ Nonce replay rejected (status', replayRes.status + ')');

  // 4. Identity lookup
  const idRes = await fetch(`${BASE}/api/identity/${address}?chain=${chain}`);
  if (!idRes.ok) throw new Error(`identity failed: ${idRes.status}`);
  const identity = await idRes.json();
  if (identity.user.id !== user.id) throw new Error('identity mismatch');
  console.log('✓ Identity lookup resolves wallet -> user');

  // 5. Global leaderboard includes the new Web3 user
  const lbRes = await fetch(`${BASE}/api/leaderboard/global-web3`);
  if (!lbRes.ok) throw new Error(`leaderboard failed: ${lbRes.status}`);
  const lb = await lbRes.json();
  const found = lb.leaderboard.some((e: { userId: string }) => e.userId === user.id);
  if (!found) throw new Error('user not in global leaderboard');
  console.log('✓ Global leaderboard includes the Web3 user');

  console.log('\n✅ All live Web3 HTTP flow tests passed!');
  console.log('\n(cleanup) created test user id:', user.id);
}

main().catch((error) => {
  console.error('\n❌ Test failed:', error);
  process.exitCode = 1;
});
