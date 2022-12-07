![Logo](https://neworder.network/assets/images/logo.png)

# NEWO Göerli UniswapV3 Pool Tool

Script for creating & seeding a UniV3 testnet pool with liquidity and swaps

- Deploys NEWO, USDC and veNEWO
- If no `poolAddress` is given, creates a UniV3 NEWO/USDC pool
- Creates a set # of testnet wallets
- Seeds each new wallet with NEWO, USDC, and ETH
- Each new walllet provides liquidity to pool
- Each new wallet swaps some USDC -> NEWO -> USDC
- Set # of new wallets lock up NEWO into veNEWO

## Tools

- `deploy.ts`
  - deploys NEWO, USDC, veNEWO, MerkleDistributor and Multicall contracts on testnet
- `seedTestnet.ts`
  - create and/or seed a Uniswap V3 Testnet Pool with liquidity and swaps
    - ![testnetLiquidityMath](https://www.dropbox.com/s/6bwitx8ngr07ioo/testnetLiqMath.png)
  - locks up some NEWO in veNEWO to simulate rewards boosts for testnet weekly rewards computer
- `recoverTestnet.ts`
  - recovers all ETH from created testnet wallets

## Prerequisites

- Create testnet deployment wallet and seed with >= 1 Görli ETH
- Create UniV3 pool on [Uniswap Görli](https://app.uniswap.org/#/pool)
- Create Alchemy account with an ETH Göerli App

## Environment Variables

To run this project, you will need to add the following environment variables to your .env file

`PRIVATE KEY`

`ALCHEMY_GORLI_KEY`

## Installation

To install the packages

```bash
  npm install
```

## Deployment

To deploy NEWO, USDC, veNEWO, MerkleDistributor, and MultiCall contracts on testnet

```bash
  npx hardhat run scripts/deploy.ts --network goerli
```

To seed a testnet UniV3 Pool

```bash
  npx hardhat run scripts/seedTestnet.ts --network goerli
```

To recover ETH from created testnet wallets

```bash
  npx hardhat run scripts/recoverTestnet.ts --network goerli
```

## Notes

- depending on your pool, you may have to flip the `token0` and `token1` in `lpParams` inside `provideLiquidity()`, will return a gas error when estimating gas if this is an issue
