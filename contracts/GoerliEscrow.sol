// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract GoerliEscrow is AccessControl {
    bytes32 public constant BRIDGE_CONTROLLER = keccak256("BRIDGE_CONTROLLER");

    MyTokenWrapped public TokenWrapped;

    mapping(address => uint256) internal _totalToWihdraw;

    event Deposit(address indexed from, uint256 amount);
    event ForWithdraw(address indexed from, uint256 amount);
    event Withdraw(address indexed from, uint256 amount);

    constructor() {
        TokenWrapped = new MyTokenWrapped();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

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

    function depositForBridge(address to, uint256 _amount) external {
        TokenWrapped.burn(msg.sender, _amount);
        emit Deposit(to, _amount);
    }
}

contract MyTokenWrapped is ERC20, AccessControl {
    bytes32 public constant GOERLI_SCROW = keccak256("GOERLI_SCROW");

    constructor() ERC20("My Token Wrapped", "MTKNW") {
        _grantRole(GOERLI_SCROW, msg.sender);
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
