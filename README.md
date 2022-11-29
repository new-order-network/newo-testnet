![Logo](https://neworder.network/assets/images/logo.png)

# NEWO Göerli Deployment

Script for seeding a UniV3 testnet pool with liquidity and swaps

- Creates a set amount of testnet wallets (recommend 10)
- Seeds each new wallet with NEWO, USDC, and ETH
- New wallets provide liquidity to pool & swap some USDC -> NEWO -> USDC
- 3/10 new wallets lock up NEWO into veNEWO

## Tools

- `deploy.ts`
  - deploys NEWO, USDC, veNEWO, MerkleDistributor and Multicall contracts on testnet
- `seedTestnet.ts`
  - seeds a Uniswap V3 Testnet Pool with liquidity and swaps
  - locks up some NEWO in veNEWO to simulate rewards boosts
- `recoverTestnet.ts`
  - recovers all funds from created testnet wallets

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
