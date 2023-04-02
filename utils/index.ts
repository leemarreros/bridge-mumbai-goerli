import "dotenv/config";
import { ethers, BigNumber, Wallet, providers } from "ethers";

import {
  DefenderRelaySigner,
  DefenderRelayProvider,
} from "defender-relay-client/lib/ethers";

import { Client, TopicCreateTransaction, TopicMessage } from "@hashgraph/sdk";

import { abi as goerliEscrowAbi } from "../artifacts/contracts/GoerliEscrow.sol/GoerliEscrow.json";
import { abi as mumbaiEscrowAbi } from "../artifacts/contracts/MumbaiEscrow.sol/MumbaiEscrow.json";
import { abi as mumbaiTokenAbi } from "../artifacts/contracts/MumbaiEscrow.sol/MyToken.json";

const {
  ADMIN_ACCOUNT_PRIVATE_KEY,
  HARDHAT_NETWORK,
  RELAYER_MUMBAI_API_KEY,
  RELAYER_MUMBAI_SECRET_KEY,
  RELAYER_GOERLI_API_KEY,
  RELAYER_GOERLI_SECRET_KEY,
  MY_ACCOUNT_ID,
  MY_PRIVATE_KEY,
  MUMBAI_TESNET_URL,
  GOERLI_TESNET_URL,
} = process.env;

// topicId created in Hedera
export var topicId = "0.0.3957446";

// goerli escrow address
var goerliEscrowAdd = "0xb3266C22e6298dcC1c375DebDA36e7560fEf3E73";
// mumbai token add
var mumbaiTokenAdd = "0x80fF639CB6C9eF60DCf161977365704AAef5d089";
// mumbai escrow address
var mumbaiEscrowAdd = "0xa676115C4C3c9Ab9b1Bd9Ed1Ca035A8F51E24bc3";

export var net1: string; // Goerli
export var net2: string; // Mumbai

var testnet = process.argv[process.argv.length - 1] == "testnet";
console.log("testnet", testnet);

if (HARDHAT_NETWORK == "mumbai" || HARDHAT_NETWORK == "goerli" || testnet) {
  net1 = GOERLI_TESNET_URL || "";
  net2 = MUMBAI_TESNET_URL || "";
} else {
  net1 = "http://127.0.0.1:8541/"; // Goerli
  net2 = "http://127.0.0.1:8542/"; // Mumbai
}

export function getRole(role: string) {
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(role));
}

export const MUMBAI = getRole("MUMBAI");
export const GOERLI = getRole("GOERLI");

function createSignerRelayer(apiKey: string = "", apiSecret: string = "") {
  const credentials = {
    apiKey,
    apiSecret,
  };
  const provider = new DefenderRelayProvider(credentials);
  return new DefenderRelaySigner(credentials, provider, {
    speed: "fast",
  });
}

export let RELAYER_MUMBAI_ADDRESS: string =
  "0x322c24a1a7d6fdc593482099b69df13ecc912e41";
export let RELAYER_GOERLI_ADDRESS: string =
  "0x9955c2aa49c6a378e7ff94730d53f32239409a17";

export let signerMumbai: DefenderRelaySigner | Wallet;
export let signerGoerli: DefenderRelaySigner | Wallet;

if (HARDHAT_NETWORK == "mumbai" || HARDHAT_NETWORK == "goerli" || testnet) {
  // Relayer Mumbai
  signerMumbai = createSignerRelayer(
    RELAYER_MUMBAI_API_KEY,
    RELAYER_MUMBAI_SECRET_KEY
  );
  // Relayer Goerli
  signerGoerli = createSignerRelayer(
    RELAYER_GOERLI_API_KEY,
    RELAYER_GOERLI_SECRET_KEY
  );
} else {
  var providerNet1 = new providers.JsonRpcProvider(net1);
  var providerNet2 = new providers.JsonRpcProvider(net2);

  signerMumbai = new Wallet(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    providerNet1
  );
  signerGoerli = new Wallet(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    providerNet2
  );

  RELAYER_MUMBAI_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  RELAYER_GOERLI_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
}

export async function createClient() {
  // If we weren't able to grab it, we should throw a new error
  if (!MY_ACCOUNT_ID || !MY_PRIVATE_KEY) {
    throw new Error(
      "Environment variables MY_ACCOUNT_ID and MY_PRIVATE_KEY must be present"
    );
  }

  // connecting to Hedera testnet
  const client = Client.forTestnet();
  client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);
  return client;
}

export async function createTopic() {
  const client = await createClient();
  const txResponse = await new TopicCreateTransaction().execute(client);
  let receipt = await txResponse.getReceipt(client);
  let topicId = receipt.topicId;
  console.log("The new topic ID is: " + topicId);
}

export async function getSmartContracts() {
  var providerNet1 = new providers.JsonRpcProvider(net1);
  var providerNet2 = new providers.JsonRpcProvider(net2);

  var signerNet1 = new Wallet(ADMIN_ACCOUNT_PRIVATE_KEY || "", providerNet1)
  var signerNet2 = new Wallet(ADMIN_ACCOUNT_PRIVATE_KEY || "", providerNet2)

  // goerli smart contract
  const goerliEscrowC = new ethers.Contract(
    goerliEscrowAdd,
    goerliEscrowAbi,
    signerNet1
  );

  // mumbai smart contract
  const mumbaiTokenC = new ethers.Contract(
    mumbaiTokenAdd,
    mumbaiTokenAbi,
    signerNet2
  );

  // mumbai escrow address
  const mumbaiEscrowC = new ethers.Contract(
    mumbaiEscrowAdd,
    mumbaiEscrowAbi,
    signerNet2
  );

  return { goerliEscrowC, mumbaiTokenC, mumbaiEscrowC, signerNet1, signerNet2 };
}

export async function verifyTransaction(
  message: TopicMessage,
  scEscrow: any
): Promise<boolean> {
  let { hashedData, from, to, amount } = JSON.parse(
    message.contents.toString()
  );
  amount = ethers.BigNumber.from(amount);

  var dataSmartContract = await scEscrow.listOfTransactions(hashedData);
  var [fromSC, toSC, amountSC] = dataSmartContract;

  if (from == fromSC && to == toSC && amount.eq(amountSC)) return true;
  return false;
}
