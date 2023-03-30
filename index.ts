require("dotenv").config();

import {
  Client,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicMessageQuery,
} from "@hashgraph/sdk";
import hre from "hardhat";
import { ethers } from "ethers";

const {
  abi: goerliEscrowAbi,
} = require("./artifacts/contracts/GoerliEscrow.sol/GoerliEscrow.json");
const {
  abi: mumbaiEscrowAbi,
} = require("./artifacts/contracts/MumbaiEscrow.sol/MumbaiEscrow.json");
const {
  abi: mumbaiTokenAbi,
} = require("./artifacts/contracts/MumbaiEscrow.sol/MyToken.json");

var topicId = "0.0.3957446";
const myAccountId = process.env.MY_ACCOUNT_ID;
const myPrivateKey = process.env.MY_PRIVATE_KEY;

async function createClient() {
  // If we weren't able to grab it, we should throw a new error
  if (!myAccountId || !myPrivateKey) {
    throw new Error(
      "Environment variables MY_ACCOUNT_ID and MY_PRIVATE_KEY must be present"
    );
  }

  // connecting to Hedera testnet
  const client = Client.forTestnet();
  client.setOperator(myAccountId, myPrivateKey);
  return client;
}

async function createTopic() {
  const client = await createClient();
  const txResponse = await new TopicCreateTransaction().execute(client);
  let receipt = await txResponse.getReceipt(client);
  let topicId = receipt.topicId;
  console.log("The new topic ID is: " + topicId);
}

async function createSmartContracts() {
  var client = await createClient();
  new TopicMessageQuery()
    .setTopicId(topicId)
    .subscribe(client, null, (message) => {
      let { from, amount } = JSON.parse(message.contents.toString());
      console.log(
        `${message.consensusTimestamp.toDate()} Received: ${from}, ${amount}`
      );
    });

  var net1 = "http://127.0.0.1:8541/"; // Goerli
  var net2 = "http://127.0.0.1:8542/"; // Mumbai

  var providerNet1 = new ethers.providers.JsonRpcProvider(net1);
  var providerNet2 = new ethers.providers.JsonRpcProvider(net2);

  var listAccounstNet1 = await providerNet1.listAccounts();
  var listAccounstNet2 = await providerNet2.listAccounts();

  var signerNet1 = providerNet1.getSigner();
  var signerNet2 = providerNet2.getSigner();

  // goerli escrow address
  var goerliEscrowAdd = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  // goerli smart contract
  const goerliEscrowC = new ethers.Contract(
    goerliEscrowAdd,
    goerliEscrowAbi,
    signerNet1
  );

  // mumbai token add
  var mumbaiTokenAdd = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  // mumbai smart contract
  const mumbaiTokenC = new ethers.Contract(
    mumbaiTokenAdd,
    mumbaiTokenAbi,
    signerNet2
  );

  // mumbai escrow address
  var mumbaiEscrowAdd = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
  const mumbaiEscrowC = new ethers.Contract(
    mumbaiEscrowAdd,
    mumbaiEscrowAbi,
    signerNet2
  );

  // Subscribe to Deposit event from MumbaiEscrow SC
  mumbaiEscrowC.on("Deposit", async (from, amount) => {
    console.log("Deposit event from", from);
    console.log("Deposit event amount", ethers.utils.formatEther(amount));

    var message = { from, amount };

    // Send message to the topic
    let sendResponse = await new TopicMessageSubmitTransaction({
      topicId: topicId,
      message: JSON.stringify(message),
    }).execute(client);

    // Get the receipt of the transaction
    const getReceipt = await sendResponse.getReceipt(client);

    // Get the status of the transaction
    const transactionStatus = getReceipt.status;
    console.log(
      "The message transaction status " + transactionStatus.toString()
    );
  });
  return;
  // Deposit tokens on Mumbai at MumbaiEscrow SC
  await mumbaiTokenC.approve(mumbaiEscrowAdd, ethers.utils.parseEther("10000"));
  await mumbaiEscrowC.depositForBridge(
    await signerNet2.getAddress(),
    ethers.utils.parseEther("10000")
  );
}

createSmartContracts()
  // createTopic()
  //
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
