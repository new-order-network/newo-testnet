import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("NEWO/USDC UniV3", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployPair() {
    // Contracts are deployed using the first signer/account by default
    const [deployer, otherAccount] = await ethers.getSigners();

    // launch newo
    const newo = await (
      await ethers.getContractFactory("NEWO")
    ).deploy("Newo", "Newo", "800000000");

    // launch usdc
    const usdc = await (await ethers.getContractFactory("USDC")).deploy();

    return { newo, usdc, deployer, otherAccount };
  }

  describe("Deployment", function () {
    it("Should have 800mil Newo", async function () {
      const { newo, deployer } = await loadFixture(deployPair);

      expect(await newo.balanceOf(deployer.address)).to.equal(
        ethers.utils.parseUnits("800000000", 18)
      );
    });

    it("Should have 100mil USDC", async function () {
      const { usdc, deployer } = await loadFixture(deployPair);

      expect(await usdc.balanceOf(deployer.address)).to.equal(
        ethers.utils.parseUnits("100000000", 6)
      );
    });

    // it("Should receive and store the funds to lock", async function () {
    //   const { lock, lockedAmount } = await loadFixture(
    //     deployOneYearLockFixture
    //   );

    //   expect(await ethers.provider.getBalance(lock.address)).to.equal(
    //     lockedAmount
    //   );
    // });

    // it("Should fail if the unlockTime is not in the future", async function () {
    //   // We don't use the fixture here because we want a different deployment
    //   const latestTime = await time.latest();
    //   const Lock = await ethers.getContractFactory("Lock");
    //   await expect(Lock.deploy(latestTime, { value: 1 })).to.be.revertedWith(
    //     "Unlock time should be in the future"
    //   );
    // });
  });
});
