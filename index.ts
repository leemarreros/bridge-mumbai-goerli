import "dotenv/config";

import {
  TopicMessageSubmitTransaction,
  TopicMessageQuery,
} from "@hashgraph/sdk";

import { BigNumber } from "ethers";

import {
  signerGoerli,
  signerMumbai,
  createClient,
  topicId,
  getSmartContracts,
  verifyTransaction,
  MUMBAI,
  net1,
  net2,
} from "./utils";

async function subscribeToTopicHCS() {
  var { mumbaiEscrowC, goerliEscrowC } = await getSmartContracts();

  var client = await createClient();
  new TopicMessageQuery()
    .setTopicId(topicId)
    .subscribe(client, null, async (message) => {
      console.log("Message received from HCS");

      var tx;
      let scEscrowOrigin, scEscrowDest, signerSource, signerDestiny;

      let { hashedData, fromChain, amount, to } = JSON.parse(
        message.contents.toString()
      );

      if (fromChain == MUMBAI) {
        scEscrowOrigin = mumbaiEscrowC;
        scEscrowDest = goerliEscrowC;
        signerSource = signerMumbai;
        signerDestiny = signerGoerli;
      } else {
        scEscrowOrigin = goerliEscrowC;
        scEscrowDest = mumbaiEscrowC;
        signerSource = signerGoerli;
        signerDestiny = signerMumbai;
      }

      // Make verifications about the transaction
      // Rollback if needed
      const isOk = await verifyTransaction(message, scEscrowOrigin);
      console.log("Transaction is verified: " + isOk);
      if (!isOk) {
        await scEscrowOrigin
          .connect(signerSource)
          .rollBackFromDeposit(hashedData);
        return;
      }
      // Mark transaction as read in source chain
      tx = await scEscrowOrigin.connect(signerSource).markAsRead(hashedData);
      console.log("Transaction is marked as read in source chain");
      await tx.wait();

      // Update tokens in the other chain
      tx = await scEscrowDest
        .connect(signerDestiny)
        .increaseWithdraw(to, amount);
      console.log("Withdraw amount increased in the other chain");
      await tx.wait();
    });
}

async function subscribeToSmartContractEvents(_net1: string, _net2: string) {
  var client = await createClient();

  var { mumbaiEscrowC, goerliEscrowC } = await getSmartContracts();

  function subscribe(escrowSC: typeof mumbaiEscrowC | typeof goerliEscrowC) {
    escrowSC.on("Deposit", async (hashedData, from, to, amount, fromChain) => {
      console.log("Deposit event listened");
      // Verify that transaction was not read already
      var [, , , , read]: [string, string, string, BigNumber, boolean] =
        await escrowSC.listOfTransactions(hashedData);

      if (read) return;

      // Send message to the topic
      let sendResponse = await new TopicMessageSubmitTransaction({
        topicId,
        message: JSON.stringify({ hashedData, from, to, amount, fromChain }),
      }).execute(client);
      console.log("Transaction is submitted to HCS");

      // Get the receipt of the transaction
      const getReceipt = await sendResponse.getReceipt(client);

      // Get the status of the transaction
      const transactionStatus = getReceipt.status;
      console.log(
        "The message transaction status " + transactionStatus.toString()
      );
    });
  }

  subscribe(goerliEscrowC);
  subscribe(mumbaiEscrowC);
}

subscribeToTopicHCS();
subscribeToSmartContractEvents(net1, net2)
  // createTopic()
  //
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
