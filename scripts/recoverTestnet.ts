// -----------------------------------------------------------------------------------------
// recover all funds from created test wallets in the CSV

import { parse } from "csv-parse";
import { ethers } from "hardhat";
import { provider } from "./helpers";
import fs from "fs";

// send all funds from wallet
async function getFunds(allPKeys: any) {
  // -----------------------------------------------------------------------------------------
  // connect deployer
  const [deployer] = await ethers.getSigners();

  console.log(
    "Balance of deployer before recovery: ",
    ethers.utils.formatEther(await deployer.getBalance())
  );

  // for every private key passed in
  for (let i = 0; i < allPKeys.length; i++) {
    try {
      console.log(
        "Sending ETH from pkey",
        allPKeys[i].toString().slice(0, 6),
        "..."
      );

      // add pkey to signer and use signer for for loop of sending
      const signer = new ethers.Wallet(allPKeys[i], provider); // row[2] is the pkey

      const balance = await signer.getBalance();
      const gasLimit = await signer.provider.estimateGas({
        to: deployer.address,
        value: balance,
      });
      const gasPrice = await signer.provider.getFeeData();

      // wait for gasPrice to finish pulling
      if (
        gasPrice.maxFeePerGas != null &&
        gasPrice.maxPriorityFeePerGas != null
      ) {
        const sendPrice = gasPrice.maxFeePerGas.mul(gasLimit);

        // check for enough funds including gas price
        if (balance.lt(sendPrice)) {
          console.log("Insufficient funds in wallet for current gas price");
        } else {
          // subtract gas cost from wallet balance
          const amountToSend = balance.sub(sendPrice);
          console.log(ethers.utils.formatEther(amountToSend));

          // send wallet balance to main deployer wallet
          const sendEth = await signer.sendTransaction({
            to: deployer.address,
            value: amountToSend,
            maxFeePerGas: gasPrice.maxFeePerGas,
            maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas,
          });
          await sendEth.wait(); // sit and wait for each send to finish
        }
      }
    } catch (error) {
      console.log("Error: " + error);
    }
  }

  console.log(
    "Balance of deployer after recovery: ",
    ethers.utils.formatEther(await deployer.getBalance())
  );
}

async function main() {
  console.log("Recovering all ETH from each created testnet wallet...");

  // -----------------------------------------------------------------------------------------
  // check pkey column for private key, for every send back to deployer
  let allPKeys: any = [];
  fs.createReadStream(__dirname + "/testnetLpWallets.csv")
    .pipe(parse({ delimiter: ",", from_line: 2 })) // separate by commas, start at line 2
    .on("data", function (row) {
      allPKeys.push(row[2]);
    })
    .on("end", async function () {
      console.log("Parsed private keys from CSV...");
      getFunds(allPKeys);
    })
    .on("error", function (error) {
      console.log(error.message);
    });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
