import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, hardhatArguments } from "hardhat";
import { keccak256 } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  getRole,
  RELAYER_MUMBAI_ADDRESS,
  MUMBAI,
  RELAYER_GOERLI_ADDRESS,
  GOERLI,
} from "../utils";
import { MyToken } from "../typechain-types/contracts/MumbaiEscrow.sol/MyToken";
import { MumbaiEscrow } from "../typechain-types/contracts/MumbaiEscrow.sol/MumbaiEscrow";
import { GoerliEscrow } from "../typechain-types/contracts/GoerliEscrow.sol/GoerliEscrow";
import { MyTokenWrapped } from "../typechain-types/contracts/GoerliEscrow.sol/MyTokenWrapped";

const fe = (amount: number) => ethers.utils.parseEther(String(amount));

describe("Bridge Testing", function () {
  async function deployFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const MyToken = await ethers.getContractFactory("MyToken");
    const myToken = await MyToken.deploy();

    const MumbaiEscrow = await ethers.getContractFactory("MumbaiEscrow");
    const mumbaiEscrow = await MumbaiEscrow.deploy(myToken.address);

    const GoerliEscrow = await ethers.getContractFactory("GoerliEscrow");
    const goerliEscrow = await GoerliEscrow.deploy();

    const MyTokenWrapped = await ethers.getContractFactory("MyTokenWrapped");
    const myTokenWrapped = MyTokenWrapped.attach(
      await goerliEscrow.TokenWrapped()
    );

    await mumbaiEscrow.grantRole(
      getRole("BRIDGE_CONTROLLER"),
      RELAYER_MUMBAI_ADDRESS
    );

    await goerliEscrow.grantRole(
      getRole("BRIDGE_CONTROLLER"),
      RELAYER_GOERLI_ADDRESS
    );

    return {
      goerliEscrow,
      mumbaiEscrow,
      myToken,
      owner,
      alice,
      bob,
      myTokenWrapped,
    };
  }

  describe("Deposit to Mumbai Bridge", function () {
    var mumbaiEscrow: MumbaiEscrow,
      goerliEscrow: GoerliEscrow,
      myToken: MyToken,
      owner: SignerWithAddress,
      alice: SignerWithAddress,
      bob: SignerWithAddress;
    var hashedData: string;
    var tx: any;

    beforeEach(async () => {
      var data = await loadFixture(deployFixture);
      mumbaiEscrow = data.mumbaiEscrow;
      myToken = data.myToken;
      owner = data.owner;
      alice = data.alice;
      bob = data.bob;

      await myToken.approve(mumbaiEscrow.address, ethers.constants.MaxUint256);
      tx = await mumbaiEscrow.depositForBridge(owner.address, fe(10_000));
      hashedData = keccak256(
        ethers.utils.solidityPack(
          ["address", "address", "uint256", "uint256"],
          [owner.address, owner.address, fe(10_000), await time.latest()]
        )
      );
    });

    it("Should fire the event 'Deposit'", async function () {
      await expect(tx)
        .to.emit(mumbaiEscrow, "Deposit")
        .withArgs(hashedData, owner.address, owner.address, fe(10_000), MUMBAI);
    });

    it("Should store the hashed data in 'listOfTransactions'", async function () {
      var [from, to, amount, , read] = await mumbaiEscrow.listOfTransactions(
        hashedData
      );
      expect(from).to.equal(owner.address);
      expect(to).to.equal(owner.address);
      expect(amount).to.equal(fe(10_000));
      expect(read).to.be.false;
    });

    it("Should fail if user didn't approve", async function () {
      await myToken.connect(owner).transfer(alice.address, fe(10_000));
      await expect(
        mumbaiEscrow.connect(alice).depositForBridge(alice.address, fe(10_000))
      ).to.be.rejectedWith("ERC20: insufficient allowance");
    });

    it("Should fail if user does not have enough tokens", async function () {
      await myToken.connect(bob).approve(mumbaiEscrow.address, fe(10_000));
      await expect(
        mumbaiEscrow.connect(bob).depositForBridge(alice.address, fe(10_000))
      ).to.be.rejectedWith("ERC20: transfer amount exceeds balance");
    });

    it("Should transfer tokens from caller to smart contract", async function () {
      await myToken.connect(owner).transfer(bob.address, fe(10_000));
      await myToken.connect(bob).approve(mumbaiEscrow.address, fe(10_000));

      await expect(() =>
        mumbaiEscrow.connect(bob).depositForBridge(bob.address, fe(10_000))
      ).to.changeTokenBalances(
        myToken,
        [bob.address, mumbaiEscrow.address],
        [fe(10_000).mul(-1), fe(10_000)]
      );
    });

    it("Should mark the transaction as read", async function () {
      await mumbaiEscrow.markAsRead(hashedData);
      var [, , , , read] = await mumbaiEscrow.listOfTransactions(hashedData);
      expect(read).to.be.true;
    });
  });

  describe("Rollback in Mumbai", function () {
    var mumbaiEscrow: MumbaiEscrow,
      goerliEscrow: GoerliEscrow,
      myToken: MyToken,
      owner: SignerWithAddress,
      alice: SignerWithAddress,
      bob: SignerWithAddress;
    var hashedData: string;
    var tx: any;

    beforeEach(async () => {
      var data = await loadFixture(deployFixture);
      mumbaiEscrow = data.mumbaiEscrow;
      myToken = data.myToken;
      owner = data.owner;
      alice = data.alice;
      bob = data.bob;

      await myToken.approve(mumbaiEscrow.address, ethers.constants.MaxUint256);
      tx = await mumbaiEscrow.depositForBridge(owner.address, fe(10_000));
      hashedData = keccak256(
        ethers.utils.solidityPack(
          ["address", "address", "uint256", "uint256"],
          [owner.address, owner.address, fe(10_000), await time.latest()]
        )
      );
      tx = mumbaiEscrow.rollBackFromDeposit(hashedData);
    });

    it("Should fail if the transaction is not found", async function () {
      var randomHashedData = keccak256(
        ethers.utils.solidityPack(["address"], [bob.address])
      );
      await expect(
        mumbaiEscrow.rollBackFromDeposit(randomHashedData)
      ).to.be.revertedWith("Transaction not found");
    });

    it("Should remove transaction from History", async function () {
      var [from, to, amount, timestamp, read] =
        await mumbaiEscrow.listOfTransactions(hashedData);
      expect(from).to.equal(ethers.constants.AddressZero);
      expect(to).to.equal(ethers.constants.AddressZero);
      expect(amount).to.equal(0);
      expect(timestamp).to.equal(0);
      expect(read).to.be.false;
    });

    it("Should revert token transfers", async function () {
      await expect(tx).to.changeTokenBalances(
        myToken,
        [owner.address, mumbaiEscrow.address],
        [fe(10_000), fe(10_000).mul(-1)]
      );
    });

    it("Should emit event Rollback", async function () {
      await expect(tx)
        .to.emit(mumbaiEscrow, "Rollback")
        .withArgs(owner.address, fe(10_000));
    });
  });

  describe("Withdraw in Goerli", function () {
    var mumbaiEscrow: MumbaiEscrow,
      goerliEscrow: GoerliEscrow,
      myToken: MyToken,
      myTokenWrapped: MyTokenWrapped,
      owner: SignerWithAddress,
      alice: SignerWithAddress,
      bob: SignerWithAddress;
    var hashedData: string;
    var tx: any;

    beforeEach(async () => {
      var data = await loadFixture(deployFixture);
      mumbaiEscrow = data.mumbaiEscrow;
      goerliEscrow = data.goerliEscrow;
      myToken = data.myToken;
      myTokenWrapped = data.myTokenWrapped;
      owner = data.owner;
      alice = data.alice;
      bob = data.bob;

      tx = await goerliEscrow
        .connect(owner)
        .increaseWithdraw(alice.address, fe(10_000));
    });

    it("Fire ForWithdraw event", async function () {
      await expect(tx)
        .to.emit(goerliEscrow, "ForWithdraw")
        .withArgs(alice.address, fe(10_000));
    });

    it("Should increase withdraw amount", async function () {
      var amount = await goerliEscrow.totalToWihdraw(alice.address);
      expect(amount).to.equal(fe(10_000));
    });

    it("Should fail if user does not have tokns to withdraw", async function () {
      await expect(
        goerliEscrow.connect(bob).withdraw(fe(10_000))
      ).to.be.revertedWith("Not enough funds to withdraw");
    });

    it("Should fire 'Withdraw' event when user withdraws", async function () {
      tx = await goerliEscrow.connect(alice).withdraw(fe(10_000));
      await expect(tx)
        .to.emit(goerliEscrow, "Withdraw")
        .withArgs(alice.address, fe(10_000));
    });

    it("Should mint WrappedTokens to a user", async function () {
      tx = await goerliEscrow.connect(alice).withdraw(fe(10_000));
      await expect(tx).to.changeTokenBalance(
        myTokenWrapped,
        alice.address,
        fe(10_000)
      );
    });

    it("Should decrease withdraw amount to 0 after minting", async function () {
      await goerliEscrow.connect(alice).withdraw(fe(10_000));
      var amount = await goerliEscrow.totalToWihdraw(alice.address);
      expect(amount).to.equal(0);
    });
  });

  describe("Deposit to Goerli Bridge", function () {
    var mumbaiEscrow: MumbaiEscrow,
      goerliEscrow: GoerliEscrow,
      myToken: MyToken,
      myTokenWrapped: MyTokenWrapped,
      owner: SignerWithAddress,
      alice: SignerWithAddress,
      bob: SignerWithAddress;
    var hashedData: string;
    var tx: any;

    beforeEach(async () => {
      var data = await loadFixture(deployFixture);
      mumbaiEscrow = data.mumbaiEscrow;
      goerliEscrow = data.goerliEscrow;
      myToken = data.myToken;
      myTokenWrapped = data.myTokenWrapped;
      owner = data.owner;
      alice = data.alice;
      bob = data.bob;

      await goerliEscrow.increaseWithdraw(alice.address, fe(10_000));
      await goerliEscrow.connect(alice).withdraw(fe(10_000));
      tx = await goerliEscrow
        .connect(alice)
        .depositForBridge(alice.address, fe(10_000));

      hashedData = keccak256(
        ethers.utils.solidityPack(
          ["address", "address", "uint256", "uint256"],
          [alice.address, alice.address, fe(10_000), await time.latest()]
        )
      );
    });

    it("Should burn tokens when depositing to Goerli Bridge", async function () {
      await expect(tx).to.changeTokenBalance(
        myTokenWrapped,
        alice.address,
        fe(10_000).mul(-1)
      );
    });

    it("Should fire the event 'Deposit'", async function () {
      await expect(tx)
        .to.emit(goerliEscrow, "Deposit")
        .withArgs(hashedData, alice.address, alice.address, fe(10_000), GOERLI);
    });

    it("Should store the hashed data in 'listOfTransactions'", async function () {
      var [from, to, amount, , read] = await goerliEscrow.listOfTransactions(
        hashedData
      );
      expect(from).to.equal(alice.address);
      expect(to).to.equal(alice.address);
      expect(amount).to.equal(fe(10_000));
      expect(read).to.be.false;
    });

    it("Should fail if user does not have enough tokens", async function () {
      await expect(
        goerliEscrow.connect(bob).depositForBridge(bob.address, fe(10_000))
      ).to.be.rejectedWith("ERC20: burn amount exceeds balance");
    });

    it("Should mark the transaction as read", async function () {
      await goerliEscrow.markAsRead(hashedData);
      var [, , , , read] = await goerliEscrow.listOfTransactions(hashedData);
      expect(read).to.be.true;
    });
  });

  describe("Rollback in Goerli", function () {
    var mumbaiEscrow: MumbaiEscrow,
      goerliEscrow: GoerliEscrow,
      myToken: MyToken,
      myTokenWrapped: MyTokenWrapped,
      owner: SignerWithAddress,
      alice: SignerWithAddress,
      bob: SignerWithAddress;
    var hashedData: string;
    var tx: any;

    beforeEach(async () => {
      var data = await loadFixture(deployFixture);
      goerliEscrow = data.goerliEscrow;
      myToken = data.myToken;
      myTokenWrapped = data.myTokenWrapped;
      owner = data.owner;
      alice = data.alice;
      bob = data.bob;

      await goerliEscrow.increaseWithdraw(alice.address, fe(10_000));
      await goerliEscrow.connect(alice).withdraw(fe(10_000));
      tx = await goerliEscrow
        .connect(alice)
        .depositForBridge(alice.address, fe(10_000));

      hashedData = keccak256(
        ethers.utils.solidityPack(
          ["address", "address", "uint256", "uint256"],
          [alice.address, alice.address, fe(10_000), await time.latest()]
        )
      );
      tx = goerliEscrow.rollBackFromDeposit(hashedData);
    });

    it("Should fail if the transaction is not found", async function () {
      var randomHashedData = keccak256(
        ethers.utils.solidityPack(["address"], [bob.address])
      );
      await expect(
        goerliEscrow.rollBackFromDeposit(randomHashedData)
      ).to.be.revertedWith("Transaction not found");
    });

    it("Should remove transaction from History", async function () {
      var [from, to, amount, timestamp, read] =
        await goerliEscrow.listOfTransactions(hashedData);
      expect(from).to.equal(ethers.constants.AddressZero);
      expect(to).to.equal(ethers.constants.AddressZero);
      expect(amount).to.equal(0);
      expect(timestamp).to.equal(0);
      expect(read).to.be.false;
    });

    it("Should revert token burn", async function () {
      await expect(tx).to.changeTokenBalance(
        myTokenWrapped,
        alice.address,
        fe(10_000)
      );
    });

    it("Should emit event Rollback", async function () {
      await expect(tx)
        .to.emit(goerliEscrow, "Rollback")
        .withArgs(alice.address, fe(10_000));
    });
  });

  describe("Withdraw in Mumbai", function () {
    var mumbaiEscrow: MumbaiEscrow,
      goerliEscrow: GoerliEscrow,
      myToken: MyToken,
      myTokenWrapped: MyTokenWrapped,
      owner: SignerWithAddress,
      alice: SignerWithAddress,
      bob: SignerWithAddress;
    var hashedData: string;
    var tx: any;

    beforeEach(async () => {
      var data = await loadFixture(deployFixture);
      mumbaiEscrow = data.mumbaiEscrow;
      goerliEscrow = data.goerliEscrow;
      myToken = data.myToken;
      myTokenWrapped = data.myTokenWrapped;
      owner = data.owner;
      alice = data.alice;
      bob = data.bob;

      await myToken.transfer(bob.address, fe(10_000));
      await myToken.connect(bob).approve(mumbaiEscrow.address, fe(10_000));
      await mumbaiEscrow.connect(bob).depositForBridge(bob.address, fe(10_000));
      tx = await mumbaiEscrow.increaseWithdraw(bob.address, fe(10_000));
    });

    it("Fire ForWithdraw event", async function () {
      await expect(tx)
        .to.emit(mumbaiEscrow, "ForWithdraw")
        .withArgs(bob.address, fe(10_000));
    });

    it("Should increase withdraw amount", async function () {
      var amount = await mumbaiEscrow.totalToWihdraw(bob.address);
      expect(amount).to.equal(fe(10_000));
    });

    it("Should fail if user does not have tokns to withdraw", async function () {
      await expect(
        mumbaiEscrow.connect(alice).withdraw(fe(10_000))
      ).to.be.revertedWith("Not enough funds to withdraw");
    });

    it("Should fire 'Withdraw' event when user withdraws", async function () {
      tx = await mumbaiEscrow.connect(bob).withdraw(fe(10_000));
      await expect(tx)
        .to.emit(mumbaiEscrow, "Withdraw")
        .withArgs(bob.address, fe(10_000));
    });

    it("Should transfer tokens to a user", async function () {
      tx = await mumbaiEscrow.connect(bob).withdraw(fe(10_000));
      await expect(tx).to.changeTokenBalances(
        myToken,
        [bob.address, mumbaiEscrow.address],
        [fe(10_000), fe(10_000).mul(-1)]
      );
    });

    it("Should decrease withdraw amount to 0 after minting", async function () {
      await mumbaiEscrow.connect(bob).withdraw(fe(10_000));
      var amount = await mumbaiEscrow.totalToWihdraw(bob.address);
      expect(amount).to.equal(0);
    });
  });
});
