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
  seedPool,
  createPool,
  delay,
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
  await delay();

  // *** deploy NEWO, USDC and veNEWO
  const newo = await (
    await ethers.getContractFactory("NEWO")
  ).deploy("Newo", "Newo", "800000000");
  await delay();

  const usdc = await (await ethers.getContractFactory("USDC")).deploy();
  await delay();

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
  // await delay();
  console.log("NEWO address: ", newo.address);
  console.log("USDC address: ", usdc.address);
  console.log("veNewo address: ", veNewo.address);
  console.log("-----");
  // console.log(veNewo.functions);
  await delay();

  // *** create liquidity pool if none exists yet
  let poolData: any;
  let newPool: any;
  if (!poolAddress) {
    newPool = await createPool(deployer, newo, usdc);

    // get pool data with newPool address
    poolData = await getPoolData(newPool.address);

    // seed the pool
    await seedPool(deployer, newo, usdc, poolData);
  } else {
    // get pool data
    poolData = await getPoolData();
  }

  // *** provide liquidity per new wallet (0,1,2,3,4)
  for (let i = 0; i < amountWallets; i++) {
    const newWallet = ethers.Wallet.createRandom().connect(provider); // creates a new wallet
    console.log("New Wallet ", i, " created: ", newWallet.address);
    console.log("-----");

    // *** add wallet to CSV
    await handleCSV(newWallet);

    // *** seed wallet
    await seedWallet(newWallet, deployer, newo, usdc);

    console.log("Starting balances of wallet: ");
    console.log(
      "NEWO: ",
      ethers.utils.formatEther(await newo.balanceOf(newWallet.address))
    );
    console.log(
      "USDC: ",
      ethers.utils.formatUnits(await usdc.balanceOf(newWallet.address), 6)
    );
    console.log(
      "veNEWO: ",
      ethers.utils.formatEther(await veNewo.balanceOf(newWallet.address))
    );
    console.log("-----");

    // *** only provide liq from wallets 0, 1, 2
    if (i < 3) {
      // *** get new pool data
      poolData = await getPoolData(newPool.address);

      await provideLiquidity(newWallet, newo, usdc, poolData);

      // *** lockup newo -> veNewO from new wallets 0, 1
      if (i < 2) {
        await veNewoSeed(newWallet, newo, veNewo);
      }
    } else {
      // *** only do swaps from wallets 3, 4

      // *** execute USDC -> NEWO swap
      await doUsdcSwap(newWallet, poolData.fee, newo, usdc);

      // *** get new pool data
      poolData = await getPoolData(newPool.address);

      // *** execute NEWO -> USDC swap
      await doNewoSwap(newWallet, poolData.fee, newo, usdc);
    }
    console.log("Final balances of wallet: ");
    console.log(
      "NEWO: ",
      ethers.utils.formatEther(await newo.balanceOf(newWallet.address))
    );
    console.log(
      "USDC: ",
      ethers.utils.formatUnits(await usdc.balanceOf(newWallet.address), 6)
    );
    console.log(
      "veNEWO: ",
      ethers.utils.formatEther(await veNewo.balanceOf(newWallet.address))
    );
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
