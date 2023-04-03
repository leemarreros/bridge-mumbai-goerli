## The creation of a bridge between Mumbai and Goerli testnets

**What is a bridge good for?**

​	Tipically, blockchains work in isolations from other chains. They were not built to share information and assets between them. For that reason, bridges are built. A bridge is another layer that sits in between two chains to facilitate information and asset transfers. There are several ways to build bridge. At least we could find two types of them: decentralized and centralized bridges.

We'll exlpore both kind of bridges. Each of them requires a different technological stack as well as advantages and disadvantages.

**Centralized bridge**

​	In this particular case the middleware works like a blackbox. Users are not allowed to neither audit nor observe what happens in between. The middleware is able to listen to `Deposit` events whenever a user initiates a token transfer from one side of the chain. After the event is picked up, the middleware connects to the other chain to `mint` the same amount of tokens on destination chain. This process happens back and forth between chains.

​	The middleware becomes a centralized software to which the admin has full control. It certainly has all the vulnerabilities of centarlized systems. Let's explore how a centralized bridge could be built

<u>Tech Stack</u>

We'll need the following five elements to create a centralized bridge:

	* Smart contract Escrow in Mumbai
	* Smart contract Escrow in Goerli
	* 2 Sentinels (Open Zeppelin Defender), one for each chain
	* 2 Autotasks (Open Zeppelin Defender), one for each chain
	* Relayer in Mumbai (Open Zeppelin Defender)
	* Relayer in Goerli (Open Zeppelin Defender)

We'll recreate the flow for one particular user that wants to send his tokens from `Mumbai` to `Goerli` by using this bridge. It involves the followint steps:

<u>1 - Smart contract Escrow in Mumbai</u> 

​	The following method `depositForBridge` will be called by a user that wants to bridge their tokens from `Mumbai` to `Goerli`. Basically, the smart contracts transfers the user's token to the smart contract `MumbaiEscro` that will keep and accumulate the tokens.

​	Only the event `Deposit` is required to be fired since this event will be heard by `Sentinel` from `Open Zeppelin Defender` (OZD).

```solidity
contract MumbaiEscrow is AccessControl {
		// ...

    function depositForBridge(address _to, uint256 _amount) external {
        bool success = Token.transferFrom(msg.sender, address(this), _amount);
        require(success, "Transfer failed");

        emit Deposit(_to, _amount);
    }

    // ...
}
```

<u>2 - Sentinel (OZD)</u>

​	A `sentinel` from OZD is a mechanism to listen events being fired by a particular smart contract in a particular chain (e.g. `Mumbai`, `Goerli`). To build this feature, you instruct the `sentinel` to listen to a particular smart contract and a particular event from this smart contract. Additionally, and optionally, a script could be fired right after the event is heard by sentinel. This last mechanism is called `autotask` in OZD.

​	To finish the set up of a sentinel, first the `MumbaiEscrow` is deployed and verified. Then, the address of it goes as input to create the `sentinel` in OZD. Also, The `sentinel` receives the instruction to listens to `Deposit` events whenever they happen in `MumbaiEscrow` smart contract. Finally, the `sentinel` fires an script (`autotask`) that finishes the mint of tokens on the other side of the chain.

​	This is how a set up of a `sentinel` looks like in OZD. Note that there is a smart contract address, the network in which the smart contract has been deployed, the event to be heard and, finally, the autotask to be triggered whenever the event is heard.

