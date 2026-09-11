const Transactions = require("../../Models/transactionModel");
const User = require("../../Models/usersModel");
const { REFUND_RECEIPT } = require("../TransactionReceipt");
const axios = require("axios");
const md5 = require("md5");
const generateReceipt = require("../generateReceipt");

const dataReloadedWebhook = async (req, res) => {
  res.sendStatus(200);
  console.log(req.body);
  const { mobile_number, ident, refund, api_response } = req.body;
  try {
    const thisTransaction = await Transactions.findOne({
      phone_number: mobile_number,
      apiResponseId: ident,
    });
    console.log(thisTransaction);
    if (!thisTransaction) return;
    const { trans_Id, trans_By, trans_Status, trans_amount } = thisTransaction;
    if (trans_Status === "refunded") return;
    // if there's a refund api response
    if (refund) {
      const { balance } = await User.findOne({ _id: trans_By });
      // generate a refund receipt
      await REFUND_RECEIPT({
        ...thisTransaction._doc,
        balance,
        isOwner: true,
      });
      // refund the user back
      await User.updateOne(
        { _id: trans_By },
        { $inc: { balance: trans_amount } }
      );
      // update the old transaction status
      await Transactions.updateOne(
        { trans_Id },
        {
          $set: {
            trans_Status: "refunded",
            apiResponseId: "",
            apiResponse: api_response,
            trans_volume_ratio: 0,
            trans_profit: 0,
          },
        }
      );
    } else {
      // update the transaction api response
      if (api_response) {
        await Transactions.updateOne(
          { trans_Id },
          {
            $set: {
              trans_Status: "success",
              apiResponseId: "",
              apiResponse: api_response,
            },
          }
        );
      }
    }

    const { webhookUrl } = await User.findOne({
      _id: trans_By,
    });
    if (webhookUrl) {
      // send a notification webhook to owner of wallet that their money has been refunded or updated
      const response = await axios.post(webhookUrl, {
        mobile_number,
        ident,
        refund,
        api_response,
      });
      console.log(response);
    }
  } catch (error) {
    console.log(error);
    return;
  }
};
const billStack = async (req, res) => {
  res.sendStatus(200);
  // console.log(req.body);
  // console.log(req.headers);
  const signature = req.headers["x-wiaxy-signature"];
  const secret = process.env.BILLSTACK_SECRET;
  // write MD5 of a secret key above
  const expectedSignature = md5(secret);
  if (signature !== expectedSignature) {
    console.log({ signature, secret });
    console.log("SIGNATURE NOT CORRECT");
    return;
  }
  if (req.body.data.type == "RESERVED_ACCOUNT_TRANSACTION") {
    const {
      merchant_reference,
      transaction_ref,
      amount,
      account: { account_number, bank_name },
    } = req.body.data;
    const customerEmail = merchant_reference.split("_")[1];
    console.log({ customerEmail });
    let charges = parseFloat(amount) * 0.005;
    if (charges > 50) charges = 50;
    const settlementAmount = (amount - charges).toFixed(2);
    const user = await User.findOne({ email: customerEmail });
    await generateReceipt({
      transactionId: transaction_ref,
      planNetwork: `Auto-funding||${bank_name}`,
      status: "success",
      planName: `₦${amount}`,
      phoneNumber: account_number,
      response: `A payment of ₦${amount} received from ${bank_name} ${account_number}. ₦${settlementAmount} has been credited and ₦${charges} bank charges has been deducted`,
      amountToCharge: Number(settlementAmount),
      balance: user.balance,
      userId: user._id,
      userName: user.userName,
      type: "wallet",
      increased: true,
      // wavedAmount: settlementAmount - amountToCredit,
    });
    await User.updateOne(
      { email: customerEmail },
      { $inc: { balance: settlementAmount } }
    );
  }
};
module.exports = { dataReloadedWebhook, billStack };
