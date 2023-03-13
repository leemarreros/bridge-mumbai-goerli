import hre from "hardhat";
import { ethers } from "hardhat";

import { getRole, RELAYER_GOERLI_ADDRESS } from "../utils";

async function main() {
  var tx;

  // 0xf4664Fc83FBf0e78ec0a64cdd6B156586E2889a0
  const GoerliScrow = await ethers.getContractFactory("GoerliScrow");
  const goerliScrow = await GoerliScrow.deploy();
  console.log("GoerliScrow address:", goerliScrow.address);
  tx = await goerliScrow.deployed();
  if (process.env.HARDHAT_NETWORK) {
    await tx.deployTransaction.wait(5);
  }

  // Relayer OZ address
  tx = await goerliScrow.grantRole(
    getRole("BRIDGE_CONTROLLER"),
    RELAYER_GOERLI_ADDRESS
  );
  await tx.wait();

  if (!process.env.HARDHAT_NETWORK) return;
  await hre.run("verify:verify", {
    address: goerliScrow.address,
    constructorArguments: [],
  });
}

async function execTx() {
  var tx;
  const [owner] = await ethers.getSigners();

  // 0xf4664Fc83FBf0e78ec0a64cdd6B156586E2889a0
  var goerliScrowAddress = "0xf4664Fc83FBf0e78ec0a64cdd6B156586E2889a0";
  const GoerliScrow = await ethers.getContractFactory("GoerliScrow");
  const goerliScrow = await GoerliScrow.attach(goerliScrowAddress);

  var ONE_THOUSAND = ethers.utils.parseEther("1000");
  tx = await goerliScrow.withdraw(ONE_THOUSAND);
  await tx.wait();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// main()
execTx()
  //
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });