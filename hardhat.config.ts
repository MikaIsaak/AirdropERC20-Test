import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    hardhat: {
      forking: {
        url: "https://testnet-rpc.lumia.org",
      },
      chainId: 1952959480,
    },
    lumiaTestnet: {
      url: "https://testnet-rpc.lumia.org",
      chainId: 1952959480,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      lumiaTestnet: process.env.ETHERSCAN_API_KEY || "any-key",
    },
    customChains: [
      {
        network: "lumiaTestnet",
        chainId: 1952959480,
        urls: {
          apiURL: "https://testnet-explorer.lumia.org/api",
          browserURL: "https://testnet-explorer.lumia.org",
        },
      },
    ],
  },
};

export default config;
