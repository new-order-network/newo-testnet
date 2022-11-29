import { ethers } from "hardhat";
import {
  getPoolData,
  provider,
  handleCSV,
  amountWallets,
  usdcAddress,
  newoAddress,
  veNewoSeed,
  doUsdcSwap,
  doNewoSwap,
  provideLiquidity,
  seedWallet,
} from "./helpers";

require("dotenv").config(); // for pulling .env variables

// seed testnet LPool with multiple Lproviders, swaps, and lockup tokens for boost
async function main() {
  console.log(
    "------------------------------------------------------------------"
  );
  console.log("Seeding UniV3 Goerli Pool");
  console.log(
    "------------------------------------------------------------------"
  );

  // connect deployer, NEWO and USDC contracts
  const [deployer] = await ethers.getSigners();
  const USDC = await ethers.getContractFactory("USDC");
  const usdc = USDC.attach(usdcAddress);
  const NEWO = await ethers.getContractFactory("NEWO");
  const newo = NEWO.attach(newoAddress);

  // get deployer eth balance
  // todo require balance is amountToSend * amountWallets before running loop
  console.log(
    "Starting deployer ETH Balance: ",
    ethers.utils.formatEther(await deployer.getBalance())
  );
  console.log("--------------------------------------------------------");

  // per new wallet
  for (let i = 0; i < amountWallets; i++) {
    const newWallet = ethers.Wallet.createRandom().connect(provider); // creates a new wallet
    console.log("New Wallet ", i + 1, " created: ", newWallet.address);
    console.log("----------");

    // add wallet to CSV
    await handleCSV(newWallet);

    // get pool data
    let poolData: any = await getPoolData();

    // seed wallet
    await seedWallet(newWallet, deployer, newo, usdc);

    // provide liquidity to simulate lp's
    await provideLiquidity(newWallet, newo, usdc, poolData);

    // execute USDC -> NEWO swap
    await doUsdcSwap(newWallet, poolData.fee, usdc);

    // get new pool data
    poolData = await getPoolData();

    // execute NEWO -> USDC swap
    await doNewoSwap(newWallet, poolData.fee, newo);

    // lockup newo -> veNewO in a few wallets to simulate reward multiplier
    if (i < 3) {
      await veNewoSeed(newWallet, newo);
    }
    console.log("--------------------------------------------------------");
  }

  // eth balance on gorli
  console.log(
    "Ending deployer ETH Balance: ",
    ethers.utils.formatEther(await deployer.getBalance())
  );
  console.log("--------------------------------------------------------");
  console.log("Seed script finished :D");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
