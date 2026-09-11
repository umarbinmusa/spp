const User = require("../Models/usersModel");
const WalletLedger = require("../Models/walletLedgerModel");

// Debits are done as a single atomic findOneAndUpdate with a balance
// condition baked into the filter (balance >= amount). MongoDB guarantees
// document-level update atomicity even on a standalone (non replica-set)
// server, so two concurrent debits can never both succeed and push the
// balance negative — the second one simply won't match the filter.
// This avoids requiring multi-document ACID transactions (which need a
// replica set) while still being race-condition safe.
const debitWallet = async ({
  userId,
  amount,
  type,
  transactionRef,
  apiTransaction = null,
  source = "WEBSITE",
}) => {
  if (!amount || amount <= 0) {
    throw new Error("Debit amount must be a positive number");
  }

  const updated = await User.findOneAndUpdate(
    { _id: userId, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true }
  );

  if (!updated) {
    return { success: false, reason: "INSUFFICIENT_BALANCE" };
  }

  const balanceAfter = updated.balance;
  const balanceBefore = balanceAfter + amount;

  const ledger = await WalletLedger.create({
    user: userId,
    apiTransaction,
    transactionRef,
    type,
    amount: -amount,
    balanceBefore,
    balanceAfter,
    status: "SUCCESS",
    source,
  });

  return { success: true, balanceBefore, balanceAfter, ledger };
};

const creditWallet = async ({
  userId,
  amount,
  type,
  transactionRef,
  apiTransaction = null,
  source = "WEBSITE",
  status = "SUCCESS",
}) => {
  if (!amount || amount <= 0) {
    throw new Error("Credit amount must be a positive number");
  }

  const updated = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { balance: amount } },
    { new: true }
  );

  if (!updated) {
    throw new Error("User not found while crediting wallet");
  }

  const balanceAfter = updated.balance;
  const balanceBefore = balanceAfter - amount;

  const ledger = await WalletLedger.create({
    user: userId,
    apiTransaction,
    transactionRef,
    type,
    amount,
    balanceBefore,
    balanceAfter,
    status,
    source,
  });

  return { success: true, balanceBefore, balanceAfter, ledger };
};

module.exports = { debitWallet, creditWallet };
