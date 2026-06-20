require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-verify");

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const RPC_URL_SEPOLIA = process.env.RPC_URL_SEPOLIA || "";
const RPC_URL_POLYGON = process.env.RPC_URL_POLYGON || "";
const RPC_URL_BASE = process.env.RPC_URL_BASE || "";
const RPC_URL_BASE_SEPOLIA = process.env.RPC_URL_BASE_SEPOLIA || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || "";

const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./contracts/test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {},
    sepolia: {
      url: RPC_URL_SEPOLIA,
      accounts,
    },
    polygon: {
      url: RPC_URL_POLYGON,
      accounts,
    },
    base: {
      url: RPC_URL_BASE,
      accounts,
    },
    baseSepolia: {
      url: RPC_URL_BASE_SEPOLIA,
      accounts,
    },
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
      polygon: POLYGONSCAN_API_KEY,
      base: BASESCAN_API_KEY,
      baseSepolia: BASESCAN_API_KEY,
    },
  },
};
