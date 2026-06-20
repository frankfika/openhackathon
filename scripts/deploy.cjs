const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying HackathonRegistry with account:", deployer.address);
  console.log(
    "Account balance:",
    (await hre.ethers.provider.getBalance(deployer.address)).toString()
  );

  const HackathonRegistry = await hre.ethers.getContractFactory("HackathonRegistry");
  const registry = await HackathonRegistry.deploy(deployer.address);

  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("HackathonRegistry deployed to:", address);
  console.log("\nAdd this to your .env:");
  console.log(`REGISTRY_CONTRACT_ADDRESS=${address}`);

  // Wait for a few confirmations before verifying
  const deploymentTx = registry.deploymentTransaction();
  if (deploymentTx) {
    console.log("\nWaiting for confirmations...");
    await deploymentTx.wait(5);
  }

  // Verify on block explorer (skip on local network)
  const network = hre.network.name;
  if (network !== "hardhat" && network !== "localhost") {
    console.log("\nVerifying contract on block explorer...");
    try {
      await hre.run("verify:verify", {
        address,
        constructorArguments: [deployer.address],
      });
      console.log("Contract verified successfully");
    } catch (error) {
      console.error("Verification failed:", error);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
