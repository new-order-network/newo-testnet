import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
require("dotenv").config(); // for pulling .env variables

// add wallet key here
const { PRIVATE_KEY, ALCHEMY_GORLI_KEY } = process.env;

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
      url: "https://eth-goerli.g.alchemy.com/v2/" + ALCHEMY_GORLI_KEY,
      accounts: [PRIVATE_KEY ?? ""],
    },
  },
};

export default config;
