const mongoose = require("mongoose");

// A single flexible pricing table backs all three pricing levels described
// in the spec: DEFAULT (system-wide API price), TIER (per tier) and USER
// (per individual API user, the highest priority).
//
// pricingType "PERCENTAGE" is used for airtime (price = % of face value
// charged, e.g. 99 == 99%). pricingType "FIXED" is used for data plans and
// the electricity convenience fee (price = exact Naira amount).
const apiPricingSchema = new mongoose.Schema(
  {
    scope: {
      type: String,
      enum: ["DEFAULT", "TIER", "USER"],
      required: true,
      index: true,
    },
    apiUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApiAccess",
      default: null,
      index: true,
    }, // required when scope === "USER"
    tier: {
      type: String,
      enum: ["STARTER", "PRO", "BUSINESS", "ENTERPRISE", null],
      default: null,
    }, // required when scope === "TIER"

    service: {
      type: String,
      enum: ["AIRTIME", "DATA", "ELECTRICITY", "CABLE"],
      required: true,
      index: true,
    },
    network: { type: String, default: null }, // MTN / AIRTEL / GLO / 9MOBILE
    planCode: { type: String, default: null }, // e.g. MTN-1GB, only for DATA/CABLE

    pricingType: {
      type: String,
      enum: ["PERCENTAGE", "FIXED"],
      required: true,
    },
    price: { type: Number, required: true },
    discount: { type: Number, default: 0 },

    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

apiPricingSchema.index(
  { scope: 1, apiUser: 1, tier: 1, service: 1, network: 1, planCode: 1 },
  { unique: true }
);

module.exports = mongoose.model("ApiPricing", apiPricingSchema);
