require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Only use PRIVATE_KEY if it is a real 32-byte key — a placeholder from .env.example
// would otherwise make every hardhat command (even `hardhat node`) fail with HH8.
const rawKey = (process.env.PRIVATE_KEY || "").trim();
const validKey = /^(0x)?[0-9a-fA-F]{64}$/.test(rawKey);
const accounts = validKey ? [rawKey.startsWith("0x") ? rawKey : "0x" + rawKey] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {},
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts,
    },
    amoy: {
      url: process.env.AMOY_RPC_URL || "",
      accounts,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
};