import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  // eth balance on gorli
  console.log(
    "Starting deployer ETH Balance: ",
    ethers.utils.formatEther(await deployer.getBalance())
  );

  // launch newo
  const newo = await (
    await ethers.getContractFactory("NEWO")
  ).deploy("Newo", "Newo", "800000000");

  // launch usdc
  const usdc = await (await ethers.getContractFactory("USDC")).deploy();

  // launch veNewo
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

  // deploy upgradeable distributor contract
  const merkleDistributor = await ethers.getContractFactory(
    "MerkleRootDistributorV2"
  );
  const merkleInstance = await upgrades.deployProxy(merkleDistributor, {
    initializer: "initialize",
  });
  await merkleInstance.deployed();

  // deploy multicall that allows failure per call
  const multiCall = await (
    await ethers.getContractFactory("MultiCallWithFailure")
  ).deploy();

  console.log("NEWO address: ", newo.address);
  console.log("USDC address: ", usdc.address);
  console.log("veNEWO address: ", veNewo.address);
  console.log("MerkleDistributorV2 address: ", merkleInstance.address);
  console.log("MultiCallWithFailure address: ", multiCall.address);

  // eth balance on gorli
  console.log(
    "Ending deployer ETH Balance: ",
    ethers.utils.formatEther(await deployer.getBalance())
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
