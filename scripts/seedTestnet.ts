import { ethers } from "hardhat";
import {
  getPoolData,
  provider,
  handleCSV,
  amountWallets,
  amountVeNewoWallets,
  veNewoSeed,
  doUsdcSwap,
  doNewoSwap,
  provideLiquidity,
  poolAddress,
  seedWallet,
  createPool,
} from "./helpers";

require("dotenv").config(); // for pulling .env variables

// *** seed testnet liqPool with multiple liqProviders, swaps, and lockup tokens for boost
async function main() {
  console.log(
    "------------------------------------------------------------------"
  );
  console.log("Seeding UniV3 Goerli Pool");
  console.log(
    "------------------------------------------------------------------"
  );

  // *** connect deployer, NEWO and USDC contracts
  const [deployer] = await ethers.getSigners();

  // *** get deployer eth balance
  console.log(
    "Starting deployer ETH Balance: ",
    ethers.utils.formatEther(await deployer.getBalance())
  );
  console.log("--------------------------------------------------------");
  // *** deploy NEWO, USDC and veNEWO
  const newo = await (
    await ethers.getContractFactory("NEWO")
  ).deploy("Newo", "Newo", "800000000");
  const usdc = await (await ethers.getContractFactory("USDC")).deploy();
  console.log("NEWO address: ", newo.address);
  console.log("USDC address: ", usdc.address);
  console.log("-----");
  const veNewo = await (
    await ethers.getContractFactory("VeNewO")
  ).deploy(
    deployer.address, // owner
    newo.address, // staking token
    "604800", // gracePeriod
    "7776000", // minLockTime
    "94608000", // maxLockTime
    1, // penaltyPerc
    10, // maxPenalty
    0, // minPenalty
    864000 // epoch
  );

  // *** create liquidity pool if none exists yet
  let poolData: any;
  if (!poolAddress) {
    const newPool = await createPool(deployer, newo, usdc);
    console.log("NEWO/USDC Pool created at: ", newPool.address);
    console.log("-----");

    // get pool data with newPool address
    poolData = await getPoolData(newPool.address);
  } else {
    // get pool data
    poolData = await getPoolData();
  }

  // *** per new wallet
  for (let i = 0; i < amountWallets; i++) {
    const newWallet = ethers.Wallet.createRandom().connect(provider); // creates a new wallet
    console.log("New Wallet ", i + 1, " created: ", newWallet.address);
    console.log("----------");

    // *** add wallet to CSV
    await handleCSV(newWallet);

    // *** seed wallet
    await seedWallet(newWallet, deployer, newo, usdc);

    await provideLiquidity(newWallet, newo, usdc, poolData);

    // *** execute USDC -> NEWO swap
    await doUsdcSwap(newWallet, poolData.fee, newo, usdc);

    // *** get new pool data
    poolData = await getPoolData();

    // *** execute NEWO -> USDC swap
    await doNewoSwap(newWallet, poolData.fee, newo, usdc);

    // *** lockup newo -> veNewO in a few wallets to simulate reward multiplier
    if (i < amountVeNewoWallets) {
      await veNewoSeed(newWallet, newo, veNewo);
    }
    console.log("--------------------------------------------------------");
  }

  // eth balance on gorli
  console.log(
    "Ending deployer ETH Balance: ",
    ethers.utils.formatEther(await deployer.getBalance())
  );
  console.log(
    "------------------------------------------------------------------"
  );
  console.log("Seed script finished :D");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
