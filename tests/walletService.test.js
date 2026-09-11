const assert = require("assert");
const { stubModule } = require("./stubModule");
const { makeFakeModel } = require("./fakeModel");

module.exports = async function runWalletServiceTests() {
  console.log("\n--- walletService tests ---");

  const users = makeFakeModel([{ _id: "user1", balance: 1000 }]);
  const ledger = makeFakeModel([]);

  stubModule("Models/usersModel.js", users);
  stubModule("Models/walletLedgerModel.js", ledger);

  delete require.cache[require.resolve("../Services/walletService")];
  const walletService = require("../Services/walletService");

  // 1. A normal debit within balance succeeds and writes a ledger entry.
  const debit1 = await walletService.debitWallet({
    userId: "user1",
    amount: 300,
    type: "AIRTIME",
    transactionRef: "TXN-1",
    source: "API",
  });
  assert.strictEqual(debit1.success, true, "expected debit within balance to succeed");
  assert.strictEqual(debit1.balanceAfter, 700, "balance should be 1000 - 300 = 700");
  assert.strictEqual(ledger._store.length, 1, "expected one ledger entry after first debit");
  assert.strictEqual(ledger._store[0].amount, -300, "ledger amount should be negative for a debit");

  // 2. A debit larger than the remaining balance must be rejected — this is
  //    the core "no unsafe balance -= amount" requirement from the spec.
  const debit2 = await walletService.debitWallet({
    userId: "user1",
    amount: 5000,
    type: "AIRTIME",
    transactionRef: "TXN-2",
    source: "API",
  });
  assert.strictEqual(debit2.success, false, "expected an over-balance debit to fail");
  assert.strictEqual(debit2.reason, "INSUFFICIENT_BALANCE");
  const userAfter = await users.findOne({ _id: "user1" });
  assert.strictEqual(userAfter.balance, 700, "balance must be unchanged after a rejected debit");
  assert.strictEqual(ledger._store.length, 1, "no ledger entry should be written for a rejected debit");

  // 3. Simulate two concurrent debits racing for the same funds: the
  //    conditional filter (balance >= amount) must let only one succeed.
  const usersRace = makeFakeModel([{ _id: "userX", balance: 500 }]);
  stubModule("Models/usersModel.js", usersRace);
  delete require.cache[require.resolve("../Services/walletService")];
  const walletServiceRace = require("../Services/walletService");

  const [r1, r2] = await Promise.all([
    walletServiceRace.debitWallet({ userId: "userX", amount: 400, type: "AIRTIME", transactionRef: "R1", source: "API" }),
    walletServiceRace.debitWallet({ userId: "userX", amount: 400, type: "AIRTIME", transactionRef: "R2", source: "API" }),
  ]);
  const successes = [r1, r2].filter((r) => r.success).length;
  assert.strictEqual(successes, 1, "exactly one of two racing 400-debits against a 500 balance must succeed");
  const finalBalance = (await usersRace.findOne({ _id: "userX" })).balance;
  assert.strictEqual(finalBalance, 100, "balance must never go negative (500 - 400 = 100)");

  // 4. Credit (refund) correctly increases balance and writes a positive ledger entry.
  const creditResult = await walletServiceRace.creditWallet({
    userId: "userX",
    amount: 400,
    type: "REFUND",
    transactionRef: "R2",
    source: "API",
  });
  assert.strictEqual(creditResult.balanceAfter, 500, "refund should restore balance to 500");

  console.log("walletService: all assertions passed");
};
