import { createObjectCsvWriter } from "csv-writer";
import { ethers } from "hardhat";
import { abi as INonfungiblePositionManagerABI } from "@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json";
import { abi as SwapRouterABI } from "@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json";
import { Token, Percent } from "@uniswap/sdk-core";
import ERC20ABI from "./abis/ERC20Abi.json";
import veNewoABI from "./abis/veNewoABI.json";
import path from "path";
import fs from "fs";
import {
  nearestUsableTick,
  NonfungiblePositionManager,
  Pool,
  Position,
} from "@uniswap/v3-sdk";

export interface Immutables {
  factory: Address;
  token0: Address;
  token1: Address;
  fee: number;
  tickSpacing: number;
  maxLiquidityPerTick: number;
}

export type Wallet = {
  address: String;
  mnemonic: any; // todo what is the type for this
  privateKey: String;
};

export const amountWallets = 1; // how many wallets to be created and seeded for providing liq / doing swaps
export const swapAmountIn = "100"; // how many usdc to swap to newo
export const amountEthSeed = "0.1"; // how much eth to give each new wallet
export const positionManagerAddress =
  "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"; // uni v3 NonfungiblePositionManager
export const quoterAddress = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"; // uni v3 quoter
export const swapRouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"; // uni v3 router
export const usdcAddress = "0x68e9b61253E720aF5ec965A83509Afb6eA882a1D";
export const newoAddress = "0x92FedF27cFD1c72052d7Ca105A7F5522E4D7403D";
export const veNewoAddress = "0x3e0B3A5e3659CeAEEB8d6Dd190E7CBc0fCD749c4";

export const poolImmutablesAbi = [
  "function factory() external view returns (address)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function fee() external view returns (uint24)",
  "function liquidity() external view returns (uint128)",
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function tickSpacing() external view returns (int24)",
  "function maxLiquidityPerTick() external view returns (uint128)",
];

// provider and contracts consts -----------------------------------------------------------------------------
export const provider = new ethers.providers.JsonRpcProvider(
  `https://eth-goerli.g.alchemy.com/v2/${process.env.ALCHEMY_GORLI_KEY}`
);
export const nonfungiblePositionManagerContract = new ethers.Contract(
  positionManagerAddress,
  INonfungiblePositionManagerABI,
  provider
);
export const swapRouterContract = new ethers.Contract(
  swapRouterAddress,
  SwapRouterABI,
  provider
);
export const tokenContract0 = new ethers.Contract(
  usdcAddress,
  ERC20ABI,
  provider
);

// constants used here
const poolAddress = "0xd4811d73938f131a6bf0e10ce281b05d6959fcbd"; // newo/usdc univ3 pool
const poolContract = new ethers.Contract(
  poolAddress,
  poolImmutablesAbi,
  provider
);
const approvalAmount = ethers.utils.parseEther("1000000000");
const chainId = 5; // gorli
const NewoToken = new Token(chainId, newoAddress, 18, "NEWO", "NEWO");
const UsdcToken = new Token(chainId, usdcAddress, 18, "USDC", "USDC");