![image-20230402193230265](https://user-images.githubusercontent.com/3300958/229422359-c02a037c-8c41-4307-afb9-26d213552f9e.png)

<u>3 - Autotask</u>

​	`Autotask` in OZD is a script that is triggerd on demand by using a web hook or a `sentinel`. This particular `autotask` has been configured in a way that receives (from the `sentinel`) the arguments from the event `Deposit(address indexed from, uint256 amount)`  and communicates with the destination chain for minting the wrapped tokens.

​	There are at least four steps in this `autotask` script:

1. Connects to a relayer (a wallet with privileges) in Goerli 
2. Filter the event 'Deposit' and reads its arguments 'from' and 'amount'
3. Connects to Goerli's Escrow Smart Contract
4. Increase amount to withdraw for the receiver user

​	Let's see the script of this `autotask` where each step is pointed out: 

```javascript
const { ethers } = require("ethers");
const {
    DefenderRelaySigner,
    DefenderRelayProvider,
} = require("defender-relay-client/lib/ethers");

exports.handler = async function(data) {
    const payload = data.request.body.events;

  	// 1 - Connects to a relayer
    const provider = new DefenderRelayProvider(data);
    const signer = new DefenderRelaySigner(data, provider, { speed: "fast" });
    
  	// 2 - Filters the event 'Deposit' and reads its arguments 'from' and 'amount'
  	var onlyEvents = payload[0].matchReasons.filter((e) => e.type === "event");
  	if (onlyEvents.length === 0) return;
  	var event = onlyEvents.filter( ev => ev.signature.includes("Deposit"));
  	var {from, amount} = event[0].params;

	  // 3 - Connects to Goerli's Escrow Smart Contract
  	var escrowAddress = "0xf4664Fc83FBf0e78ec0a64cdd6B156586E2889a0";
    var escrowAbi = ["function increaseWithdraw(address _to, uint256 _amount)"];
    var escrowContract = new ethers.Contract(escrowAddress, escrowAbi, signer);
  
  	// 4 - Increase amount to withdraw for the receiver user
  	var tx = await escrowContract.increaseWithdraw(from, amount);
    var res = await tx.wait();
    return res;
}
```

<u>4 - Relayer in Goerli</u>

​	A `relayer` in OZD functions as a wallet that is able to trigger smart contract methods by using, usually, a role or a privilege. This wallet plays an admin role. A `relayer` need to be created and set up prior using it. This is how it looks the configuration of the `relayer` that will help us to finish the minting:

![image-20230402201339670](https://user-images.githubusercontent.com/3300958/229422364-2f208445-80d1-4294-a313-c46568a6bb0d.png)

​	For this particular case, the relayer has the privilege to increase the amount to be minted in the `Goerli` chain. The `relayer` is injected in the `autotask` script and triggers a method called `increaseWithdraw` in the destination chain. This method belongs to `GoerliEscrow` smart contract who is in charge of minting the wrapped tokens on the others side of the chain.

<u>5 - Escrow Smart Contract in Goerli</u>

​	The `GoerliEscrow` smart contract on the detination chain has a method that increase the amount to be minted for a particular user. This method called `increaseWithdraw` is only and exclusively called by the `relayer` since this method is protected and looks like this:

```solidity
contract GoerliEscrow is AccessControl {
		// ...
		
    function increaseWithdraw(
        address _to,
        uint256 _amount
    ) external onlyRole(BRIDGE_CONTROLLER) {
        _totalToWihdraw[_to] += _amount;
        emit ForWithdraw(_to, _amount);
    }

    function withdraw(uint256 _amount) external {
        require(
            _totalToWihdraw[msg.sender] >= _amount,
            "Not enough funds to withdraw"
        );
        unchecked {
            _totalToWihdraw[msg.sender] -= _amount;
        }
        TokenWrapped.mint(msg.sender, _amount);
        emit Withdraw(msg.sender, _amount);
    }
    
		// ...
}
```

​	After the method `increaseWithdraw` is fired, the user has a positive balance to be withdrawn to his favor. By using the method `withdraw` the user will mint the wrapped tokens and the cross-chain transferred would be completed.

​	On purpose, the withdrawn of tokens is separated in two steps. First a positive balances is created for the user and then the user withdraws that balance. This follows the `pull` pattern for receiving tokens. Basically, it adds another set of checkings prior the user receiving the cross-chain token transfer.

​	The cross-chain token transfer could also happen in reverse going from `Goerli` to `Mumbai`. For a better understanding the methods to go back to the source chain are called the same and the process is quite similar.

​	For reviewing the full code of the centralized bridge go [here](https://github.com/steveleec/bridge-mumbai-goerli/tree/openzeppelin).

**Decentralized bridge**

​	A decentralized bridge adds a way to make the transactions (passing through the middleware) public, visible, auditable and traceable. To achieve this, a Consensus Messaging layer is added for submitting the transactions happening in the source chain. Once a transaction is submitted to the Consensus Messaging service it gets approved by a group of nodes. It means that transaction gets validated and, on top of that, several clients could also listen anything that happens in between. That creates the chance for any client to prevent any fraud before minting the tokens on the destination chain.

​	Creating a decentarlized bridge adds more complexity to the middleware. In the centrlized bridge case, there was no need for having a backend that process the transactions thanks to Open Zeppelin Defender. OZD offered a backend on demand. However, a decentralized bridge requires to build our middleware from scratch. This middleware will integrate both smart contracts (from `Mumbai` and `Goerli`), the backend client, the Consensus Messaging service and the `relayer` . 

​	Let's discuss the stack required:

 * Smart contract Escrow in Mumbai
 * Smart contract Escrow in Goerli
 * Backend client
 * Consensus Messaging service (Hedera Consensus Service)
 * Relayer in Mumbai (Open Zeppelin Defender)
 * Relayer in Goerli (Open Zeppelin Defender)

Let's focus on what's different and the most important: the backend client

<u>Backend client</u>

​	It runs a script that helps to integrate all the other parts of the stack. In escence does the following in this particular order:

1. A user wants to transfer tokens from `Mumbai` to `Goerli` by calling the method `depositForBridge` from `MumbaiEscrow` smart contract. For this, the event `Deposit` is fired:

   ```solidity
   event Deposit(
       bytes32 hashedData,
       address indexed from,
       address indexed to,
       uint256 amount,
       bytes32 indexed fromChain
   );
   ```

2. The backend client is subscribed to the event `Deposit`. That's achieved by using an RPC connection to `Mumbai` and creating an instance of `MumbaiEscrow` smart contract by using hardhat. 

   ```javascript
   // net1 is the RPC link from any provider (Alchemy, Infura, etc.)
   var providerNet1 = new providers.JsonRpcProvider(net1);
   
   // mumbai smart contract
   const mumbaiTokenC = new ethers.Contract(
     mumbaiTokenAdd,
     mumbaiTokenAbi,
     signerNet2
   );
   
   escrowSC.on("Deposit", async (hashedData, from, to, amount, fromChain) //...
   ```

3. Each transaction is hashed for preventing the replay attack. Before proceding, by using the `hashedData` we could ask the smart contract to help us to verify whether a transaction has been processed or not. If that transaction was `read`, then it stops.

   ```javascript
   var [, , , , read] = await escrowSC.listOfTransactions(hashedData);
   if (read) return;
   ```

4. If a transaction is being processed by the first time, we submit it to the Consensus Messaging service from Hedera Consensus Service. For this, it was required that we previously create a `topicId` to which all transactions will be messaged to:

   ```javascript
   // Send message to the topic
   // hashedData - the transaction in hash form 
   // from - the user cross transferring tokens
   // to - the receiving user
   // amount - amount of tokens
   // fromChain - source chain
   let sendResponse = await new TopicMessageSubmitTransaction({
     topicId,
     message: JSON.stringify({ hashedData, from, to, amount, fromChain }),
   }).execute(client);
   ```

5. After a message is passed to HCS, any subscribed client will be able to listen to that information to perform additional checks (if necessary). Let's see how the subscription to a topic happens:

   ```javascript
   var client = await createClient();
   new TopicMessageQuery()
     .setTopicId(topicId)
     .subscribe(client, null, async (message) => {
   // ...
   ```

   The variable `message` will have all the information passed within `TopicMessageSubmitTransaction`. Also, let's keep in mind that all messages within HCS gets recorded and can be extracted later for further analysis.

6. Once the `message` is received, we could add checks to prevent attacks or frauds. For this particular case, we are checking whether the information sent from the smart contract has not been corrupted.

   ```javascript
   // Make verifications about the transaction
   // Rollback if needed
   const isOk = await verifyTransaction(message, scEscrowOrigin);
   
   // utils.js
   export async function verifyTransaction(message, scEscrow) {
     let { hashedData, from, to, amount } = JSON.parse(
       message.contents.toString()
     );
   	// ...
     var [fromSC, toSC, amountSC] = dataSmartContract;
   
     if (from == fromSC && to == toSC && amount.eq(amountSC)) return true;
     return false;
   }
   ```

   We compared the information saved in the smart contract agains the information passed to HCS.

7. In case that the transaction verification fails, the initiated transfer gets reverted and the user receives his tokens back:

   ```javascript
   // ...
   if (!isOk) {
     await scEscrowOrigin
       .connect(signerSource)
       .rollBackFromDeposit(hashedData);
     return;
   }
   // ...
   ```

8. If everything went ok in the verification process, that transaction is marked as read in the source chain. That will prevent anyone for submitting the same transaction twice (replay attack):

   ```javascript
   // Mark transaction as read in source chain
   tx = await scEscrowOrigin.connect(signerSource).markAsRead(hashedData);
   ```

9. Here the relayer from the destination chain gets into play and increases the amount to withdraw in `Goerli` chain. After this, the user will be able to withdraw the amount cross transferred.

   ```javascript
   // Update tokens in the other chain
   tx = await scEscrowDest
     .connect(signerDestiny)
     .increaseWithdraw(to, amount);
   ```

10. The user who address was used as detination address will be able to `withdraw` the tokens in Goerli by using the `withdraw` method.  Right at this moment newly wrapped tokens are minted to the user and the event `Withdraw` is fired:

    ```javascript
    function withdraw(uint256 _amount) external {
    		// ...
        TokenWrapped.mint(_msgSender(), _amount);
        emit Withdraw(_msgSender(), _amount);
    }
    ```

If the user would want to get back his tokens from the destination chain to the origin chain, he could follow the same stepts starting at `Goerli`. Methods and name events were keps similar for ease of understanding.

**Testing**

![image-20230402231757994](https://user-images.githubusercontent.com/3300958/229422367-176a0d96-b678-4230-b2c6-c155d5f2d28e.png)

**Scripts to deploy**

Deploy smart contracts in Goerli:

```bash
npx hardhat --network goerli run scripts/deployGoerli.ts 
```

Deploy smart contracts in Mumbai:

```bash
npx hardhat --network mumbai run scripts/deployMumbai.ts 
```

Run backend client

```bash
npx ts-node index.ts testnet
```

For reviewing the full code go [here](https://github.com/steveleec/bridge-mumbai-goerli/tree/hederacs).
