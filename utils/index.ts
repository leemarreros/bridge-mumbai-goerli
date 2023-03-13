import hre from "hardhat";

export function getRole(role: string) {
  return hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes(role));
}

export var RELAYER_MUMBAI_ADDRESS: string = "0x322c24a1a7d6fdc593482099b69df13ecc912e41";
export var RELAYER_GOERLI_ADDRESS: string = "0x9955c2aa49c6a378e7ff94730d53f32239409a17";