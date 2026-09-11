const Transaction = require("../Models/transactionModel");
const Receipt = async (payload) => {
  const {
    transactionId,
    planNetwork,
    status,
    planName,
    phoneNumber,
    amountToCharge,
    balance,
    userId,
    userName,
    type,
    costPrice,
    volumeRatio,
    response,
    increased,
    apiResponse,
    apiResponseId,
  } = payload;
  // let totalCost = costPrice * volumeRatio;
  const profit = parseInt(amountToCharge - costPrice);
  // console.log({ costPrice, volumeRatio, cost, profit });
  const newTransaction = Transaction({
    trans_Id: transactionId,
    trans_By: userId,
    trans_UserName: userName,
    trans_Type: type,
    trans_Network: `${planNetwork} ${planName} `,
    phone_number: phoneNumber,
    trans_amount: amountToCharge,
    trans_profit: profit || 0,
    trans_volume_ratio: volumeRatio && volumeRatio,
    balance_Before: balance,
    balance_After: increased
      ? balance + amountToCharge
      : balance - amountToCharge,
    apiResponse: apiResponse || "",
    apiResponseId: apiResponseId || "",
    trans_Date: `${new Date().toDateString()} ${new Date().toLocaleTimeString()}`,
    trans_Status: status,
    createdAt: Date.now(),
  });

  const receipt = await newTransaction.save();
  return receipt;
};
module.exports = Receipt;
