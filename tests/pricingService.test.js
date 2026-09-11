const assert = require("assert");
const { stubModule } = require("./stubModule");
const { makeFakeModel } = require("./fakeModel");

module.exports = async function runPricingServiceTests() {
  console.log("\n--- pricingService tests ---");

  const apiUserA = "apiaccess_A";
  const apiUserB = "apiaccess_B";

  const pricingDocs = [
    // DEFAULT airtime MTN = 99%
    { scope: "DEFAULT", apiUser: null, tier: null, service: "AIRTIME", network: "MTN", planCode: null, pricingType: "PERCENTAGE", price: 99, active: true },
    // TIER PRO airtime MTN = 98.5%
    { scope: "TIER", apiUser: null, tier: "PRO", service: "AIRTIME", network: "MTN", planCode: null, pricingType: "PERCENTAGE", price: 98.5, active: true },
    // USER-specific airtime MTN = 97% for API User A only
    { scope: "USER", apiUser: apiUserA, tier: null, service: "AIRTIME", network: "MTN", planCode: null, pricingType: "PERCENTAGE", price: 97, active: true },
  ];

  const ApiPricing = makeFakeModel(pricingDocs);
  stubModule("Models/apiPricingModel.js", ApiPricing);
  delete require.cache[require.resolve("../Services/pricingService")];
  const pricingService = require("../Services/pricingService");

  // API User A has a user-specific price -> must win over tier and default.
  const priceA = await pricingService.resolveAirtimePrice({
    apiAccess: { _id: apiUserA, tier: "PRO" },
    network: "MTN",
    faceAmount: 1000,
  });
  assert.strictEqual(priceA.source, "USER", "API User A should get their USER-scoped price");
  assert.strictEqual(priceA.chargedAmount, 970, "1000 * 97% = 970");

  // API User B has no user-specific price but is on PRO tier -> tier price wins over default.
  const priceB = await pricingService.resolveAirtimePrice({
    apiAccess: { _id: apiUserB, tier: "PRO" },
    network: "MTN",
    faceAmount: 1000,
  });
  assert.strictEqual(priceB.source, "TIER", "API User B (PRO, no user override) should get the TIER price");
  assert.strictEqual(priceB.chargedAmount, 985, "1000 * 98.5% = 985");

  // A STARTER-tier user with no tier-specific rule falls through to DEFAULT.
  const priceC = await pricingService.resolveAirtimePrice({
    apiAccess: { _id: "apiaccess_C", tier: "STARTER" },
    network: "MTN",
    faceAmount: 1000,
  });
  assert.strictEqual(priceC.source, "DEFAULT", "STARTER tier with no override should fall through to DEFAULT");
  assert.strictEqual(priceC.chargedAmount, 990, "1000 * 99% = 990");

  // A network with nothing configured anywhere falls all the way back to the hardcoded fallback table.
  const priceD = await pricingService.resolveAirtimePrice({
    apiAccess: { _id: "apiaccess_D", tier: "STARTER" },
    network: "GLO",
    faceAmount: 1000,
  });
  assert.strictEqual(priceD.source, "FALLBACK", "an unconfigured network must use the hardcoded fallback");
  assert.strictEqual(priceD.chargedAmount, 985, "GLO fallback is 98.5%, so 1000 * 98.5% = 985");

  // --- Data pricing: the plan's own apiPrice (set via the admin's existing
  // "Update Price" screen) must win over any DEFAULT/TIER rule someone left
  // configured — those should only apply to a plan with no apiPrice set at all.
  const dataPricingDocs = [
    { scope: "DEFAULT", apiUser: null, tier: null, service: "DATA", network: null, planCode: "102", pricingType: "FIXED", price: 999, active: true },
    { scope: "TIER", apiUser: null, tier: "PRO", service: "DATA", network: null, planCode: "102", pricingType: "FIXED", price: 888, active: true },
    { scope: "USER", apiUser: apiUserA, tier: null, service: "DATA", network: null, planCode: "999", pricingType: "FIXED", price: 111, active: true },
  ];
  const ApiPricingData = makeFakeModel(dataPricingDocs);
  stubModule("Models/apiPricingModel.js", ApiPricingData);
  delete require.cache[require.resolve("../Services/pricingService")];
  const pricingServiceData = require("../Services/pricingService");

  // A plan with apiPrice set must use it, ignoring the stray DEFAULT/TIER rules above.
  const dataPriceUpdated = await pricingServiceData.resolveDataPrice({
    apiAccess: { _id: apiUserB, tier: "PRO" },
    planCode: "102",
    plan: { apiPrice: "330", resellerPrice: "340", my_price: "350" },
  });
  assert.strictEqual(dataPriceUpdated.source, "PLAN_API_PRICE", "plan.apiPrice must win over TIER/DEFAULT rules");
  assert.strictEqual(dataPriceUpdated.chargedAmount, 330, "must charge exactly what was set via Update Price");

  // A USER-specific override still wins even over a set apiPrice — this is
  // the one deliberate per-API-user exception an admin can still configure.
  const dataPriceUserOverride = await pricingServiceData.resolveDataPrice({
    apiAccess: { _id: apiUserA, tier: "STARTER" },
    planCode: "999",
    plan: { apiPrice: "500" },
  });
  assert.strictEqual(dataPriceUserOverride.source, "USER");
  assert.strictEqual(dataPriceUserOverride.chargedAmount, 111);

  // A plan with no apiPrice at all falls through to TIER, then DEFAULT.
  const dataPriceNoApiPrice = await pricingServiceData.resolveDataPrice({
    apiAccess: { _id: apiUserB, tier: "PRO" },
    planCode: "102",
    plan: { apiPrice: null, resellerPrice: "340", my_price: "350" },
  });
  assert.strictEqual(dataPriceNoApiPrice.source, "TIER", "no apiPrice set -> falls through to TIER");
  assert.strictEqual(dataPriceNoApiPrice.chargedAmount, 888);

  console.log("pricingService: all assertions passed");
};
