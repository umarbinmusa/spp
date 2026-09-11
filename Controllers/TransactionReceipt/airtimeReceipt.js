const { v4: uuid } = require("uuid");
const Transaction = require("../../Models/transactionModel");
const airtimeReceipt = async (payload) => {
  const {
    id,
    plan_network,
    Status,
    plan_amount,
    mobile_number,
    amountToCharge,
    balance,
    userId,
  } = payload;
  const newTransaction = Transaction({
    trans_Id: uuid(),
    trans_By: userId,
    trans_Type: "airtime",
    trans_Network: `${plan_network} ${plan_amount}`,
    phone_number: mobile_number,
    trans_amount: amountToCharge,
    balance_Before: balance,
    balance_After: balance - amountToCharge,
    trans_Date: `${new Date().toDateString()} ${new Date().toLocaleTimeString()}`,
    trans_Status: Status,
    createdAt: Date.now(),
  });

  const receipt = await newTransaction.save();
  return receipt;
};
module.exports = airtimeReceipt;
