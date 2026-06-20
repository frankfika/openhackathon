const hre = require("hardhat");
const assert = require("assert");

async function main() {
  const [owner, recorder, participant] = await hre.ethers.getSigners();

  console.log("Running HackathonRegistry verification...\n");

  // Deploy
  const Registry = await hre.ethers.getContractFactory("HackathonRegistry");
  const registry = await Registry.deploy(owner.address);
  await registry.waitForDeployment();
  console.log("✓ Deployed at", await registry.getAddress());

  // Owner is authorized by default
  assert.strictEqual(await registry.authorizedRecorders(owner.address), true);
  console.log("✓ Owner is authorized by default");

  // Authorize a recorder
  await (await registry.setRecorder(recorder.address, true)).wait();
  assert.strictEqual(await registry.authorizedRecorders(recorder.address), true);
  console.log("✓ Recorder authorized");

  // Unauthorized account cannot record
  const hackathonId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ETHGlobal 2026"));
  let reverted = false;
  try {
    await registry.connect(participant).recordAchievement(
      participant.address, hackathonId, "won_first", 200, ""
    );
  } catch {
    reverted = true;
  }
  assert.strictEqual(reverted, true);
  console.log("✓ Unauthorized recording reverts");

  // Authorized recorder can record
  await (await registry.connect(recorder).recordAchievement(
    participant.address, hackathonId, "won_first", 200, "ipfs://test"
  )).wait();
  console.log("✓ Authorized recording succeeds");

  // Verify achievement stored
  const achievements = await registry.getAchievements(participant.address);
  assert.strictEqual(achievements.length, 1);
  assert.strictEqual(achievements[0].achievementType, "won_first");
  assert.strictEqual(achievements[0].points, 200n);
  console.log("✓ Achievement stored correctly");

  // Total points
  const total = await registry.getTotalPoints(participant.address);
  assert.strictEqual(total, 200n);
  console.log("✓ Total points correct:", total.toString());

  // Duplicate recording reverts
  reverted = false;
  try {
    await registry.connect(recorder).recordAchievement(
      participant.address, hackathonId, "won_first", 200, ""
    );
  } catch {
    reverted = true;
  }
  assert.strictEqual(reverted, true);
  console.log("✓ Duplicate recording reverts (dedup works)");

  // isRecorded check
  assert.strictEqual(
    await registry.isRecorded(hackathonId, participant.address, "won_first"),
    true
  );
  assert.strictEqual(
    await registry.isRecorded(hackathonId, participant.address, "participated"),
    false
  );
  console.log("✓ isRecorded check works");

  // Batch recording
  const [, , , p1, p2] = await hre.ethers.getSigners();
  await (await registry.connect(recorder).batchRecordAchievements(
    [p1.address, p2.address],
    hackathonId,
    ["participated", "judged"],
    [10, 20]
  )).wait();
  assert.strictEqual((await registry.getAchievements(p1.address)).length, 1);
  assert.strictEqual((await registry.getAchievements(p2.address)).length, 1);
  console.log("✓ Batch recording works");

  console.log("\n✅ All HackathonRegistry tests passed!");
}

main().catch((error) => {
  console.error("\n❌ Test failed:", error.message);
  process.exitCode = 1;
});
