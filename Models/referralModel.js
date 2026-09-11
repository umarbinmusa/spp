const mongoose = require("mongoose");
const ReferralSchema = new mongoose.Schema({
  userName: { type: String, required: true, lowercase: true, trim: true },
  referredBy: { type: String, required: true, lowercase: true, trim: true },
  amountEarned: { type: Number, default: 0 },
});
module.exports = mongoose.model("referral", ReferralSchema);