// actions
export async function getPoolData() {
  const [tickSpacing, fee, liquidity, slot0] = await Promise.all([
    poolContract.tickSpacing(),
    poolContract.fee(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);

  return {
    tickSpacing: tickSpacing,
    fee: fee,
    liquidity: liquidity,
    sqrtPriceX96: slot0[0],
    tick: slot0[1],
  };
}

export async function handleCSV(newWallet: Wallet) {
  console.log("Handling new wallet CSV...");

  // create csv or write to existing
  if (!fs.existsSync(path.resolve(__dirname, "testnetLpWallets.csv"))) {
    // creates new file
    const writer = createObjectCsvWriter({
      path: path.resolve(__dirname, "testnetLpWallets.csv"),
      header: [
        { id: "address", title: "Address" },
        { id: "mnemonic", title: "Mnemonic" },
        { id: "privateKey", title: "PrivateKey" },
      ],
    });

    // create record object
    const newWalletRecord = [
      {
        address: newWallet.address.toString(),
        mnemonic: newWallet.mnemonic.phrase.toString(),
        privateKey: newWallet.privateKey.toString(),
      },
    ];

    // create csv of each newly created wallet
    await writer.writeRecords(newWalletRecord);

    console.log("CSV created with each new wallet info...");
    console.log("-----");
  } else {
    // appends to existing file instead of creating new
    const writer = createObjectCsvWriter({
      path: path.resolve(__dirname, "testnetLpWallets.csv"),
      header: [
        { id: "address", title: "Address" },
        { id: "mnemonic", title: "Mnemonic" },
        { id: "privateKey", title: "PrivateKey" },
      ],
      append: true,
    });

    // add wallet to existing csv
    const newWalletRecord = [
      {
        address: newWallet.address.toString(),
        mnemonic: newWallet.mnemonic.phrase.toString(),
        privateKey: newWallet.privateKey.toString(),
      },
    ];

    // create csv of each newly created wallet
    await writer.writeRecords(newWalletRecord);

    console.log("New wallet added to CSV...");
    console.log("-----");
  }
}

// lock up newo into veNewo testnet contract to simulate veNewo multiplier rewards
export async function veNewoSeed(newWallet: any, newo: any) {
  console.log("Locking up newo into veNewo in the wallet...");

  // don't need to do it like this but was having bizarre error with provider
  const veNewo = new ethers.Contract(veNewoAddress, veNewoABI, newWallet);

  const approval = await newo
    .connect(newWallet)
    .approve(veNewo.address, approvalAmount);
  await approval.wait();

  // call deposit function of veNewo
  const shares = await veNewo.deposit(
    ethers.utils.parseEther("1000"),
    newWallet.address
  );
  await shares.wait();
}

export async function seedWallet(
  newWallet: any,
  deployer: any,
  newo: any,
  usdc: any
) {
  // -----------------------------------------------------------------------------------------
  // give eth, newo, usdc to each new wallet
  const approvalAmount = ethers.utils.parseEther("10000000");
  console.log("Seeding new wallet...");

  // 0.05 gorli eth, 0.5 gorli eth total
  await deployer.sendTransaction({
    to: newWallet.address,
    value: ethers.utils.parseEther(amountEthSeed),
    gasLimit: ethers.utils.hexlify(1000000),
  });

  // send 100,000 NEWO
  const approveNewo = await newo
    .connect(deployer)
    .approve(newWallet.address, approvalAmount); // approves extra
  await approveNewo.wait();
  const transferNewo = await newo
    .connect(deployer)
    .transfer(newWallet.address, ethers.utils.parseEther("100000"));
  await transferNewo.wait();

  // send 10,000 USDC
  const approveUSDC = await usdc.approve(newWallet.address, approvalAmount);
  await approveUSDC.wait();
  const transferUsdc = await usdc.transfer(
    newWallet.address,
    ethers.utils.parseEther("10000")
  );
  await transferUsdc.wait();
  console.log("----------");
}

export async function doSwap(newWallet: any, poolFee: any) {
  // -----------------------------------------------------------------------------------------
  // swap in univ3 pool
  console.log("Swapping ", swapAmountIn, " USDC to NEWO...");
  const amountIn = ethers.utils.parseUnits(swapAmountIn, 18);

  // approve the router for usdc
  const approvalResponse = await tokenContract0
    .connect(newWallet)
    .approve(swapRouterAddress, approvalAmount);
  await approvalResponse.wait();

  const swapParams = {
    tokenIn: usdcAddress,
    tokenOut: newoAddress,
    fee: poolFee,
    recipient: newWallet.address,
    deadline: Math.floor(Date.now() / 1000) + 60 * 10,
    amountIn: amountIn,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  };

  // ensure test wallet has enough eth for the transactions
  const swapBalance = await newWallet.getBalance();
  const swapGasLimit = await swapRouterContract
    .connect(newWallet)
    .estimateGas.exactInputSingle(swapParams);
  const swapGasPrice = await newWallet.provider.getFeeData();

  // wait for gasPrice of minting lp position
  // todo maybe make these gas calculations global for each transaction
  if (
    swapGasPrice.maxFeePerGas != null &&
    swapGasPrice.maxPriorityFeePerGas != null
  ) {
    const swapGas = swapGasPrice.maxFeePerGas.mul(swapGasLimit);

    // check funds for gas
    if (swapBalance.lt(swapGas)) {
      throw new Error(`Insufficient gas in new wallet for minting LP position`);
    }

    // univ3 uses nft's for lp positions, mint the new position
    const swap = await swapRouterContract
      .connect(newWallet)
      .exactInputSingle(swapParams, {
        maxFeePerGas: swapGasPrice.maxFeePerGas,
        maxPriorityFeePerGas: swapGasPrice.maxPriorityFeePerGas,
      });
    const swapReceipt = await swap.wait();
    // console.log("Adding liquidity result: ", swapReceipt);
    console.log("----------");
  }
}

export async function provideLiquidity(
  newWallet: any,
  newo: any,
  usdc: any,
  poolData: any
) {
  const NEWO_USDC_POOL = new Pool(
    NewoToken,
    UsdcToken,
    poolData.fee, // fee tier ex 0.05%
    poolData.sqrtPriceX96.toString(), // current pool price
    poolData.liquidity.toString(), // current pool liquidity
    poolData.tick // current pool tick
  );

  const position = new Position({
    pool: NEWO_USDC_POOL,
    liquidity: ethers.utils.parseUnits("0.01", 18).toHexString(), // poolData.liquidity * 0.0002, how much liquidity to add, 0.0002 times the
    tickLower:
      nearestUsableTick(poolData.tick, poolData.tickSpacing) -
      poolData.tickSpacing * 2,
    tickUpper:
      nearestUsableTick(poolData.tick, poolData.tickSpacing) +
      poolData.tickSpacing * 2,
  });

  const { amount0: amount0Desired, amount1: amount1Desired } =
    position.mintAmounts; // mintAmountsWithSlippage

  // -----------------------------------------------------------------------------------------
  // provide liquidity to uni v3 pool
  console.log("Approving liquidity to pool...");
  const liqNewoApprove = await newo
    .connect(newWallet)
    .approve(positionManagerAddress, approvalAmount);
  await liqNewoApprove.wait();
  const liqUsdcApprove = await usdc
    .connect(newWallet)
    .approve(positionManagerAddress, approvalAmount);
  await liqUsdcApprove.wait();

  // prepare params for minting new liquidity position
  const lpParams = {
    token0: usdc.address,
    token1: newo.address,
    fee: poolData.fee,
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    amount0Desired: amount0Desired.toString(),
    amount1Desired: amount1Desired.toString(),
    amount0Min: 0, // only for testnet, vulnerable to frontrunning
    amount1Min: 0, // only for testnet, vulnerable to frontrunning
    recipient: newWallet.address,
    // slippageTolerance: new Percent(50, 10_000), // can omit
    deadline: Math.floor(Date.now() / 1000) + 120 * 10,
  };

  console.log("Lp params: ", lpParams);

  // ensure test wallet has enough eth for the transactions
  const newWalletBalance = await newWallet.getBalance();
  console.log("Estimating gas cost of minting lp position...");
  const lpGasFees = await nonfungiblePositionManagerContract
    .connect(newWallet)
    .estimateGas.mint(lpParams);
  const lpGasPrice = await newWallet.provider.getFeeData();

  // wait for gasPrice of minting lp position
  // todo maybe make these gas calculations global for each transaction
  if (
    lpGasPrice.maxFeePerGas != null &&
    lpGasPrice.maxPriorityFeePerGas != null
  ) {
    const mintGasPrice = lpGasPrice.maxFeePerGas.mul(lpGasFees);

    // check funds for gas
    if (newWalletBalance.lt(mintGasPrice)) {
      throw new Error(`Insufficient gas in new wallet for minting LP position`);
    }

    console.log("Providing liquidity to pool...");
    // univ3 uses nft's for lp positions, mint the new position
    const mintPosition = await nonfungiblePositionManagerContract
      .connect(newWallet)
      .mint(lpParams, {
        maxFeePerGas: lpGasPrice.maxFeePerGas,
        maxPriorityFeePerGas: lpGasPrice.maxPriorityFeePerGas,
        gasLimit: ethers.utils.hexlify(1000000),
      });
    const mintReceipt = await mintPosition.wait();
    // console.log("Adding liquidity result: ", mintReceipt);
    console.log("----------");
  }
}
