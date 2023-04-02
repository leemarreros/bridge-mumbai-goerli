import hre from "hardhat";
import { ethers } from "hardhat";

import { getRole, RELAYER_GOERLI_ADDRESS } from "../utils";

async function main() {
  var tx;

  const GoerliEscrow = await ethers.getContractFactory("GoerliEscrow");
  const goerliScrow = await GoerliEscrow.deploy();
  console.log("GoerliEscrow address:", goerliScrow.address);
  tx = await goerliScrow.deployed();
  if (process.env.HARDHAT_NETWORK == "goerli") {
    await tx.deployTransaction.wait(5);
  }

  // Relayer OZ address
  tx = await goerliScrow.grantRole(
    getRole("BRIDGE_CONTROLLER"),
    RELAYER_GOERLI_ADDRESS
  );
  await tx.wait();

  if (process.env.HARDHAT_NETWORK != "goerli") return;
  await hre.run("verify:verify", {
    address: goerliScrow.address,
    constructorArguments: [],
  });
}

async function withdraw() {
  var tx;
  const [owner] = await ethers.getSigners();

  // 0xf4664Fc83FBf0e78ec0a64cdd6B156586E2889a0
  var goerliScrowAddress = "0xf4664Fc83FBf0e78ec0a64cdd6B156586E2889a0";
  const GoerliEscrow = await ethers.getContractFactory("GoerliEscrow");
  const goerliScrow = await GoerliEscrow.attach(goerliScrowAddress);

  var ONE_THOUSAND = ethers.utils.parseEther("1000");
  tx = await goerliScrow.withdraw(ONE_THOUSAND);
  await tx.wait();
}

async function depositForBridge() {
  var tx;
  const [owner] = await ethers.getSigners();

  // 0xf4664Fc83FBf0e78ec0a64cdd6B156586E2889a0
  var goerliScrowAddress = "0xf4664Fc83FBf0e78ec0a64cdd6B156586E2889a0";
  const GoerliEscrow = await ethers.getContractFactory("GoerliEscrow");
  const goerliScrow = await GoerliEscrow.attach(goerliScrowAddress);

  var ONE_THOUSAND = ethers.utils.parseEther("1000");
  tx = await goerliScrow.depositForBridge(owner.address, ONE_THOUSAND);
  await tx.wait();
}

/**
 * 
Console set up (npx hardhat console --network net1):

var signer = await ethers.getSigner() 
const GoerliEscrowAdd = "0xb3266C22e6298dcC1c375DebDA36e7560fEf3E73";
const GoerliEscrow = await ethers.getContractFactory("GoerliEscrow");
const GoerliEscrowC = GoerliEscrow.attach(GoerliEscrowAdd);

await GoerliEscrowC.fireEvent()
await GoerliEscrowC.withdraw(ethers.utils.parseEther("100"))
await GoerliEscrowC.depositForBridge(signer.address, ethers.utils.parseEther("100"))

const MyTokenWrappedAdd = await GoerliEscrowC.TokenWrapped();
const MyTokenWrapped = await ethers.getContractFactory("MyTokenWrapped");
const MyTokenWrappedC = MyTokenWrapped.attach(MyTokenWrappedAdd);

console.log(await MyTokenWrappedC.balanceOf(signer.address));
*/

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  // withdraw()
  // depositForBridge()
  //
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
