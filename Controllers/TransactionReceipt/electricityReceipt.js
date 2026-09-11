const { v4: uuid } = require("uuid");
const Transaction = require("../../Models/transactionModel");
const electricityReceipt = async (payload) => {
  const {
    package,
    Status,
    token,
    meter_number,
    amountToCharge,
    balance,
    userId,
  } = payload;

  const newTransaction = Transaction({
    trans_Id: uuid(),
    trans_By: userId,
    trans_Type: "electricity",
    trans_Network: `${package} for ${meter_number}`,
    phone_number: token,
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
module.exports = electricityReceipt;
