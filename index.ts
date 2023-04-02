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
      if (!isOk) {
        await scEscrowOrigin
          .connect(signerSource)
          .rollBackFromDeposit(hashedData);
        return;
      }
      // Mark transaction as read in source chain
      tx = await scEscrowOrigin.connect(signerSource).markAsRead(hashedData);
      await tx.wait();

      // Update tokens in the other chain
      tx = await scEscrowDest
        .connect(signerDestiny)
        .increaseWithdraw(to, amount);
      await tx.wait();
    });
}

async function subscribeToSmartContractEvents(_net1: string, _net2: string) {
  var client = await createClient();

  var { mumbaiEscrowC, goerliEscrowC } = await getSmartContracts();

  function subscribe(escrowSC: typeof mumbaiEscrowC | typeof goerliEscrowC) {
    escrowSC.on("Deposit", async (hashedData, from, to, amount, fromChain) => {
      // Verify that transaction was not read already
      var [, , , , read]: [string, string, string, BigNumber, boolean] =
        await escrowSC.listOfTransactions(hashedData);
      console.log("read", read);
      if (read) return;

      // Send message to the topic
      let sendResponse = await new TopicMessageSubmitTransaction({
        topicId,
        message: JSON.stringify({ hashedData, from, to, amount, fromChain }),
      }).execute(client);

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

  console.log("Successfully subscrived to smart contract events");
}

subscribeToTopicHCS();
subscribeToSmartContractEvents(net1, net2)
  // createTopic()
  //
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
