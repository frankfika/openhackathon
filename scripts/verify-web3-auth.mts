// Integration test for Web3 auth flow using viem to generate a real signature.
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import {
  buildSignInMessage,
  normalizeWalletAddress,
  verifyWalletSignature,
  generateNonce,
  consumeNonce,
} from '../api/utils/siwe';

async function main() {
  console.log('Running Web3 SIWE flow verification...\n');

  // Generate a test EVM account
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  const chain = 'ethereum';

  // Normalize address
  const normalized = normalizeWalletAddress(account.address, chain);
  if (!normalized) throw new Error('Address normalization failed');
  console.log('✓ Address normalized:', normalized);

  // Generate nonce + message
  const nonce = generateNonce(normalized);
  const message = buildSignInMessage({ address: normalized, chain, nonce });
  console.log('✓ Nonce generated:', nonce);

  // Sign the message
  const signature = await account.signMessage({ message });
  console.log('✓ Message signed');

  // Verify signature
  const valid = await verifyWalletSignature({ address: normalized, chain, message, signature });
  if (!valid) throw new Error('Signature verification failed');
  console.log('✓ Signature verified');

  // Verify wrong signature fails
  const tamperedValid = await verifyWalletSignature({
    address: normalized,
    chain,
    message: message + 'tampered',
    signature,
  });
  if (tamperedValid) throw new Error('Tampered message should not verify');
  console.log('✓ Tampered message rejected');

  // Consume nonce (single-use)
  if (!consumeNonce(normalized, nonce)) throw new Error('Nonce consume failed');
  console.log('✓ Nonce consumed');

  // Re-consume should fail
  if (consumeNonce(normalized, nonce)) throw new Error('Nonce should be single-use');
  console.log('✓ Nonce is single-use');

  // Invalid address rejected
  if (normalizeWalletAddress('0xnotanaddress', 'ethereum') !== null) {
    throw new Error('Invalid address should be rejected');
  }
  console.log('✓ Invalid address rejected');

  console.log('\n✅ All Web3 SIWE flow tests passed!');
}

main().catch((error) => {
  console.error('\n❌ Test failed:', error);
  process.exitCode = 1;
});
