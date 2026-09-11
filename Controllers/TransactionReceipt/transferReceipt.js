const { v4: uuid } = require("uuid");
const Transaction = require("../../Models/transactionModel");
const transferReceipt = async (payload) => {
  if (payload.isSender) {
    // receipt for  transaction owner
    const { receiver, amount, balance, userId } = payload;
    const senderTransaction = Transaction({
      trans_Id: uuid(),
      trans_By: userId,
      trans_Type: "transfer",
      trans_Network: "transfer",
      phone_number: receiver.userName,
      trans_amount: amount,
      balance_Before: balance,
      balance_After: balance - amount,
      trans_Date: `${new Date().toDateString()} ${new Date().toLocaleTimeString()}`,
      trans_Status: "success",
    });
    const receipt = await senderTransaction.save();
    return receipt;
  } else {
    // receipt for sponsor transaction
    const { sender, amount, receiver } = payload;

    const receiverTransaction = Transaction({
      trans_Id: uuid(),
      trans_By: receiver._id,
      trans_Type: "transfer",
      trans_Network: "transfer",
      phone_number: sender.userName,
      trans_amount: amount,
      balance_Before: receiver.balance,
      balance_After: receiver.balance + parseInt(amount),
      trans_Date: `${new Date().toDateString()} ${new Date().toLocaleTimeString()}`,
      trans_Status: "success",
    });

    const receipt = await receiverTransaction.save();
    return receipt;
  }
};
module.exports = transferReceipt;
