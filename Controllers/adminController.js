const User = require("../Models/usersModel");
const Coupon = require("../Models/couponModel");
const Transaction = require("../Models/transactionModel");
const Inbox = require("../Models/simInboxModel");
const Services = require("../Models/services");

const axios = require("axios");
const voucher_codes = require("voucher-code-generator");
const sendEmail = require("../Utils/sendMail");
const { REFUND_RECEIPT } = require("./TransactionReceipt");
const dataModel = require("../Models/dataModel");
const notification = require("../Models/notification");
const CostPrice = require("../Models/costPriceModel");
const { reverseReferralBonus } = require("../Utils/referralBonus");
const bcrypt = require("bcrypt");

const adminDetails = async (req, res) => {
  if (req.user.userId !== process.env.ADMIN_ID)
    return res.status(401).json({
      msg: "You are not authorized to perform this action",
    });
  try {
    const allUsers = await User.find().sort("-createdAt").limit(10).skip(0);
    const availableServices = await Services.find();
    res.status(200).json({
      allUsers: allUsers,
      services: availableServices,
    });
  } catch (error) {
    console.log(error);
    console.log(error.message);
    res.status(500).json({ error: error });
  }
};
const generateCoupon = async (req, res) => {
  //   res.send("coupon generated");
  if (req.user.userId !== process.env.ADMIN_ID)
    return res.status(401).json({
      msg: "You are not authorized to perform this action",
    });
  const { userAccount, amount } = req.body;
  const couponCode = voucher_codes.generate({
    length: 10,
  });
  if (!userAccount || !amount)
    return res.status(400).json({ msg: "All fields are required" });
  let user = await User.find({ userName: userAccount });
  if (!user) user = await User.find({ email: userAccount });
  if (user.length < 1)
    return res
      .status(400)
      .json({ msg: `No user with this Username: ${userAccount}` });

  const newCoupon = new Coupon({
    couponCode: `${couponCode[0]}`,
    couponOwner: userAccount,
    amount: amount,
    isUsed: false,
  });
  const savedCoupon = await newCoupon.save();
  return res.status(200).json(savedCoupon);
};

const sendMail = async (req, res) => {
  if (req.user.userId !== process.env.ADMIN_ID)
    return res.status(401).json({
      msg: "You are not authorized to perform this action",
    });
  const { subject, message, url, linkMessage, from, to, userAccount } =
    req.body;
  let userEmail = "";
  let userUserName = "";
  // Sending message to a user
  if (userAccount) {
    const { email, userName } = await User.findOne({ userName: userAccount });
    userEmail = email;
    userUserName = userName;
  }
  // sending message to all user
  if (!(subject, message, url, linkMessage))
    return res.status(400).json({ msg: "All fields are required" });
  const allusers = await User.find();
  let emails = [];
  if (typeof from === "number" && from < to) {
    emails = allusers.map((e) => e.email).slice(from, to);
  } else {
    emails = allusers.map((e) => e.email);
  }
  sendEmail(
    userAccount ? userEmail : emails,
    subject,
    {
      message: message,
      link: url,
      linkMessage: linkMessage,
      businessName: userAccount
        ? userUserName
        : `${process.env.BUSINESS_NAME} user`,
    },
    "../templates/generalMessage.handlebars"
  );
  return res.status(200).json({
    msg: "All email has been sent successfully",
  });
};
const refund = async (req, res) => {
  const { id: transactionId } = req.params;
  try {
    const transactionObject = await Transaction.findOne({
      _id: transactionId,
    });
    if (!transactionObject)
      return res.status(404).json({ msg: "Transaction not found" });
    // destructuring the transaction

    const {
      trans_By: userId,
      trans_Type,
      trans_amount,
      _id,
      trans_Status,
      trans_volume_ratio,
      trans_profit,
      earningId,
    } = transactionObject;

    if (trans_Status === "refunded")
      return res.status(400).json({ msg: "User has been refunded before" });
    // Looking for owner of the transaction
    const transactionOwner = await User.findOne({
      _id: userId,
    });
    if (!transactionOwner)
      return res.status(400).json({ msg: "Transaction owner not found" });
    const { userName, referredBy, balance, isPartner } = transactionOwner;

    // generate receipt
    const response = await REFUND_RECEIPT({
      ...transactionObject._doc,
      balance,
      isOwner: true,
    });
    // return the amount to the user
    if (response) {
      await User.updateOne(
        { _id: userId },
        { $inc: { balance: trans_amount } }
      );
      if (earningId) {
        reverseReferralBonus({
          bonusAmount: trans_volume_ratio,
          sponsorUserName: referredBy,
          userName,
          amountToCharge: trans_profit,
          earningId,
        });
      }
    }

    res.status(200).json({
      msg: `Refund of ₦ ${trans_amount} for ${userName} was successful`,
    });
    await Transaction.updateOne(
      { _id: transactionId },
      {
        $set: {
          trans_Status: "refunded",
          trans_profit: 0,
          trans_volume_ratio: 0,
        },
      }
    );
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: error.message, error: error });
  }
};
const updateAvailableServices = async (req, res) => {
  if (req.user.userId !== process.env.ADMIN_ID)
    return res.status(401).json({
      msg: "You are not authorized to perform this action",
    });
  const { serviceId, serviceStatus } = req.body;
  await Services.updateOne({ _id: serviceId }, { $set: { serviceStatus } });
  res.status(200).json({ msg: "Service updated" });
};

