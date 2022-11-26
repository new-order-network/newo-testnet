// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract USDC is ERC20, ERC20Burnable, Ownable {
    constructor() ERC20("USDC", "USDC") {
        _mint(msg.sender, 100000000 * 10 ** decimals()); // 100mil minted to owner
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}