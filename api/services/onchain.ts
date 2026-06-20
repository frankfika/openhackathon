import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  type Chain,
  type Abi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, polygon, base, arbitrum, optimism, sepolia, baseSepolia } from 'viem/chains';
import type { PrismaClient } from '@prisma/client';
import {
  ENABLE_ONCHAIN_STORAGE,
  REGISTRY_CONTRACT_ADDRESS,
  ONCHAIN_PRIVATE_KEY,
  ONCHAIN_CHAIN,
  RPC_URL_ETHEREUM,
  RPC_URL_POLYGON,
  RPC_URL_BASE,
  RPC_URL_ARBITRUM,
  RPC_URL_OPTIMISM,
} from '../config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Lazily load the ABI so the module imports cleanly even if the file is missing.
let registryAbi: Abi | null = null;
function getAbi(): Abi {
  if (!registryAbi) {
    const abiPath = path.resolve(__dirname, '..', 'contracts', 'HackathonRegistry.abi.json');
    registryAbi = JSON.parse(readFileSync(abiPath, 'utf8')) as Abi;
  }
  return registryAbi;
}

const CHAIN_MAP: Record<string, { chain: Chain; rpcUrl?: string }> = {
  ethereum: { chain: mainnet, rpcUrl: RPC_URL_ETHEREUM },
  polygon: { chain: polygon, rpcUrl: RPC_URL_POLYGON },
  base: { chain: base, rpcUrl: RPC_URL_BASE },
  arbitrum: { chain: arbitrum, rpcUrl: RPC_URL_ARBITRUM },
  optimism: { chain: optimism, rpcUrl: RPC_URL_OPTIMISM },
  sepolia: { chain: sepolia, rpcUrl: RPC_URL_ETHEREUM },
  'base-sepolia': { chain: baseSepolia, rpcUrl: RPC_URL_BASE },
};

/** Whether on-chain attestation is fully configured and enabled. */
export function isOnChainEnabled(): boolean {
  return Boolean(ENABLE_ONCHAIN_STORAGE && REGISTRY_CONTRACT_ADDRESS && ONCHAIN_PRIVATE_KEY);
}

function getClients() {
  const config = CHAIN_MAP[ONCHAIN_CHAIN.toLowerCase()];
  if (!config) {
    throw new Error(`Unsupported ONCHAIN_CHAIN: ${ONCHAIN_CHAIN}`);
  }
  const transport = http(config.rpcUrl);
  const account = privateKeyToAccount(ONCHAIN_PRIVATE_KEY as `0x${string}`);
  const publicClient = createPublicClient({ chain: config.chain, transport });
  const walletClient = createWalletClient({ account, chain: config.chain, transport });
  return { publicClient, walletClient, account };
}

/** Hash a hackathon identifier into a bytes32 for on-chain storage. */
export function hashHackathonId(hackathonId: string): `0x${string}` {
  return keccak256(toHex(hackathonId));
}

/**
 * Record an achievement on-chain for a user's primary EVM wallet.
 * Updates the matching CrossHackathonActivity rows with the tx hash + status.
 * Returns the transaction hash, or null if skipped (disabled, no EVM wallet, etc.).
 */
export async function recordAchievementOnChain(
  prisma: PrismaClient,
  params: {
    userId: string;
    hackathonId: string;
    activityType: string;
    points: number;
    metadataURI?: string;
  },
): Promise<`0x${string}` | null> {
  if (!isOnChainEnabled()) {
    return null;
  }

  const { userId, hackathonId, activityType, points, metadataURI = '' } = params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wallets: true },
  });
  if (!user) return null;

  // Use the primary wallet if it's EVM; otherwise the first EVM wallet.
  const evmWallets = user.wallets.filter((w) => w.address.startsWith('0x'));
  const wallet = evmWallets.find((w) => w.isPrimary) ?? evmWallets[0];
  if (!wallet) return null;

  try {
    const { publicClient, walletClient } = getClients();

    const hash = await walletClient.writeContract({
      address: REGISTRY_CONTRACT_ADDRESS as `0x${string}`,
      abi: getAbi(),
      functionName: 'recordAchievement',
      args: [
        wallet.address as `0x${string}`,
        hashHackathonId(hackathonId),
        activityType,
        BigInt(points),
        metadataURI,
      ],
      // viem can't statically infer the function from a runtime-loaded ABI.
    } as unknown as Parameters<typeof walletClient.writeContract>[0]);

    // Mark as pending in DB immediately.
    await prisma.crossHackathonActivity.updateMany({
      where: { userId, hackathonId, activityType },
      data: { onChainTxHash: hash, onChainStatus: 'pending' },
    });

    // Confirm asynchronously without blocking the caller.
    publicClient
      .waitForTransactionReceipt({ hash })
      .then(async (receipt) => {
        await prisma.crossHackathonActivity.updateMany({
          where: { userId, hackathonId, activityType },
          data: { onChainStatus: receipt.status === 'success' ? 'confirmed' : 'failed' },
        });
      })
      .catch(async (error) => {
        console.error('On-chain confirmation error:', error);
        await prisma.crossHackathonActivity.updateMany({
          where: { userId, hackathonId, activityType },
          data: { onChainStatus: 'failed' },
        });
      });

    return hash;
  } catch (error) {
    console.error('Failed to record achievement on-chain:', error);
    return null;
  }
}
