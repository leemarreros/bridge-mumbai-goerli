import hre from "hardhat";
import { ethers } from "hardhat";
import { getRole, RELAYER_MUMBAI_ADDRESS } from "../utils";

async function main() {
  var tx;

  const MyToken = await ethers.getContractFactory("MyToken");
  const myToken = await MyToken.deploy();
  console.log("MyToken address:", myToken.address);
  tx = await myToken.deployed();

  if (process.env.HARDHAT_NETWORK == "mumbai") {
    await tx.deployTransaction.wait(5);
  }

  const MumbaiEscrow = await ethers.getContractFactory("MumbaiEscrow");
  const mumbaiScrow = await MumbaiEscrow.deploy(myToken.address);
  console.log("MumbaiEscrow address:", mumbaiScrow.address);
  tx = await mumbaiScrow.deployed();

  if (process.env.HARDHAT_NETWORK == "mumbai") {
    await tx.deployTransaction.wait(5);
  }

  // Relayer OZ address
  tx = await mumbaiScrow.grantRole(
    getRole("BRIDGE_CONTROLLER"),
    RELAYER_MUMBAI_ADDRESS
  );
  await tx.wait();

  if (process.env.HARDHAT_NETWORK != "mumbai") return;
  await hre.run("verify:verify", {
    address: mumbaiScrow.address,
    constructorArguments: [myToken.address],
  });

  await hre.run("verify:verify", {
    contract: "contracts/MumbaiEscrow.sol:MyToken",
    address: myToken.address,
    constructorArguments: [],
  });
}

async function depositForBridge() {
  const [owner] = await ethers.getSigners();

  var tx;

  var mumbaiScrowAdd = "0x7AC2641e8C80D974f61af4D893c987B09CA0c812";
  const MumbaiEscrow = await ethers.getContractFactory("MumbaiEscrow");
  const mumbaiScrow = await MumbaiEscrow.attach(mumbaiScrowAdd);

  var tokenAddress = "0x182e51b8613c49247B4715fBD5330DC9FdfECbA3";
  const MyToken = await ethers.getContractFactory("MyToken");
  const myToken = await MyToken.attach(tokenAddress);

  tx = await myToken.approve(mumbaiScrow.address, ethers.constants.MaxUint256);
  await tx.wait();

  tx = await mumbaiScrow.depositForBridge(
    owner.address,
    ethers.utils.parseEther("1000")
  );
  await tx.wait();
}

/**
 * 
Console set up (npx hardhat console --network net2):

var signer = await ethers.getSigner() 
const MumbaiTokenAdd = "0x80fF639CB6C9eF60DCf161977365704AAef5d089";
const MumbaiToken = await ethers.getContractFactory("MyToken");
const MumbaiTokenC = await MumbaiToken.attach(MumbaiTokenAdd)

const MumbaiEscrowAdd = "0xa676115C4C3c9Ab9b1Bd9Ed1Ca035A8F51E24bc3";
const MumbaiEscrow = await ethers.getContractFactory("MumbaiEscrow");
const MumbaiEscrowC = MumbaiEscrow.attach(MumbaiEscrowAdd);

await MumbaiTokenC.approve(MumbaiEscrowC.address, ethers.utils.parseEther("1000000"))
await MumbaiEscrowC.depositForBridge(signer.address, ethers.utils.parseEther("100"))

await MumbaiEscrowC.withdraw(ethers.utils.parseEther("100"))
*/

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  // depositForBridge()
  //
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
