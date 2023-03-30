import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const config: HardhatUserConfig | any = {
  solidity: "0.8.18",
  networks: {
    net1: {
      url: "http://127.0.0.1:8541/"
    },
    net2: {
      url: "http://127.0.0.1:8542/"
    },
    mumbai: {
      url: process.env.MUMBAI_TESNET_URL,
      accounts: [
        process.env.ADMIN_ACCOUNT_PRIVATE_KEY || "",
        process.env.ADMIN_ACCOUNT_PRIVATE_KEY2 || "",
      ],
      timeout: 0,
    },
    goerli: {
      url: process.env.GOERLI_TESNET_URL,
      accounts: [
        process.env.ADMIN_ACCOUNT_PRIVATE_KEY || "",
        process.env.ADMIN_ACCOUNT_PRIVATE_KEY2 || "",
      ],
      timeout: 0,
    },
  },
  etherscan: {
    apiKey: {
      polygonMumbai: process.env.POLYGONSCAN_API_KEY || "",
      goerli: process.env.ETHERSCAN_API_KEY || "",
    },
  },
};

export default config;
