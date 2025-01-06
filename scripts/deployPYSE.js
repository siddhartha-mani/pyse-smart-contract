const hre = require("hardhat");

async function main() {
  const [owner, poolManager] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", owner.address);

  const poolSize = 400000000000;
  const rate = 1000;
  const poolManagerAddress = poolManager.address;
  const startDate = 1697587200000;
  const endDate = 1824940800000;
  const minimum = 60000000;
  const usdtTokenAddress = "0x196D776ee63306696079a9E765325dA139B9fd7c"; // mumbai
  // const usdtTokenAddress = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"; // mainnet
  
  // const provider = new hre.ethers.JsonRpcProvider(
  //   hre.config.networks[hre.config.defaultNetwork]["url"]
  // );
  // const feeData = await provider.getFeeData();
  // console.log(feeData);

  const Contract = await hre.ethers.getContractFactory("Pyse", owner);
  const pyse = await Contract.deploy(
    poolSize,
    rate,
    poolManagerAddress,
    startDate,
    endDate,
    minimum,
    usdtTokenAddress,
  );
  await pyse.waitForDeployment();

  console.log("Contract deployed at:", pyse.target);

  const poolDetails = await pyse.checkPoolDetails();

  console.log("Pool details from deployed contract: ", poolDetails);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
