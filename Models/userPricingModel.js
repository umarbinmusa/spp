const mongoose = require("mongoose");

// Lets an admin set a specific price for ONE specific user — on top of the
// existing customer/reseller/partner tiers — for the normal website
// purchase flow (/api/v1/buy/...). This mirrors how ApiPricing's "USER"
// scope overrides tier/default pricing for API users: a row here always
// wins over whatever the user's userType would otherwise charge them.
const userPricingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    service: {
      type: String,
      enum: ["AIRTIME", "DATA", "ELECTRICITY", "CABLE"],
      required: true,
    },
    network: { type: String, default: null }, // MTN / AIRTEL / GLO / 9MOBILE — airtime only
    dataId: { type: Number, default: null }, // dataModel's numeric `id` — data only

    // AIRTIME: PERCENTAGE (price = % of face value charged, e.g. 97 == 97%)
    // DATA / ELECTRICITY: FIXED (price = exact Naira amount)
    pricingType: {
      type: String,
      enum: ["PERCENTAGE", "FIXED"],
      required: true,
    },
    price: { type: Number, required: true },

    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

userPricingSchema.index(
  { user: 1, service: 1, network: 1, dataId: 1 },
  { unique: true }
);

module.exports = mongoose.model("UserPricing", userPricingSchema);