const searchUsers = async (req, res) => {
  if (req.user.userId !== process.env.ADMIN_ID)
    return res.status(401).json({
      msg: "You are not authorized to perform this action",
    });
  const { userType, phoneNumber, sort, userName } = req.query;
  let queryObject = {};

  if (userType && userType !== "all") {
    queryObject.userType = { $regex: userType, $options: "i" };
  }
  if (phoneNumber) {
    queryObject.phoneNumber = { $regex: phoneNumber, $options: "i" };
  }
  let userId;
  if (userName) {
    let user = await User.findOne({
      userName: { $regex: userName, $options: "i" },
    });

    if (user) {
      userId = user._id;
    }
  }
  if (userName && userId) {
    queryObject._id = userId;
  }

  let result = User.find(queryObject);
  // console.log(result);
  if (sort) {
    const sortList = sort.split(",").join(" ");
    result = result.sort(sortList);
  } else {
    result = result.sort("-createdAt");
  }

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 30;
  const skip = (page - 1) * limit;
  result = await result.skip(skip).limit(limit);

  let noOfUsers = await User.countDocuments(queryObject);
  const totalPages = Math.ceil(noOfUsers / limit);
  // Total user balance
  let allUser = await User.find().select("balance");
  let allBalance = allUser.reduce((acc, curr) => {
    acc += curr.balance;
    return acc;
  }, 0);
  res.status(200).json({
    users: result,
    totalPages,
    totalUsers: noOfUsers,
    totalBalance: allBalance,
  });
};
const updatePrice = async (req, res) => {
  const {
    newPrice: { price, reseller, api, partner },
    dataId,
  } = req.body;
  const { volumeRatio, plan_network, plan_type } = await dataModel.findOne({
    _id: dataId,
  });
  if (volumeRatio == 1) {
    let dataList = await dataModel.find({
      plan_network,
      plan_type,
      volumeRatio: { $gte: 0.9 },
    });
    for (let i = 0; i < dataList.length; i++) {
      const currentItem = dataList[i];
      console.log(currentItem);
      const isUpdated = await dataModel.updateOne(
        { id: currentItem.id },
        {
          $set: {
            my_price: price
              ? currentItem.volumeRatio * price
              : currentItem.my_price,
            resellerPrice: reseller
              ? currentItem.volumeRatio * reseller
              : currentItem.resellerPrice,
            apiPrice: api
              ? currentItem.volumeRatio * api
              : currentItem.apiPrice,
            partnerPrice: partner
              ? currentItem.volumeRatio * partner
              : currentItem.partnerPrice,
          },
        }
      );
      console.log({ isUpdated });
    }
    return res.status(200).json({ msg: "All Prices updated successfully" });
  } else {
    let newUpdate = {};
    if (price) {
      newUpdate.my_price = price;
    }
    if (reseller) {
      newUpdate.resellerPrice = reseller;
    }
    if (partner) {
      newUpdate.partnerPrice = partner;
    }
    if (api) {
      newUpdate.apiPrice = api;
    }
    try {
      const isUpdated = await dataModel.updateOne(
        { _id: dataId },
        { $set: newUpdate }
      );
      console.log(isUpdated);
      res.status(200).json({ msg: "Price updated successfully" });
    } catch (e) {
      res.status(500).json({ msg: "An error occur" });
    }
  }
};
const updateCostPrice = async (req, res) => {
  const { network, costPrice } = req.body;
  try {
    await CostPrice.updateOne({ network }, { $set: { costPrice } });
    res
      .status(200)
      .json({ msg: `${network} cost price updated to ${costPrice}` });
  } catch (error) {
    res.status(500).json({ msg: "Something went wrong" });
  }
};
const getCostPrice = async (req, res) => {
  try {
    const costPrice = await CostPrice.find();
    return res.status(200).json(costPrice);
  } catch (error) {
    res.status(500).json({ msg: "An error occur" });

    console.log(error);
  }
};
const updateNotification = async (req, res) => {
  const { msg } = req.body;
  try {
    await notification.updateOne({ msg });
    return res.status(200).json({ msg });
  } catch (e) {
    return res.status(500).json({ msg: "something went wrong" });
  }
};
const getNotification = async (req, res) => {
  try {
    const { msg } = await notification.findOne();
    // console.log(msg);
    return res.status(200).json({ msg });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ msg: "something went wrong" });
  }
};
const upgradeUser = async (req, res) => {
  const { userType, userId } = req.params;
  try {
    await User.updateOne({ _id: userId }, { $set: { userType } });
    res.status(200).json({ msg: `User upgraded to a ${userType}` });
  } catch (error) {
    res.status(500).json({ msg: "User upgrade failed" });
  }
};
const approveWithdrawal = async (req, res) => {
  const { withdrawalId } = req.body;
  let isAdmin = process.env.ADMIN_ID === req.user.userId;
  if (!isAdmin)
    return res
      .status(400)
      .json({ msg: "You are not allowed to perform this action" });

  try {
    const withdrawalTransaction = await Transaction.findById(withdrawalId);
    if (!withdrawalTransaction)
      return res.status(400).json({ msg: "No transaction with this ID" });
    //check if the requester is the one who made the transaction
    const { trans_By, trans_amount, trans_Status } = withdrawalTransaction;
    if (trans_Status === "success")
      return res.status(400).json({ msg: "This withdrawal has been settled" });
    const user = await User.findById(trans_By);
    if (!user) return res.status(400).json({ msg: "user does not exist" });
    const { accountNumber, nameOnAccount, bank } = user.withdrawalDetails;
    // Update the transaction status
    await Transaction.updateOne(
      { _id: withdrawalId },
      {
        $set: {
          trans_Status: "success",
          apiResponse: `A payment of ${trans_amount} has been sent to ${nameOnAccount} ${accountNumber} ${bank}.`,
        },
      }
    );
    res.status(200).json({ msg: "withdrawal approved " });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "something went wrong" });
  }
};
const resetUserPassword = async (req, res) => {
  const { userId } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const newPassword = "12345678";
    const hashedPwd = await bcrypt.hash(newPassword, salt);
    const { userName } = await User.findOne({ _id: userId });
    await User.updateOne({ _id: userId }, { $set: { password: hashedPwd } });
    res
      .status(200)
      .json({ msg: `${userName}'s password has been reset successfully` });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ msg: "something went wrong" });
  }
};
module.exports = {
  adminDetails,
  generateCoupon,
  sendMail,
  refund,
  updateAvailableServices,
  searchUsers,
  updatePrice,
  updateCostPrice,
  getCostPrice,
  updateNotification,
  getNotification,
  upgradeUser,
  approveWithdrawal,
  resetUserPassword,
};
