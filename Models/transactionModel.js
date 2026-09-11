const mongoose = require("mongoose");

const transactionsSchema = new mongoose.Schema({
  trans_Id: { type: String, required: true, unique: true },
  trans_By: { type: String, required: true },
  trans_UserName: { type: String },
  trans_Type: { type: String, required: true },
  trans_Network: { type: String, required: true },
  phone_number: { type: String },
  trans_amount: { type: Number, required: true },
  trans_profit: { type: Number, default: 0 },
  trans_volume_ratio: { type: Number, default: 0 },
  balance_Before: { type: Number, required: true },
  balance_After: { type: Number, required: true },
  trans_Date: { type: String },
  paymentLink: { type: String },
  trans_Status: { type: String },
  apiResponseId: { type: String },
  apiResponse: { type: String },
  earningId: { type: String },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 2592000, // this is the expiry time in seconds(expires in month time)
  },
});

module.exports = Transactions = mongoose.model(
  "transactions",
  transactionsSchema
);
