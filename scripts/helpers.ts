import { createObjectCsvWriter } from "csv-writer";
import { ethers } from "hardhat";
import { abi as INonfungiblePositionManagerABI } from "@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json";
import { abi as SwapRouterABI } from "@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json";
import { abi as FACTORY_ABI } from "@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json";
import { abi as UniswapV3PoolABI } from "@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json";
import { Token } from "@uniswap/sdk-core";
import path from "path";
import fs from "fs";
import { nearestUsableTick, Pool, Position, TickMath } from "@uniswap/v3-sdk";
import { BigNumber } from "ethers";
import bn from "bignumber.js";
const { ALCHEMY_GORLI_KEY } = process.env;

// *** NOTE ***
// you must enter the amount liquidity to provide from each wallet in provideLiquidity()
// this will be different for each use case, a simple amount is `poolData.liquidity * 0.25` (25% of the existing liq)

// *** exported constsnts
export interface Immutables {
  factory: any;
  token0: any;
  token1: any;
  fee: number;
  tickSpacing: number;
  maxLiquidityPerTick: number;
}
export type Wallet = {
  address: String;
  mnemonic: any;
  privateKey: String;
};

export const provider = new ethers.providers.JsonRpcProvider(
  "https://eth-goerli.g.alchemy.com/v2/" + ALCHEMY_GORLI_KEY
); // for testing with goerli testnet
// export const provider = new ethers.providers.JsonRpcProvider(
//   "http://127.0.0.1:8545/"
// ); // for testing with hardhat mainnet fork

export const amountWallets = 5; // how many wallets to be created and seeded for providing liq / doing swaps
export const amountVeNewoWallets = 2; // how many wallets to lock up NEWO into veNEWO to simulate rewards boosts
export const positionManagerAddress =
  "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"; // uni v3 NonfungiblePositionManager
export const poolAddress = ""; // if pool already exists, for ex if uniswap front end was used for it, put here
// prevent too many requests w 2 sec delays
export const delay = () => new Promise((res) => setTimeout(res, 2000));

// *** constants
const chainId = 5; // gorli

// this is result of complicated univ3 math, using a token1 amount of token0, see uni docs
// const amountLiquiditySeed = "1000000000000000000000000"; // 1 million liq start if 2 18 dec tokens
const amountLiquiditySeed = "1000000000000000000"; // if usdc is 6 tokens

const amountEthSeed = ethers.utils.parseEther("0.05"); // how much eth to give each new wallet
const amountNewoSeed = ethers.utils.parseEther("10000"); // how much newo to give each new wallet
// const amountUsdcSeed = ethers.utils.parseEther("10000"); // how much usdc to give each new wallet
const amountUsdcSeed = ethers.utils.parseUnits("10000", 6); // 6 decimal usdc

const amountVeNewoLock = ethers.utils.parseEther("1000"); // how much newo to lock into veNewo

// const amountUsdcSwap = ethers.utils.parseEther("5000"); // how much usdc to swap
const amountUsdcSwap = ethers.utils.parseUnits("5000", 6); // 6 decimal usdc
const amountNewoSwap = ethers.utils.parseEther("10000"); // how much newo to swap 18 dec
const newoApprovalAmount = ethers.utils.parseEther("1000000000"); // 1 billion approval (if 18 dec token)
// const usdcApprovalAmount = ethers.utils.parseEther("1000000000"); // 1 billion approval
const usdcApprovalAmount = ethers.utils.parseUnits("100000000", 6); // 6 decimal usdc

const poolImmutablesAbi = [
  "function factory() external view returns (address)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function fee() external view returns (uint24)",
  "function liquidity() external view returns (uint128)",
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function tickSpacing() external view returns (int24)",
  "function maxLiquidityPerTick() external view returns (uint128)",
];
const swapRouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"; // uni v3 router
const nonfungiblePositionManagerContract = new ethers.Contract(
  positionManagerAddress,
  INonfungiblePositionManagerABI,
  provider
);
const swapRouterContract = new ethers.Contract(
  swapRouterAddress,
  SwapRouterABI,
  provider
);

// for creating the pool, need to get the ratio of both token amount going in
function encodePriceSqrt(reserve1: String, reserve0: String) {
  return BigNumber.from(
    new bn(reserve1.toString())
      .div(reserve0.toString())
      .sqrt()
      .multipliedBy(new bn(2).pow(96))
      .integerValue(3)
      .toString()
  );
}

function tokenCompare(token0: string, token1: string) {
  const t0 = token0.toLowerCase() < token1.toLowerCase() ? token0 : token1;
  const t1 = token0.toLowerCase() < token1.toLowerCase() ? token1 : token0;

  return [t0, t1];
}

