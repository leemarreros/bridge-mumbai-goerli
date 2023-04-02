// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "hardhat/console.sol";

contract GoerliEscrow is AccessControl {
    bytes32 public constant BRIDGE_CONTROLLER = keccak256("BRIDGE_CONTROLLER");
    bytes32 public constant GOERLI = keccak256("GOERLI");

    MyTokenWrapped public TokenWrapped;

    mapping(address => uint256) internal _totalToWihdraw;

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
    event FireEvent(address firing);

    struct Transaction {
        address from;
        address to;
        uint256 amount;
        uint256 timestamp;
        bool read;
    }
    mapping(bytes32 => Transaction) public listOfTransactions;

    constructor() {
        TokenWrapped = new MyTokenWrapped();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function increaseWithdraw(
        address _to,
        uint256 _amount
    ) external onlyRole(BRIDGE_CONTROLLER) {
        console.log("increaseWithdraw", _to, _amount);

        unchecked {
            _totalToWihdraw[_to] += _amount;
        }

        emit ForWithdraw(_to, _amount);
    }

    function withdraw(uint256 _amount) external {
        console.log("withdraw", _amount);

        require(
            _totalToWihdraw[_msgSender()] >= _amount,
            "Not enough funds to withdraw"
        );
        unchecked {
            _totalToWihdraw[_msgSender()] -= _amount;
        }
        TokenWrapped.mint(_msgSender(), _amount);
        emit Withdraw(_msgSender(), _amount);
    }

    function depositForBridge(address _to, uint256 _amount) external {
        TokenWrapped.burn(_msgSender(), _amount);

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

        emit Deposit(hashedData, _msgSender(), _to, _amount, GOERLI);
    }

    function rollBackFromDeposit(
        bytes32 hashedData
    ) external onlyRole(BRIDGE_CONTROLLER) {
        Transaction memory _tx = listOfTransactions[hashedData];
        require(_tx.timestamp != 0, "Transaction not found");

        TokenWrapped.mint(_tx.from, _tx.amount);

        emit Rollback(_tx.from, _tx.amount);

        delete listOfTransactions[hashedData];
    }

    function markAsRead(
        bytes32 hashedData
    ) external onlyRole(BRIDGE_CONTROLLER) {
        Transaction storage _tx = listOfTransactions[hashedData];
        require(_tx.timestamp != 0, "Transaction not found");

        _tx.read = true;
    }

    function fireEvent() external {
        emit FireEvent(msg.sender);
    }
}

contract MyTokenWrapped is ERC20, AccessControl {
    bytes32 public constant GOERLI_SCROW = keccak256("GOERLI_SCROW");

    constructor() ERC20("My Token Wrapped", "MTKNW") {
        _grantRole(GOERLI_SCROW, _msgSender());
    }

    function mint(
        address _to,
        uint256 _amount
    ) external onlyRole(GOERLI_SCROW) {
        _mint(_to, _amount);
    }

    function burn(
        address _from,
        uint256 _amount
    ) external onlyRole(GOERLI_SCROW) {
        _burn(_from, _amount);
    }
}
