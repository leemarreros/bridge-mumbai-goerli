// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "hardhat/console.sol";

contract MumbaiEscrow is AccessControl {
    bytes32 public constant BRIDGE_CONTROLLER = keccak256("BRIDGE_CONTROLLER");
    bytes32 public constant MUMBAI = keccak256("MUMBAI");

    MyToken Token;

    event Deposit(
        bytes32 indexed hashedData,
        address indexed from,
        address indexed to,
        uint256 amount,
        bytes32 fromChain
    );
    event ForWithdraw(address indexed from, uint256 amount);
    event Withdraw(address indexed from, uint256 amount);
    event Rollback(address indexed from, uint256 amount);

    mapping(address => uint256) internal _totalToWihdraw;

    struct Transaction {
        address from;
        address to;
        uint256 amount;
        uint256 timestamp;
        bool read;
    }
    mapping(bytes32 => Transaction) public listOfTransactions;

    constructor(MyToken _token) {
        Token = _token;
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function depositForBridge(address _to, uint256 _amount) external {
        console.log("depositForBridge Mumbai", _to, _amount);
        bool success = Token.transferFrom(_msgSender(), address(this), _amount);
        require(success, "Transfer failed");

        // store in history
        bytes32 hashedData = keccak256(
            abi.encodePacked(_msgSender(), _to, _amount, block.timestamp)
        );
        listOfTransactions[hashedData] = Transaction(
            _msgSender(),
            _to,
            _amount,
            block.timestamp,
            false
        );

        emit Deposit(hashedData, _msgSender(), _to, _amount, MUMBAI);
    }

    function markAsRead(
        bytes32 hashedData
    ) external onlyRole(BRIDGE_CONTROLLER) {
        Transaction storage _tx = listOfTransactions[hashedData];
        require(_tx.timestamp != 0, "Transaction not found");

        _tx.read = true;
    }

    function rollBackFromDeposit(
        bytes32 hashedData
    ) external onlyRole(BRIDGE_CONTROLLER) {
        Transaction memory _tx = listOfTransactions[hashedData];
        require(_tx.timestamp != 0, "Transaction not found");

        bool success = Token.transfer(_tx.from, _tx.amount);
        require(success, "Transfer failed");

        emit Rollback(_tx.from, _tx.amount);

        delete listOfTransactions[hashedData];
    }

    function increaseWithdraw(
        address _to,
        uint256 _amount
    ) external onlyRole(BRIDGE_CONTROLLER) {
        unchecked {
            _totalToWihdraw[_to] += _amount;
        }

        emit ForWithdraw(_to, _amount);
    }

    function withdraw(uint256 _amount) external {
        require(
            _totalToWihdraw[_msgSender()] >= _amount,
            "Not enough funds to withdraw"
        );

        unchecked {
            _totalToWihdraw[_msgSender()] -= _amount;
        }

        Token.transfer(_msgSender(), _amount);
        emit Withdraw(_msgSender(), _amount);
    }
}

contract MyToken is ERC20 {
    constructor() ERC20("My Token", "MTKN") {
        _mint(_msgSender(), 1_000_000 * 10 ** decimals());
    }
}
