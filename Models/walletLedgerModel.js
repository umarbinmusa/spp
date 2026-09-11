const mongoose = require("mongoose");

// Every safe wallet mutation (see Services/walletService.js) writes one of
// these. It gives us an auditable trail and lets us reconcile "why is this
// balance what it is" without trusting the mutable balance field alone.
const walletLedgerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    apiTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "ApiTransaction", default: null },
    transactionRef: { type: String, default: null },
    type: {
      type: String,
      enum: ["AIRTIME", "DATA", "ELECTRICITY", "CABLE", "FUND", "REFUND", "ADJUSTMENT"],
      required: true,
    },
    amount: { type: Number, required: true }, // negative = debit, positive = credit
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILED", "PENDING"],
      default: "SUCCESS",
    },
    source: { type: String, enum: ["WEBSITE", "API"], default: "WEBSITE" },
  },
  { timestamps: true }
);

walletLedgerSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("WalletLedger", walletLedgerSchema);
