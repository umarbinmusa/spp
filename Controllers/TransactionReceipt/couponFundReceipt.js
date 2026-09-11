const { v4: uuid } = require("uuid");
const Transaction = require("../../Models/transactionModel");
const couponFundReceipt = async (payload) => {
  const {
   userId,
   amount,
   user
  } = payload;
  const newTransaction = Transaction({
    trans_Id: uuid(),
    trans_By: userId,
    trans_Type: "wallet",
    trans_Network: "coupon",
    phone_number: user.userName,
    trans_amount: amount,
    balance_Before: user.balance,
    balance_After: user.balance + amount,
    trans_Date: `${new Date().toDateString()} ${new Date().toLocaleTimeString()}`,
    trans_Status: "success",
  });
  const receipt = await newTransaction.save();
  return receipt;
};
module.exports = couponFundReceipt;
