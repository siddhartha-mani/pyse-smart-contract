require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  defaultNetwork: "amoy",
  networks: {
    amoy: {
      url: process.env.AMOY_RPC,
      accounts: [
        process.env.AMOY_PRIVATE_KEY1, // owner
        process.env.AMOY_PRIVATE_KEY2, // pool manager
        process.env.AMOY_PRIVATE_KEY3, // investor
      ],
    },
    mumbai: {
      url: process.env.MUMBAI_RPC,
      accounts: [
        process.env.MUMBAI_PRIVATE_KEY1, // owner
        process.env.MUMBAI_PRIVATE_KEY2, // pool manager
        process.env.MUMBAI_PRIVATE_KEY3, // investor
      ],
    },
    polygon: {
      url: process.env.POLYGON_RPC,
      accounts: [
        process.env.POLYGON_OWNER_KEY,
        process.env.POLYGON_POOL_MANAGER_KEY,
        process.env.POLYGON_INVESTOR_KEY,
      ],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    scripts: "./scripts"
  },
};
