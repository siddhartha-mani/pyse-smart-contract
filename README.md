Primary functionalities are listed below:

Invest:
- The KYC-cleared investor makes a payment (including gas fee and other fees) directly to Pyse’s multi-signature wallet, which holds investment funds. The transaction hash for this would be verified, and then the invest function is called on-chain.
- The invest function ensures that there is availability within the investment pool, and then mints an ERC721 NFT to represent their investment.
- This token represents their fractional ownership of the total asset, and all the information about the investment is stored within its metadata. This is including, but not limited to: Invested amount, rate of return, investment start date, investment end date, last withdrawn and present value.

Withdraw (Rewards):
- The owner of the ERC721 NFT comes in to claim their accrued rewards. This can be done once their KYC is cleared.
- The NFT’s metadata is first updated to reflect the new values, and then the on-chain implementation is called.
- Accumulated rewards are stored on a different contract, and are transferred to the main one whenever a withdrawal request comes in, for security purposes. This reward amount is then directly transferred to the owner of the NFT.
- The accumulated rewards must be claimed as a whole, partial claims are not allowed.
- On the final reward claim (on completion of the investment time period), a special NFT can be minted which details the overall carbon offset by that portion of the asset.

Split:
- The owner of the NFT requests a split of his share into two or more pieces, each of which has to be larger than a set minimum value.
- The original NFT is burned, and new ones are batch minted as per requirements.
- Any accumulated rewards are first claimed before a split is done.

Transfer (Exit):
- The present version of the application has no liquidity pool, and hence liquidity will only be provided in the form of third party sales.
- Given how it makes little sense for us to interfere in a third party sale (by say selling on the user’s behalf), we are simply providing a public function that allows transfer of ownership.

Carbon Offset:
- Based on the percentage ownership of the total asset, the NFT owners can be provided a monthly notification on how much carbon was offset by their asset.
- This is done on a prorated basis, and is not a function of how long the owner has held the NFT.
- Monthly carbon offset values will be stored in the metadata of the NFT. This data is retained on withdrawal of Rewards, but is lost in case of a split.

Additional point of note:
NFTs can have royalties set, which give us a portion of proceeds from any sales. 2.5% is a nominal rate in the industry for these use cases, but we can reduce it further if needed. 
