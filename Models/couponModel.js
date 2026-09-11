const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  couponCode: { type: String, required: true },
  couponOwner: { type: String, required: true, lowercase: true },
  amount: Number,
  isUsed: Boolean,
});

module.exports = Coupon = mongoose.model("coupon", couponSchema);
