import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import * as tdly from "@tenderly/hardhat-tenderly";
import "dotenv/config";

tdly.setup();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 5000,
      },
    },
  },
  networks: {
    goerli: {
      chainId: 5,
      url:
        "https://eth-goerli.g.alchemy.com/v2/" + process.env.ALCHEMY_GORLI_KEY,
      accounts: [process.env.PRIVATE_KEY ?? ""],
    },
    hardhat: {
      // forking: {
      //   url:
      //     "https://eth-mainnet.g.alchemy.com/v2/" +
      //     process.env.ALCHEMY_MAINFORK_KEY,
      //   blockNumber: 16158835,
      // },
      forking: {
        url:
          "https://eth-goerli.g.alchemy.com/v2/" +
          process.env.ALCHEMY_GORLI_KEY,
        blockNumber: 8223572,
      },
    },
    local: {
      url: "http://127.0.0.1:8545",
    },
  },
  tenderly: {
    project: "newoTestnet",
    username: "jamaka",
  },
};

export default config;
