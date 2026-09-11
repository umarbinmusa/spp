const mongoose = require("mongoose");

// ApiAccess is created when an admin converts a normal user into an API User.
// The apiKey is only ever shown once (at creation / regeneration time) — we
// persist a SHA-256 hash of it for fast, deterministic lookup on every
// request. The apiSecret is bcrypt-hashed since it is never used for
// per-request lookups, only shown once for the developer to store safely.
const apiAccessSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    apiUserId: { type: String, required: true, unique: true, index: true },

    // Credentials
    apiKeyHash: { type: String, required: true, index: true, unique: true },
    apiKeyPrefix: { type: String, required: true }, // e.g. ak_live_ab12 (safe to display)
    secretHash: { type: String, required: true },

    // Webhook signing secret (kept in plain text since we must use it to
    // sign outgoing webhook payloads — never returned in logs/responses).
    webhookUrl: { type: String, default: "" },
    webhookSecret: { type: String, default: "" },
    webhookEvents: {
      type: [String],
      default: ["transaction.success", "transaction.failed", "transaction.pending"],
    },

    environment: {
      type: String,
      enum: ["live", "sandbox"],
      default: "live",
    },

    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "REVOKED"],
      default: "ACTIVE",
      index: true,
    },

    tier: {
      type: String,
      enum: ["STARTER", "PRO", "BUSINESS", "ENTERPRISE"],
      default: "STARTER",
    },

    allowedServices: {
      type: [String],
      enum: ["AIRTIME", "DATA", "ELECTRICITY", "CABLE"],
      default: ["AIRTIME", "DATA", "ELECTRICITY", "CABLE"],
    },

    // Requests per minute. If not set, falls back to the tier's default.
    rateLimit: { type: Number, default: null },

    lastUsedAt: { type: Date },

    totalRequests: { type: Number, default: 0 },
    successfulRequests: { type: Number, default: 0 },
    failedRequests: { type: Number, default: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ApiAccess", apiAccessSchema);
