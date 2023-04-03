## The creation of a bridge between Mumbai and Goerli testnets

Table of contents:

- What is a bridge good for?
- Centralized bridge
  - Tech stack



**What is a bridge good for?**

​	Tipically, blockchains work in isolations from other chains. They were not built to share information and assets between them. For that reason, bridges are built. A bridge is another layer that sits in between two chains to facilitate information and asset transfers. There are several ways to build bridge. At least we could find two types of them: decentralized and centralized bridges.

We'll exlpore both kind of bridges. Each of them requires a different technological stack as well as advantages and disadvantages.

**Centralized bridge**

​	In this particular case the middleware works like a blackbox. Users are not allowed to neither audit nor observe what happens in between. The middleware is able to listen to `Deposit` events whenever a user initiates a token transfer from one side of the chain. After the event is picked up, the middleware connects to the other chain to `mint` the same amount of tokens on destination chain. This process happens back and forth between chains.

​	The middleware becomes a centralized software to which the admin has full control. It certainly has all the vulnerabilities of centarlized systems. Let's explore how a centralized bridge could be built

<u>Tech Stack</u>

​	
