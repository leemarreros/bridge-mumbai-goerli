// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract MumbaiScrow is AccessControl {
    bytes32 public constant BRIDGE_CONTROLLER = keccak256("BRIDGE_CONTROLLER");

    MyToken Token;

    event Deposit(address indexed from, uint256 amount);
    event ForWithdraw(address indexed from, uint256 amount);
    event Withdraw(address indexed from, uint256 amount);

    mapping(address => uint256) internal _totalDeposited;
    mapping(address => uint256) internal _totalToWihdraw;

    constructor(MyToken _token) {
        Token = _token;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function depositForBridge(address _to, uint256 _amount) external {
        bool success = Token.transferFrom(msg.sender, address(this), _amount);
        require(success, "Transfer failed");

        _totalDeposited[_to] += _amount;

        emit Deposit(_to, _amount);
    }

    function increaseWithdraw(
        address _to,
        uint256 _amount
    ) external onlyRole(BRIDGE_CONTROLLER) {
        require(_totalDeposited[_to] >= _amount, "Not enough funds desposited");

        unchecked {
            _totalDeposited[_to] -= _amount;
            _totalToWihdraw[_to] += _amount;
        }

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

        Token.transfer(msg.sender, _amount);
        emit Withdraw(msg.sender, _amount);
    }
}

contract MyToken is ERC20 {
    constructor() ERC20("My Token", "MTKN") {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }
}