// *** actions
export async function getPoolData(newPoolAddress?: any) {
  console.log("Getting new pool data...");
  const poolContract = new ethers.Contract(
    newPoolAddress ?? poolAddress,
    poolImmutablesAbi,
    provider
  );

  const [tickSpacing, fee, liquidity, slot0] = await Promise.all([
    poolContract.tickSpacing(),
    poolContract.fee(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);

  const poolData = {
    tickSpacing: tickSpacing,
    fee: fee,
    liquidity: liquidity,
    sqrtPriceX96: slot0[0],
    tick: slot0[1],
  };
  console.log(poolData);
  console.log("-----");

  return poolData;
}

//
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

    console.log("New wallet added to CSV");
    console.log("-----");
  }
}

export async function veNewoSeed(newWallet: any, newo: any, veNewo: any) {
  console.log(
    "Locking up ",
    ethers.utils.formatEther(amountVeNewoLock),
    " newo into veNewo..."
  );

  const approval = await newo
    .connect(newWallet)
    .approve(veNewo.address, newoApprovalAmount, { gasLimit: 5000000 });
  await approval.wait();

  // call deposit function of veNewo
  // must write out the abi since there are 2 deposit functions in contract, hardhat gets confuzzled
  const shares = await veNewo
    .connect(newWallet)
    ["deposit(uint256,address)"](amountVeNewoLock, newWallet.address, {
      gasLimit: 5000000,
    });
  await shares.wait();

  console.log("veNEWO locked");
  console.log("-----");
}

export async function seedWallet(
  newWallet: any,
  deployer: any,
  newo: any,
  usdc: any
) {
  // -----------------------------------------------------------------------------------------
  // give eth, newo, usdc to each new wallet
  console.log("Seeding new wallet...");

  // 0.05 gorli eth, 0.5 gorli eth total
  await deployer.sendTransaction({
    to: newWallet.address,
    value: amountEthSeed,
    gasLimit: ethers.utils.hexlify(1000000),
  });

  // send NEWO
  const approveNewo = await newo
    .connect(deployer)
    .approve(newWallet.address, newoApprovalAmount, { gasLimit: 5000000 }); // approves extra
  await approveNewo.wait();
  const transferNewo = await newo
    .connect(deployer)
    .transfer(newWallet.address, amountNewoSeed, { gasLimit: 5000000 });
  await transferNewo.wait();

  // send USDC
  const approveUSDC = await usdc.approve(newWallet.address, usdcApprovalAmount);
  await approveUSDC.wait();
  const transferUsdc = await usdc.transfer(newWallet.address, amountUsdcSeed);
  await transferUsdc.wait();
  console.log("-----");
}

export async function doUsdcSwap(
  newWallet: any,
  poolFee: any,
  newo: any,
  usdc: any
) {
  // -----------------------------------------------------------------------------------------
  // swap in univ3 pool
  console.log(
    "Swapping ",
    ethers.utils.formatUnits(amountUsdcSwap, 6),
    // ethers.utils.formatUnits(amountUsdcSwap, 6),
    " USDC to NEWO..."
  );

  // approve the router for usdc and newo
  const approvalUsdcResponse = await usdc
    .connect(newWallet)
    .approve(swapRouterAddress, usdcApprovalAmount, { gasLimit: 5000000 });
  await approvalUsdcResponse.wait();

  const swapParams = {
    tokenIn: usdc.address,
    tokenOut: newo.address,
    fee: poolFee,
    recipient: newWallet.address,
    deadline: Math.floor(Date.now() / 1000) + 60 * 10,
    amountIn: amountUsdcSwap,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  };

  // ensure test wallet has enough eth for the transactions
  const swapBalance = await newWallet.getBalance();
  const swapGasLimit = await swapRouterContract
    .connect(newWallet)
    .estimateGas.exactInputSingle(swapParams);
  const swapGasPrice = await newWallet.provider.getFeeData();

  // wait for gasPrice of swap
  if (
    swapGasPrice.maxFeePerGas != null &&
    swapGasPrice.maxPriorityFeePerGas != null
  ) {
    const swapGas = swapGasPrice.maxFeePerGas.mul(swapGasLimit);

    // check funds for gas
    if (swapBalance.lt(swapGas)) {
      throw new Error(`Insufficient gas in wallet for swapping USDC -> NEWO`);
    }

    // do the swap
    const swap = await swapRouterContract
      .connect(newWallet)
      .exactInputSingle(swapParams, {
        maxFeePerGas: swapGasPrice.maxFeePerGas,
        maxPriorityFeePerGas: swapGasPrice.maxPriorityFeePerGas,
      });
    await swap.wait();
    console.log("-----");
  }
}

