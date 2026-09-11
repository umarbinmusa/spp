const { v4: uuid } = require("uuid");
const Transaction = require("../../Models/transactionModel");
const bonusReceipt = async (payload) => {
  const { referrer, user, referralBonus } = payload;
  try {
    const bonusTransaction = Transaction({
      trans_Id: uuid(),
      trans_By: referrer._id,
      trans_Type: "referrer",
      trans_Network: "bonus",
      phone_number: `bonus from ${user.userName}`,
      trans_amount: referralBonus,
      balance_Before: referrer.balance,
      balance_After: referrer.balance + referralBonus,
      trans_Date: `${new Date().toDateString()} ${new Date().toLocaleTimeString()}`,
      trans_Status: "success",
      createdAt: Date.now(),
    });

    const receipt = await bonusTransaction.save();
    return receipt;
  } catch (error) {
    return false;
  }
};
module.exports = bonusReceipt;
