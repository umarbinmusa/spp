const assert = require("assert");
const { stubModule } = require("./stubModule");
const { makeFakeModel } = require("./fakeModel");

module.exports = async function runUserPricingServiceTests() {
  console.log("\n--- userPricingService tests ---");

  const userPricingDocs = [
    { user: "user1", service: "AIRTIME", network: "MTN", dataId: null, pricingType: "PERCENTAGE", price: 95, active: true },
    { user: "user1", service: "DATA", network: null, dataId: 102, pricingType: "FIXED", price: 200, active: true },
    { user: "user1", service: "ELECTRICITY", network: null, dataId: null, pricingType: "FIXED", price: 20, active: true },
    // inactive rule must never apply
    { user: "user2", service: "AIRTIME", network: "MTN", dataId: null, pricingType: "PERCENTAGE", price: 50, active: false },
  ];

  const UserPricing = makeFakeModel(userPricingDocs);
  stubModule("Models/userPricingModel.js", UserPricing);
  delete require.cache[require.resolve("../Services/userPricingService")];
  const userPricingService = require("../Services/userPricingService");

  // 1. A user with a custom AIRTIME price gets it instead of the flat rate.
  const airtime = await userPricingService.resolveUserAirtimePrice({
    userId: "user1",
    network: "MTN",
    faceAmount: 1000,
  });
  assert.ok(airtime, "expected an override for user1/MTN");
  assert.strictEqual(airtime.chargedAmount, 950, "1000 * 95% = 950");

  // 2. A user with no override at all gets null (caller falls back to normal logic).
  const noAirtimeOverride = await userPricingService.resolveUserAirtimePrice({
    userId: "user1",
    network: "GLO",
    faceAmount: 1000,
  });
  assert.strictEqual(noAirtimeOverride, null, "no GLO override exists for user1");

  // 3. An inactive rule must not apply.
  const inactiveOverride = await userPricingService.resolveUserAirtimePrice({
    userId: "user2",
    network: "MTN",
    faceAmount: 1000,
  });
  assert.strictEqual(inactiveOverride, null, "an inactive rule must be ignored");

  // 4. A custom DATA price for a specific plan.
  const dataOverride = await userPricingService.resolveUserDataPrice({ userId: "user1", dataId: 102 });
  assert.ok(dataOverride, "expected a DATA override for user1/plan 102");
  assert.strictEqual(dataOverride.chargedAmount, 200);

  const noDataOverride = await userPricingService.resolveUserDataPrice({ userId: "user1", dataId: 999 });
  assert.strictEqual(noDataOverride, null, "no override exists for a different plan");

  // 5. A custom ELECTRICITY fee.
  const feeOverride = await userPricingService.resolveUserElectricityFee({ userId: "user1" });
  assert.ok(feeOverride);
  assert.strictEqual(feeOverride.fee, 20);

  const noFeeOverride = await userPricingService.resolveUserElectricityFee({ userId: "user2" });
  assert.strictEqual(noFeeOverride, null, "user2 has no electricity override");

  console.log("userPricingService: all assertions passed");
};
