const assert = require("assert");
const { stubModule } = require("./stubModule");
const { makeFakeModel } = require("./fakeModel");

module.exports = async function runApiTransactionServiceTests() {
  console.log("\n--- apiTransactionService tests ---");

  // ---- Build fresh fakes for every dependency in the require graph ----
  const users = makeFakeModel([{ _id: "user1", balance: 2000 }]);
  const ledger = makeFakeModel([]);
  const apiPricing = makeFakeModel([]); // empty -> forces FALLBACK pricing (99% for MTN)
  const apiTransactions = makeFakeModel([]);
  // idempotency guard: reject a second create() with the same (apiUser, requestId)
  apiTransactions._uniqueCheck = (store, data) =>
    !!data.requestId && store.some((d) => d.apiUser === data.apiUser && d.requestId === data.requestId);

  stubModule("Models/usersModel.js", users);
  stubModule("Models/walletLedgerModel.js", ledger);
  stubModule("Models/apiPricingModel.js", apiPricing);
  stubModule("Models/apiTransactionModel.js", apiTransactions);
  stubModule("Models/dataModel.js", makeFakeModel([]));

  // uuid is a real npm dependency with no node_modules entry at all in this
  // offline sandbox, so even require.resolve("uuid") would throw. Patch the
  // module resolver itself to redirect "uuid" to a synthetic fake module.
  const Module = require("module");
  const originalResolveFilename = Module._resolveFilename;
  const fakeUuidPath = "\0fake-uuid";
  let uuidCounter = 1;
  Module._resolveFilename = function (request, ...rest) {
    if (request === "uuid") return fakeUuidPath;
    return originalResolveFilename.call(this, request, ...rest);
  };
  require.cache[fakeUuidPath] = {
    id: fakeUuidPath,
    filename: fakeUuidPath,
    loaded: true,
    exports: { v4: () => `00000000-0000-0000-0000-${String(uuidCounter++).padStart(12, "0")}` },
  };

  // webhookService makes real HTTP calls — stub it out entirely for this test.
  stubModule("Services/webhookService.js", { dispatch: async () => null, sendTestWebhook: async () => ({}) });

  // Supplier call stub — controllable per test via a mutable object.
  const supplierBehavior = { airtimeResult: { status: true, msg: "MTN airtime purchase successful", apiResponseId: "SUP-1" } };
  stubModule("Controllers/APICALLS/Airtime/buyAirtime.js", async () => supplierBehavior.airtimeResult);
  stubModule("Controllers/APICALLS/Data/Data.js", async () => ({ status: true, msg: "ok", data: {} }));
  stubModule("Controllers/APICALLS/Electricity/electricity.js", async () => ({ status: true, msg: "ok", token: "1234" }));

  // Force fresh requires of everything downstream so the stubs above take effect.
  for (const p of [
    "../Services/walletService",
    "../Services/pricingService",
    "../Services/apiTransactionService",
  ]) {
    delete require.cache[require.resolve(p)];
  }
  const apiTransactionService = require("../Services/apiTransactionService");

  const apiAccess = { _id: "apiaccess_1", user: "user1", tier: "STARTER" };

  // 1. A successful airtime purchase debits the wallet and returns SUCCESS.
  const result1 = await apiTransactionService.processAirtime({
    apiAccess,
    phone: "08012345678",
    network: "MTN",
    amount: 1000,
    requestId: "MYAPP-001",
  });
  assert.ok(result1.transaction, "expected a transaction to be returned");
  assert.strictEqual(result1.transaction.status, "SUCCESS");
  assert.strictEqual(result1.transaction.chargedAmount, 990, "1000 * 99% fallback = 990");
  const balanceAfterFirst = (await users.findOne({ _id: "user1" })).balance;
  assert.strictEqual(balanceAfterFirst, 1010, "2000 - 990 = 1010");

  // 2. Re-sending the exact same requestId must NOT create a second
  //    transaction or debit the wallet again — this is the idempotency guarantee.
  const result2 = await apiTransactionService.processAirtime({
    apiAccess,
    phone: "08012345678",
    network: "MTN",
    amount: 1000,
    requestId: "MYAPP-001",
  });
  assert.strictEqual(result2.duplicate, true, "expected the second identical request to be flagged as a duplicate");
  assert.strictEqual(result2.transaction.transactionId, result1.transaction.transactionId, "must return the original transaction");
  const balanceAfterDuplicate = (await users.findOne({ _id: "user1" })).balance;
  assert.strictEqual(balanceAfterDuplicate, 1010, "balance must be unchanged by a duplicate request");
  assert.strictEqual(apiTransactions._store.length, 1, "only one ApiTransaction row should exist for this requestId");

  // 3. A failed supplier call must automatically refund the wallet.
  supplierBehavior.airtimeResult = { status: false, msg: "Supplier down" };
  const result3 = await apiTransactionService.processAirtime({
    apiAccess,
    phone: "08012345678",
    network: "MTN",
    amount: 500,
    requestId: "MYAPP-002",
  });
  assert.strictEqual(result3.transaction.status, "FAILED");
  const balanceAfterFailedSupplier = (await users.findOne({ _id: "user1" })).balance;
  assert.strictEqual(balanceAfterFailedSupplier, 1010, "balance must be refunded back to 1010 after supplier failure");

  // 4. Insufficient balance must be rejected before any supplier call, with no transaction left dangling as SUCCESS.
  const result4 = await apiTransactionService.processAirtime({
    apiAccess,
    phone: "08012345678",
    network: "MTN",
    amount: 100000,
    requestId: "MYAPP-003",
  });
  assert.ok(result4.error, "expected an error for a purchase exceeding the wallet balance");
  assert.strictEqual(result4.error.code, "INSUFFICIENT_BALANCE");
  const balanceAfterInsufficient = (await users.findOne({ _id: "user1" })).balance;
  assert.strictEqual(balanceAfterInsufficient, 1010, "balance must be unchanged when balance is insufficient");

  // 5. An unsupported network is rejected before touching the wallet at all.
  const result5 = await apiTransactionService.processAirtime({
    apiAccess,
    phone: "08012345678",
    network: "SOMENETWORK",
    amount: 500,
    requestId: "MYAPP-004",
  });
  assert.ok(result5.error, "expected an error for an unsupported network");
  assert.strictEqual(result5.error.code, "INVALID_NETWORK");

  console.log("apiTransactionService: all assertions passed");
};
