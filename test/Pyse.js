const hre = require("hardhat");
const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("Pyse", function () {
  async function deployPyseFixture() {
    const [owner, poolManager, investor] = await hre.ethers.getSigners();

    console.log("Deploying contracts with the account:", owner.address);

    const token = await hre.ethers.deployContract("USDT", [], owner);
    await token.waitForDeployment();
    const usdtTokenAddress = token.getAddress();

    const poolSize = 400000000000;
    const rate = 1000;
    const poolManagerAddress = poolManager.address;
    const startDate = 1697587200000;
    const endDate = 1824940800000;
    const minimum = 60000000;
    // const usdtTokenAddress = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";

    // console.log(hre.config.networks[hre.config.defaultNetwork]["url"]);
    const provider = new hre.ethers.JsonRpcProvider(
      hre.config.networks[hre.config.defaultNetwork]["url"]
    );
    const feeData = await provider.getFeeData();
    console.log(feeData);

    const Contract = await hre.ethers.getContractFactory("Pyse", owner);
    const pyse = await Contract.deploy(
      poolSize,
      rate,
      poolManagerAddress,
      startDate,
      endDate,
      minimum,
      usdtTokenAddress
    );
    await pyse.waitForDeployment();

    console.log("Contract deployed at:", pyse.target);

    return { pyse, token, poolSize, rate, startDate, endDate, minimum };
  }

  describe("Deployment", function () {
    it("Should deploy correctly with proper parameters", async function () {
      const { pyse, poolSize, rate, startDate, endDate } = await loadFixture(
        deployPyseFixture
      );
      const poolDetails = await pyse.checkPoolDetails();
      expect({
        poolSize: poolDetails[0],
        rate: poolDetails[2],
        startDate: poolDetails[3],
        endDate: poolDetails[4],
      }).to.deep.equal({
        poolSize: poolSize,
        rate: rate,
        startDate: startDate,
        endDate: endDate,
      });
    });
  });

  describe("Investment", function () {
    it("Should perform invest correctly (Mint and transer NFT, emit an InvestedEvent and update poolAvailability)", async function () {
      const { pyse } = await loadFixture(deployPyseFixture);
      const [owner, poolManager, investor] = await hre.ethers.getSigners();

      const initialPoolDetails = await pyse.checkPoolDetails();
      const initialPoolAvailability = initialPoolDetails[1];
      const usdcAmount = 160000000;
      const investorAdd = investor.address;
      const cid = "QmZf7U3TgffsWDyTfzYws7nioz5NujbozehBa2QhpWbk4n";
      const orderId = "0";

      // Check if InvestedEvent is emitted.
      await expect(
        pyse.connect(poolManager).invest(orderId, usdcAmount, investorAdd, cid)
      )
        .to.emit(pyse, "InvestedEvent")
        .withArgs(orderId, investorAdd, usdcAmount, "0", cid, 399840000000);

      // Check if the NFT has been minted and transferred to the investor.
      const ownerOfNft = await pyse.connect(poolManager).ownerOf(0);
      expect(ownerOfNft).to.equal(investor.address);

      // Check if the Pool availability has been updated correctly.
      const finalPoolDetails = await pyse.checkPoolDetails();
      const finalPoolAvailability = finalPoolDetails[1];
      expect(finalPoolAvailability).to.equal(
        initialPoolAvailability - BigInt(usdcAmount)
      );
    });

    it("Should not allow investment beyond pool availability", async function () {
      const { pyse } = await loadFixture(deployPyseFixture);
      const [owner, poolManager, investor] = await hre.ethers.getSigners();

      const investorAdd = investor.address;
      const cid = "QmZf7U3TgffsWDyTfzYws7nioz5NujbozehBa2QhpWbk4n";
      const poolDetails = await pyse.checkPoolDetails();
      const poolAvailability = poolDetails[1];
      const usdcAmount = poolAvailability + BigInt(10);
      const orderId = "0";

      await expect(
        pyse.connect(poolManager).invest(orderId, usdcAmount, investorAdd, cid)
      ).to.be.revertedWith(`Investment amount larger than pool availability.`);
    });

    it("Should not allow non-poolManager to invest", async function () {
      const { pyse } = await loadFixture(deployPyseFixture);
      const [owner, poolManager, investor] = await hre.ethers.getSigners();

      const usdcAmount = 10;
      const investorAdd = investor.address;
      const cid = "QmZf7U3TgffsWDyTfzYws7nioz5NujbozehBa2QhpWbk4n";
      const roleMissing = await pyse.POOL_MANAGER();
      const ownerAdd = owner.address.toLowerCase();
      const orderId = "0";

      await expect(
        pyse.connect(owner).invest(orderId, usdcAmount, investorAdd, cid)
      ).to.be.revertedWith(
        `AccessControl: account ${ownerAdd} is missing role ${roleMissing}`
      );
    });
  });

  describe("Withdrawal", function () {
    it("Should reject withdrawal if there isn't enough balance", async function () {
      const { pyse } = await loadFixture(deployPyseFixture);
      const [owner, poolManager, investor] = await hre.ethers.getSigners();

      const rewardAmount = 10000000;
      const walletAddress = investor.address;
      const id = 0;
      // const tokenAddress = token.getAddress();
      const orderId = "0";

      // Trying to withdraw from the contract when it has zero balance.
      await expect(
        pyse
          .connect(poolManager)
          .withdraw(orderId, rewardAmount, walletAddress, id)
      ).to.be.revertedWith(`Insufficient balance, try again later.`);
    });

    it("Should send rewards to the investor's wallet and emit a WithdrawEvent", async function () {
      const { pyse, token } = await loadFixture(deployPyseFixture);
      const [owner, poolManager, investor] = await hre.ethers.getSigners();

      const rewardAmount = 10000000;
      const walletAddress = investor.address;
      const id = 0;
      const tokenAddress = token.getAddress();
      const contractAddress = pyse.getAddress();
      const orderId = "0";

      // Transferring requisite tokens to the contract so that it has sufficient balance.
      await token.connect(owner).transfer(contractAddress, rewardAmount);

      // Checking if the withdraw happens as expected and the event is emitted.
      await expect(
        pyse
          .connect(poolManager)
          .withdraw(orderId, rewardAmount, walletAddress, id)
      )
        .to.emit(pyse, "WithdrawEvent")
        .withArgs(orderId, walletAddress, rewardAmount, id, 0);
    });

    it("Should not allow non-poolManager to withdraw", async function () {
      const { pyse } = await loadFixture(deployPyseFixture);
      const [owner, poolManager, investor] = await hre.ethers.getSigners();

      const rewardAmount = 100;
      const walletAddress = investor.address;
      const id = 0;
      const roleMissing = await pyse.POOL_MANAGER();
      const ownerAdd = owner.address.toLowerCase();
      const orderId = "0";

      await expect(
        pyse.connect(owner).withdraw(orderId, rewardAmount, walletAddress, id)
      ).to.be.revertedWith(
        `AccessControl: account ${ownerAdd} is missing role ${roleMissing}`
      );
    });
  });

  describe("Final Withdrawal", function () {
    it("Should burn original token, mint new one and emit FinalWithdrawalEvent", async function () {
      const { pyse } = await loadFixture(deployPyseFixture);
      const [owner, poolManager, investor] = await hre.ethers.getSigners();

      const initialTokenId = 0;
      const walletAddress = investor.address;
      const cid = "QmZf7U3TgffsWDyTfzYws7nioz5NujbozehBa2QhpWbk4n";
      const orderId = "0";

      // Calling invest to make sure there's something to burn.
      await pyse.connect(poolManager).invest(orderId, 100, walletAddress, cid);

      // Checking if the FinalWithdrawalEvent is being emitted.
      await expect(
        pyse
          .connect(poolManager)
          .finalWithdrawal(orderId, walletAddress, initialTokenId, cid)
      )
        .to.emit(pyse, "FinalWithdrawalEvent")
        .withArgs(orderId, walletAddress, initialTokenId, cid, 1);

      // Ensuring that the token is burned.
      await expect(
        pyse.connect(poolManager).ownerOf(initialTokenId)
      ).to.be.revertedWith(`ERC721: invalid token ID`);
    });

    it("Should not allow non-poolManager to perform final withdrawal", async function () {
      const { pyse } = await loadFixture(deployPyseFixture);
      const [owner, poolManager, investor] = await hre.ethers.getSigners();

      const initialTokenId = 0;
      const walletAddress = investor.address;
      const cid = "QmZf7U3TgffsWDyTfzYws7nioz5NujbozehBa2QhpWbk4n";
      const roleMissing = await pyse.POOL_MANAGER();
      const ownerAdd = owner.address.toLowerCase();
      const orderId = "0";

      await expect(
        pyse
          .connect(owner)
          .finalWithdrawal(orderId, walletAddress, initialTokenId, cid)
      ).to.be.revertedWith(
        `AccessControl: account ${ownerAdd} is missing role ${roleMissing}`
      );
    });
  });

  describe("Split", function () {
    it("Should ensure that split values are greater than the minimum ticket size", async function () {
      const { pyse } = await loadFixture(deployPyseFixture);
      const [owner, poolManager, investor] = await hre.ethers.getSigners();

      const initialTokenId = 0;
      const initialAmount = 160000000;
      const amounts = [5000000, 155000000];
      const cid = [
        "QmZf7U3TgffsWDyTfzYws7nioz5NujbozehBa2QhpWbk4n",
        "QmcEe52qLd8b8XgQ5179UsfVH9S63kHG4kymCEidEEmv26",
      ];
      const nftOwner = investor.address;
      const orderId = "0";

      await expect(
        pyse
          .connect(poolManager)
          .split(orderId, initialTokenId, initialAmount, amounts, cid, nftOwner)
      ).to.be.revertedWith(
        `Individual split values are not above the minimum investable value.`
      );
    });

    it("Should ensure that split values add up to the initial value", async function () {
      const { pyse } = await loadFixture(deployPyseFixture);
      const [owner, poolManager, investor] = await hre.ethers.getSigners();

      const initialTokenId = 0;
      const initialAmount = 160000000;
      const amounts = [105000000, 60000000];
      const cid = [
        "QmZf7U3TgffsWDyTfzYws7nioz5NujbozehBa2QhpWbk4n",
        "QmcEe52qLd8b8XgQ5179UsfVH9S63kHG4kymCEidEEmv26",
      ];
      const nftOwner = investor.address;
      const orderId = "0";

      await expect(
        pyse
          .connect(poolManager)
          .split(orderId, initialTokenId, initialAmount, amounts, cid, nftOwner)
      ).to.be.revertedWith(
        `The split values do not add up to the initial token value.`
      );
    });

    it("Should perform the split, burn the initial token, mint new ones and emit SplitEvent", async function () {
      const { pyse } = await loadFixture(deployPyseFixture);
      const [owner, poolManager, investor] = await hre.ethers.getSigners();

      const initialTokenId = 0;
      const initialAmount = 160000000;
      const amounts = [100000000, 60000000];
      const cid = [
        "QmZf7U3TgffsWDyTfzYws7nioz5NujbozehBa2QhpWbk4n",
        "QmcEe52qLd8b8XgQ5179UsfVH9S63kHG4kymCEidEEmv26",
      ];
      const nftOwner = investor.address;
      const count = 2;
      const orderId = "0";
      const newIds = [1, 2];

      // Performing an investment to generate the initial NFT to be split.
      pyse
        .connect(poolManager)
        .invest(orderId, initialAmount, nftOwner, cid[0]);

      // Check if SplitEvent is emitted.
      await expect(
        pyse
          .connect(poolManager)
          .split(orderId, initialTokenId, initialAmount, amounts, cid, nftOwner)
      )
        .to.emit(pyse, "SplitEvent")
        .withArgs(orderId, nftOwner, initialTokenId, newIds, count);

      // Check if the original NFT has been burned.
      await expect(
        pyse.connect(poolManager).ownerOf(initialTokenId)
      ).to.be.revertedWith(`ERC721: invalid token ID`);

      // Check if the split tokens are minted and transferred.
      expect(await pyse.connect(poolManager).ownerOf(1)).to.equal(nftOwner);
      expect(await pyse.connect(poolManager).ownerOf(2)).to.equal(nftOwner);
    });

    it("Should not allow non-poolManager to split", async function () {
      const { pyse } = await loadFixture(deployPyseFixture);
      const [owner, poolManager, investor] = await hre.ethers.getSigners();

      const initialTokenId = 0;
      const initialAmount = 100;
      const amounts = [50, 50];
      const cid = [
        "QmZf7U3TgffsWDyTfzYws7nioz5NujbozehBa2QhpWbk4n",
        "QmcEe52qLd8b8XgQ5179UsfVH9S63kHG4kymCEidEEmv26",
      ];
      const nftOwner = investor.address;
      const roleMissing = await pyse.POOL_MANAGER();
      const ownerAdd = owner.address.toLowerCase();
      const orderId = "0";

      await expect(
        pyse
          .connect(owner)
          .split(orderId, initialTokenId, initialAmount, amounts, cid, nftOwner)
      ).to.be.revertedWith(
        `AccessControl: account ${ownerAdd} is missing role ${roleMissing}`
      );
    });
  });

  describe("Transfer", function () {
    it("Should transfer the NFT correctly and emit the TransferEvent", async function () {
      const { pyse } = await loadFixture(deployPyseFixture);
      const [owner, poolManager, investor] = await hre.ethers.getSigners();

      const walletAddress = investor.address;
      const toAddress = owner.address;
      const cid = "QmZf7U3TgffsWDyTfzYws7nioz5NujbozehBa2QhpWbk4n";
      const tokenId = 0;
      const orderId = "0";

      // Calling invest to make sure there's something to burn.
      pyse.connect(poolManager).invest(orderId, 100, walletAddress, cid);

      // Transferring token to 'owner' and checking for event.
      await expect(
        pyse.connect(investor).transfer(walletAddress, toAddress, tokenId)
      )
        .to.emit(pyse, "TransferEvent")
        .withArgs(walletAddress, toAddress, tokenId);

      // Checking to ensure that the token has been transferred.
      const ownerOfNft = await pyse.connect(poolManager).ownerOf(0);
      expect(ownerOfNft).to.equal(owner.address);
    });

    it("Should ensure that only the owner of the NFT can transfer it", async function () {
      const { pyse } = await loadFixture(deployPyseFixture);
      const [owner, poolManager, investor] = await hre.ethers.getSigners();

      const walletAddress = investor.address;
      const toAddress = owner.address;
      const cid = "QmZf7U3TgffsWDyTfzYws7nioz5NujbozehBa2QhpWbk4n";
      const tokenId = 0;

      // Calling invest to make sure there's something to burn.
      pyse.connect(poolManager).invest(100, walletAddress, cid);

      // Checking to see if poolManager can transfer the token belonging to investor.
      await expect(
        pyse.connect(poolManager).transfer(walletAddress, toAddress, tokenId)
      ).to.be.revertedWith(`Only the sender can initiate the transfer.`);
    });
  });

  describe("Burn", function () {
    it("Should burn the NFT correctly", async function () {
      const { pyse } = await loadFixture(deployPyseFixture);
      const [owner, poolManager, investor] = await hre.ethers.getSigners();

      const walletAddress = investor.address;
      const toAddress = owner.address;
      const cid = "QmZf7U3TgffsWDyTfzYws7nioz5NujbozehBa2QhpWbk4n";
      const tokenId = 0;
      const orderId = "0";

      // Calling invest to make sure there's something to burn.
      await pyse.connect(poolManager).invest(orderId, 100, walletAddress, cid);

      // Transferring token to 'owner' and checking for event.
      await pyse.connect(poolManager).burn(tokenId);

      // Check if the original NFT has been burned.
      await expect(
        pyse.connect(poolManager).ownerOf(tokenId)
      ).to.be.revertedWith(`ERC721: invalid token ID`);
    });
  });

  describe("Pool Manager claim/revoke", function () {
    it("Should correctly assign the POOL_MANAGER role", async function () {
      const { pyse } = await loadFixture(deployPyseFixture);
      const [owner, poolManager, investor] = await hre.ethers.getSigners();

      const usdcAmount = 100000000;
      const investorAdd = investor.address;
      const cid = "QmZf7U3TgffsWDyTfzYws7nioz5NujbozehBa2QhpWbk4n";
      const roleMissing = await pyse.POOL_MANAGER();
      const orderId = "0";

      // Checking if 'investor' can invest without the Pool Manager role.
      await expect(
        pyse.connect(investor).invest(orderId, usdcAmount, investorAdd, cid)
      ).to.be.revertedWith(
        `AccessControl: account ${investorAdd.toLowerCase()} is missing role ${roleMissing}`
      );

      // Giving the Pool Manager role to 'investor'.
      await pyse.connect(owner).claimPoolManager(investorAdd);

      // Checking again to see if 'investor' can invest with the new role.
      await expect(
        pyse.connect(investor).invest(orderId, usdcAmount, investorAdd, cid)
      )
        .to.emit(pyse, "InvestedEvent")
        .withArgs(orderId, investorAdd, usdcAmount, 0, cid, 399900000000);
    });

    it("Should correctly revoke the POOL_MANAGER role", async function () {
      const { pyse } = await loadFixture(deployPyseFixture);
      const [owner, poolManager, investor] = await hre.ethers.getSigners();

      const usdcAmount = 100000000;
      const investorAdd = investor.address;
      const cid = "QmZf7U3TgffsWDyTfzYws7nioz5NujbozehBa2QhpWbk4n";
      const roleMissing = await pyse.POOL_MANAGER();
      const orderId = "0";

      // Checking if Pool Manager can invest.
      await expect(
        pyse.connect(poolManager).invest(orderId, usdcAmount, investorAdd, cid)
      )
        .to.emit(pyse, "InvestedEvent")
        .withArgs(orderId, investorAdd, usdcAmount, 0, cid, 399900000000);

      // Revoking Pool Manager's role
      await pyse.connect(owner).revokePoolManager(poolManager.address);

      // Checking if Pool Manager can invest without the requisite role.
      await expect(
        pyse.connect(poolManager).invest(orderId, usdcAmount, investorAdd, cid)
      ).to.be.revertedWith(
        `AccessControl: account ${poolManager.address.toLowerCase()} is missing role ${roleMissing}`
      );
    });

    it("Should ensure that only ADMIN_ROLE can grant/revoke the POOL_MANAGER role", async function () {
      const { pyse } = await loadFixture(deployPyseFixture);
      const [owner, poolManager, investor] = await hre.ethers.getSigners();

      const investorAdd = investor.address;
      const roleMissing = await pyse.ADMIN_ROLE();

      // Checking if Pool Manager can claim the Pool Manager role.
      await expect(
        pyse.connect(poolManager).claimPoolManager(investorAdd)
      ).to.be.revertedWith(
        `AccessControl: account ${poolManager.address.toLowerCase()} is missing role ${roleMissing}`
      );

      // Checking if Pool Manager can revoke the Pool Manager role.
      await expect(
        pyse.connect(poolManager).revokePoolManager(poolManager.address)
      ).to.be.revertedWith(
        `AccessControl: account ${poolManager.address.toLowerCase()} is missing role ${roleMissing}`
      );
    });
  });

  describe("Update minimum investment value", function () {
    it("Should update the minimum investment value as expected", async function () {
      const { pyse } = await loadFixture(deployPyseFixture);
      const [owner, poolManager] = await hre.ethers.getSigners();

      const newMinValue = 20;

      await pyse.connect(poolManager).updateMinValue(newMinValue);
      const poolDetails = await pyse.checkPoolDetails();
      const updatedMinValue = poolDetails[5];
      expect(newMinValue).to.equal(updatedMinValue);
    });

    it("Should not allow non-poolManager to update minimum investment value", async function () {
      const { pyse } = await loadFixture(deployPyseFixture);
      const [owner] = await hre.ethers.getSigners();

      const newMinValue = 20;
      const roleMissing = await pyse.POOL_MANAGER();
      const ownerAdd = owner.address.toLowerCase();

      await expect(
        pyse.connect(owner).updateMinValue(newMinValue)
      ).to.be.revertedWith(
        `AccessControl: account ${ownerAdd} is missing role ${roleMissing}`
      );
    });
  });

  describe("SafeMint", function () {
    it("Should Mint NFT and send to the correct address", async function () {
      const { pyse } = await loadFixture(deployPyseFixture);
      const [owner, poolManager, investor] = await hre.ethers.getSigners();

      const to = investor.address;
      const id = 0;
      const cid = "QmZf7U3TgffsWDyTfzYws7nioz5NujbozehBa2QhpWbk4n";

      // Minting an NFT for 'Investor'
      await pyse.connect(poolManager).safeMint(to, id, cid);

      // Check if the NFT has been minted and transferred to the investor.
      const ownerOfNft = await pyse.connect(poolManager).ownerOf(0);
      expect(ownerOfNft).to.equal(to);
    });

    it("Should not allow non-poolManager to mint", async function () {
      const { pyse } = await loadFixture(deployPyseFixture);
      const [owner, poolManager, investor] = await hre.ethers.getSigners();

      const to = investor.address;
      const id = 0;
      const cid = "QmZf7U3TgffsWDyTfzYws7nioz5NujbozehBa2QhpWbk4n";
      const roleMissing = await pyse.POOL_MANAGER();
      const ownerAdd = owner.address.toLowerCase();

      await expect(
        pyse.connect(owner).safeMint(to, id, cid)
      ).to.be.revertedWith(
        `AccessControl: account ${ownerAdd} is missing role ${roleMissing}`
      );
    });
  });
});
