const { v4: uuid } = require("uuid");
const Transaction = require("../../Models/transactionModel");
const dataReceipt = async (payload) => {
  const {
    trans_Network,
    mobile_number,
    amountToCharge,
    balance,
    userId,
    trans_Status,
    apiResponse,
    apiResponseId,
  } = payload;

  const newTransaction = Transaction({
    trans_Id: uuid(),
    trans_By: userId,
    trans_Type: "data",
    trans_Network: `${trans_Network}`,
    phone_number: mobile_number,
    trans_amount: amountToCharge,
    balance_Before: balance,
    balance_After: balance - amountToCharge,
    trans_Date: `${new Date().toDateString()} ${new Date().toLocaleTimeString()}`,
    trans_Status: trans_Status,
    apiResponse: apiResponse || "",
    apiResponseId: apiResponseId || "",
    createdAt: Date.now(),
  });

  const receipt = await newTransaction.save();
  return receipt;
};
module.exports = dataReceipt;