export async function doNewoSwap(
  newWallet: any,
  poolFee: any,
  newo: any,
  usdc: any
) {
  // -----------------------------------------------------------------------------------------
  // swap in univ3 pool
  console.log(
    "Swapping ",
    ethers.utils.formatEther(amountNewoSwap),
    " NEWO to USDC..."
  );

  // approve the router for usdc and newo
  const approvalNewoResponse = await newo
    .connect(newWallet)
    .approve(swapRouterAddress, newoApprovalAmount, { gasLimit: 5000000 });
  await approvalNewoResponse.wait();

  const swapParams = {
    tokenIn: newo.address,
    tokenOut: usdc.address,
    fee: poolFee,
    recipient: newWallet.address,
    deadline: Math.floor(Date.now() / 1000) + 60 * 10,
    amountIn: amountNewoSwap,
    amountOutMinimum: 0, // testnet only, vulnerable to front running
    sqrtPriceLimitX96: 0,
  };

  // ensure test wallet has enough eth for the transactions
  const swapBalance = await newWallet.getBalance();
  const swapGasLimit = await swapRouterContract
    .connect(newWallet)
    .estimateGas.exactInputSingle(swapParams);
  const swapGasPrice = await newWallet.provider.getFeeData();

  // wait for gasPrice of swap
  if (
    swapGasPrice.maxFeePerGas != null &&
    swapGasPrice.maxPriorityFeePerGas != null
  ) {
    const swapGas = swapGasPrice.maxFeePerGas.mul(swapGasLimit);

    // check funds for gas
    if (swapBalance.lt(swapGas)) {
      throw new Error(
        `Insufficient gas in new wallet for swapping NEWO -> USDC`
      );
    }

    // do the swap
    const swap = await swapRouterContract
      .connect(newWallet)
      .exactInputSingle(swapParams, {
        maxFeePerGas: swapGasPrice.maxFeePerGas,
        maxPriorityFeePerGas: swapGasPrice.maxPriorityFeePerGas,
      });
    await swap.wait();
    console.log("-----");
  }
}

export async function createPool(deployer: any, newo: any, usdc: any) {
  bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });
  console.log("Creating the new liquidity pool...");

  const [t0, t1] = tokenCompare(newo.address, usdc.address);

  // start pool at similar price to real life
  // reserve1 / reserve0
  const price = encodePriceSqrt(
    ethers.utils.parseEther("43000000").toString(),
    // ethers.utils.parseEther("710000").toString()
    ethers.utils.parseUnits("710000", 6).toString() // 6 decimal usdc
  );

  // create the pool with the deployer wallet
  const newPool = await nonfungiblePositionManagerContract
    .connect(deployer)
    .createAndInitializePoolIfNecessary(t0, t1, 500, price, {
      gasLimit: 10000000,
    });
  await newPool.wait();

  // get pool address, can't return straight from EVM
  const uniswapV3Factory = new ethers.Contract(
    "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    FACTORY_ABI,
    deployer
  );
  const poolAddress = new ethers.Contract(
    await uniswapV3Factory.getPool(newo.address, usdc.address, 500),
    UniswapV3PoolABI,
    deployer
  );

  console.log("NEWO/USDC Pool created at: ", poolAddress.address);
  console.log("-----");
  return poolAddress;
}

