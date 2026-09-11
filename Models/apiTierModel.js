const mongoose = require("mongoose");

// Holds the default rate limit (and any descriptive info) per tier.
// Per-service tier pricing itself lives in ApiPricing (scope: "TIER"),
// keeping "how fast can you call us" separate from "what do we charge you".
const apiTierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: ["STARTER", "PRO", "BUSINESS", "ENTERPRISE"],
    },
    description: { type: String, default: "" },
    rateLimit: { type: Number, required: true }, // requests per minute
    isCustomPricing: { type: Boolean, default: false }, // e.g. ENTERPRISE
  },
  { timestamps: true }
);

module.exports = mongoose.model("ApiTier", apiTierSchema);
