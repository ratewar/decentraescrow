//SPDX-License-Identifier: MIT
 
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract EscrowMetaverse is IERC721Receiver,Ownable {

    enum TokenStage {nftDeposited, cancelDeposit, avaxDeposited, deliveryInitiated, canceledBeforeDelivery, confirmDelivery, delivered}
    mapping(uint256 => address) public sellerDeposit;
    mapping(uint256 => mapping(address => address)) public buyerSellerMap;
    mapping(uint256 =>mapping(address => uint256)) public buyerDeposit;
    mapping(uint256 => TokenStage) tokenStage;
    address public nftAddress;

    constructor(address _NFTaddress)
    {
        nftAddress = _NFTaddress;
    }
    
    function onERC721Received( address operator, address from, uint256 tokenId, bytes calldata data ) public override returns (bytes4) {
        return this.onERC721Received.selector;
    }

     function depositNFT(uint256 _TokenID)
     public
     {
        sellerDeposit[_TokenID] = msg.sender;
        tokenStage[_TokenID] = TokenStage.nftDeposited;
        ERC721(nftAddress).safeTransferFrom(msg.sender, address(this), _TokenID);
     }

     function depositAvax(uint256 _TokenID)
     public
     inTokenStage(TokenStage.nftDeposited,_TokenID)
     payable
     {
        address _Seller=sellerDeposit[_TokenID];
        require(_Seller!=msg.sender);
        buyerSellerMap[_TokenID][_Seller] = msg.sender;
        buyerDeposit[_TokenID][msg.sender] = msg.value;
        tokenStage[_TokenID] = TokenStage.avaxDeposited;
     }

     function canceldepositNFT(uint256 _TokenID)
     inTokenStage(TokenStage.canceledBeforeDelivery,_TokenID)
     public
     {
        require(sellerDeposit[_TokenID] == msg.sender);
        tokenStage[_TokenID] = TokenStage.cancelDeposit;
        ERC721(nftAddress).safeTransferFrom(address(this),msg.sender, _TokenID);
     }

     function initiateDelivery(uint256 _TokenID)
     inTokenStage(TokenStage.avaxDeposited,_TokenID)
     public
     {
        require(sellerDeposit[_TokenID] == msg.sender);
        tokenStage[_TokenID] = TokenStage.deliveryInitiated;
     }

     function cancelBeforeDelivery(uint256 _TokenID)
     inTokenStage(TokenStage.deliveryInitiated,_TokenID)
     public
     payable
     {
         address _Seller=sellerDeposit[_TokenID];
         require(buyerSellerMap[_TokenID][_Seller] == msg.sender);
         tokenStage[_TokenID] = TokenStage.canceledBeforeDelivery;
         address payable buyer=payable(buyerSellerMap[_TokenID][_Seller]);
         buyer.transfer(buyerDeposit[_TokenID][msg.sender]);
     }


    function deliverNFT(uint256 _TokenID) public payable
    inTokenStage(TokenStage.deliveryInitiated,_TokenID)
    {
         address buyer = buyerSellerMap[_TokenID][sellerDeposit[_TokenID]];
         if(buyer==msg.sender) {
             ERC721(nftAddress).safeTransferFrom(address(this), buyer, _TokenID);
             address payable seller=payable(sellerDeposit[_TokenID]);
             seller.transfer(buyerDeposit[_TokenID][buyer]);
             tokenStage[_TokenID] = TokenStage.delivered;
         }
    }

    function checkDeposit(uint256 _TokenID)
        public
        view
        returns (uint256 balance)
    {
        return buyerDeposit[_TokenID][msg.sender];
    }

    function getContractBalance()
        public
        view
        onlyOwner
        returns (uint256 balance)
    {
        return address(this).balance;
    }

    modifier inTokenStage(TokenStage _state,uint256 _TokenID) {
		require(tokenStage[_TokenID] == _state);
		_;
	}
} 