export async function seedPool(
  seedWallet: any,
  newo: any,
  usdc: any,
  poolData: any
) {
  console.log("Seeding the pool...");

  const NewoToken = new Token(chainId, newo.address, 18);
  // const UsdcToken = new Token(chainId, usdc.address, 18);
  const UsdcToken = new Token(chainId, usdc.address, 6); // 6 decimal usdc

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
    liquidity: amountLiquiditySeed,
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
  console.log("Approving liquidity to existing pool...");
  const liqNewoApprove = await newo
    .connect(seedWallet)
    .approve(positionManagerAddress, newoApprovalAmount, { gasLimit: 5000000 });
  await liqNewoApprove.wait();

  const liqUsdcApprove = await usdc
    .connect(seedWallet)
    .approve(positionManagerAddress, usdcApprovalAmount, {
      gasLimit: 30000000,
    });
  await liqUsdcApprove.wait();
  const [t0, t1] = tokenCompare(newo.address, usdc.address);

  // prepare params for minting new liquidity position
  // only uses token1 up to matching amount of token0 from price of pool
  const lpParams = {
    token0: t0,
    token1: t1,
    fee: 500,
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    amount0Desired: amount0Desired.toString(),
    amount1Desired: amount1Desired.toString(),
    amount0Min: 0, // only for testnet, vulnerable to frontrunning
    amount1Min: 0, // only for testnet, vulnerable to frontrunning
    recipient: seedWallet.address,
    deadline: Math.floor(Date.now() / 1000) + 120 * 10,
  };

  // ensure test wallet has enough eth for the transactions
  const newWalletBalance = await seedWallet.getBalance();
  console.log("Estimating gas cost of minting lp position...");
  const lpGasFees = await nonfungiblePositionManagerContract
    .connect(seedWallet)
    .estimateGas.mint(lpParams);
  const lpGasPrice = await seedWallet.provider.getFeeData();

  // wait for gasPrice of minting lp position
  if (
    lpGasPrice.maxFeePerGas != null &&
    lpGasPrice.maxPriorityFeePerGas != null
  ) {
    const mintGasPrice = lpGasPrice.maxFeePerGas.mul(lpGasFees);

    // check funds for gas
    if (newWalletBalance.lt(mintGasPrice)) {
      throw new Error(`Insufficient gas in new wallet for minting LP position`);
    }

    console.log("Minting lp position...");
    // univ3 uses nft's for lp positions, mint the new position
    const mintPosition = await nonfungiblePositionManagerContract
      .connect(seedWallet)
      .mint(lpParams, {
        maxFeePerGas: lpGasPrice.maxFeePerGas,
        maxPriorityFeePerGas: lpGasPrice.maxPriorityFeePerGas,
        gasLimit: ethers.utils.hexlify(5000000),
      });
    await mintPosition.wait();
    console.log("-----");
  }
}

export async function provideLiquidity(
  newWallet: any,
  newo: any,
  usdc: any,
  poolData: any
) {
  const NewoToken = new Token(chainId, newo.address, 18);
  // const UsdcToken = new Token(chainId, usdc.address, 18);
  const UsdcToken = new Token(chainId, usdc.address, 6); // 6 decimal usdc

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
    liquidity: poolData.liquidity * 0.25, // how much liquidity to add, 4 wallets so each gives 25% of existing liq
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
  const liqNewoApprove = await newo
    .connect(newWallet)
    .approve(positionManagerAddress, newoApprovalAmount, { gasLimit: 5000000 });
  await liqNewoApprove.wait();
  const liqUsdcApprove = await usdc
    .connect(newWallet)
    .approve(positionManagerAddress, usdcApprovalAmount, { gasLimit: 5000000 });
  await liqUsdcApprove.wait();

  const [t0, t1] = tokenCompare(newo.address, usdc.address);

  // prepare params for minting new liquidity position
  const lpParams = {
    token0: t0,
    token1: t1,
    fee: poolData.fee,
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    amount0Desired: amount0Desired.toString(),
    amount1Desired: amount1Desired.toString(),
    amount0Min: 0, // only for testnet, vulnerable to frontrunning
    amount1Min: 0, // only for testnet, vulnerable to frontrunning
    recipient: newWallet.address,
    deadline: Math.floor(Date.now() / 1000) + 120 * 10,
  };

  // ensure test wallet has enough eth for the transactions
  const newWalletBalance = await newWallet.getBalance();
  const lpGasFees = await nonfungiblePositionManagerContract
    .connect(newWallet)
    .estimateGas.mint(lpParams);
  const lpGasPrice = await newWallet.provider.getFeeData();

  // wait for gasPrice of minting lp position
  if (
    lpGasPrice.maxFeePerGas != null &&
    lpGasPrice.maxPriorityFeePerGas != null
  ) {
    const mintGasPrice = lpGasPrice.maxFeePerGas.mul(lpGasFees);

    // check funds for gas
    if (newWalletBalance.lt(mintGasPrice)) {
      throw new Error(`Insufficient gas in new wallet for minting LP position`);
    }

    console.log("Minting lp position...");
    // univ3 uses nft's for lp positions, mint the new position
    const mintPosition = await nonfungiblePositionManagerContract
      .connect(newWallet)
      .mint(lpParams, {
        maxFeePerGas: lpGasPrice.maxFeePerGas,
        maxPriorityFeePerGas: lpGasPrice.maxPriorityFeePerGas,
        gasLimit: ethers.utils.hexlify(5000000),
      });
    await mintPosition.wait();

    console.log("Liquidity position minted");
    console.log("-----");
  }
}
