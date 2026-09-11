const mongoose = require("mongoose");

const apiTransactionSchema = new mongoose.Schema(
  {
    apiUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApiAccess",
      required: true,
      index: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    requestId: { type: String, default: null }, // developer-supplied idempotency key
    transactionId: { type: String, required: true, unique: true, index: true }, // AST-xxxx

    service: {
      type: String,
      enum: ["AIRTIME", "DATA", "ELECTRICITY", "CABLE"],
      required: true,
    },
    network: { type: String, default: null },
    planCode: { type: String, default: null },
    phoneNumber: { type: String, default: null },
    meterNumber: { type: String, default: null },

    amount: { type: Number, required: true }, // face value requested
    chargedAmount: { type: Number, required: true }, // what the API user's wallet was actually charged
    supplierCost: { type: Number, default: 0 }, // internal — never exposed to the API user
    profit: { type: Number, default: 0 }, // internal — never exposed to the API user

    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED", "REFUNDED"],
      default: "PENDING",
      index: true,
    },

    supplierReference: { type: String, default: null },
    response: { type: mongoose.Schema.Types.Mixed, default: {} },

    ipAddress: { type: String, default: null },
  },
  { timestamps: true }
);

// A given API user can never submit the same requestId twice — this is what
// makes idempotency safe at the database layer, not just in application code.
apiTransactionSchema.index(
  { apiUser: 1, requestId: 1 },
  { unique: true, partialFilterExpression: { requestId: { $type: "string" } } }
);
apiTransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model("ApiTransaction", apiTransactionSchema);
