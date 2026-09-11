// IMPORTS
const jwt = require("jsonwebtoken");
const randomToken = require("rand-token");
const { v4: uuid } = require("uuid");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

// MODELS
const User = require("../Models/usersModel");
const Data = require("../Models/dataModel");
const Transaction = require("../Models/transactionModel");
const Token = require("../Models/tokenModel");
const Contact = require("../Models/contactModel");
const cabletvModel = require("../Models/cabletvModel");
const Referral = require("../Models/referralModel");
// UTILS
const newReferral = require("../Utils/newReferral");
const sendEmail = require("../Utils/sendMail");
const generateAccountNumber = require("../Utils/generateAccountNumber");
const generateReceipt = require("./generateReceipt");

// OTHERS
const { cableName } = require("../API_DATA/cableName");
const { disco } = require("../API_DATA/disco");
const { network } = require("../API_DATA/network");
const { TRANSFER_RECEIPT, BONUS_RECEIPT } = require("./TransactionReceipt");
const { MTN_CG, MTN_SME } = require("../API_DATA/newData");
// const generateVpayAcc = require("../Utils/generateVpayAccount");
const generateAcc = require("../Utils/accountNumbers");
const { addReferral } = require("../Utils/referralBonus");
const { default: axios } = require("axios");
const generateBillStackAcc = require("../Utils/generateBillStackAcc");

const register = async (req, res) => {
  let { email, password, passwordCheck, userName, referredBy, phoneNumber } =
    req.body;

  // validate

  if (!email || !password || !passwordCheck || !userName || !phoneNumber) {
    return res.status(400).json({ msg: "Not all fields have been entered." });
  }
  if (password.length < 5)
    return res
      .status(400)
      .json({ msg: "The password needs to be at least 5 characters long." });
  if (password !== passwordCheck)
    return res
      .status(400)
      .json({ msg: "Enter the same password twice for verification." });

  const existingUserEmail = await User.findOne({ email: email });
  if (existingUserEmail)
    return res
      .status(400)
      .json({ msg: "An account with this email already exists." });
  const existingUsername = await User.findOne({ userName: userName });
  if (existingUsername)
    return res.status(400).json({ msg: "This username has been taken" });
  // generate API token for the user
  req.body.apiToken = randomToken.generate(30);
  try {
    await User.create({ ...req.body });
    // generate account number
    await generateAcc({ userName, email });
    const user = await User.findOne({ email });
    generateBillStackAcc({ bankName: "palmpay", userId: user._id });
    generateBillStackAcc({ bankName: "9psb", userId: user._id });
    const token = user.createJWT();
    const allDataList = await Data.find();
    const MTN_SME_PRICE = allDataList
      .filter((e) => e.plan_network === "MTN")
      .map((e) => {
        const { my_price, id } = e;
        let price = my_price;

        e["plan_amount"] = price;
        return e;
      });

    const GLO_PRICE = allDataList
      .filter((e) => e.plan_network === "GLO")
      .map((e) => {
        const { my_price } = e;
        let price = my_price;

        e["plan_amount"] = price;
        return e;
      });
    const AIRTEL_PRICE = allDataList
      .filter((e) => e.plan_network === "AIRTEL")
      .map((e) => {
        const { my_price } = e;
        let price = my_price;

        e["plan_amount"] = price;
        return e;
      });
    const NMOBILE_PRICE = allDataList
      .filter((e) => e.plan_network === "9MOBILE")
      .map((e) => {
        const { my_price } = e;
        let price = my_price;

        e["plan_amount"] = price;
        return e;
      });
    const CABLETV = await cabletvModel.find({});
    res.status(200).json({
      newUser: user,
      user,
      token,
      transactions: [],
      isAdmin: user._id === process.env.ADMIN_ID ? true : false,
      subscriptionPlans: {
        MTN: MTN_SME_PRICE,
        GLO: GLO_PRICE,
        AIRTEL: AIRTEL_PRICE,
        NMOBILE: NMOBILE_PRICE,
        CABLETV: CABLETV,
        CABLENAME: cableName,
        DISCO: disco,
        NETWORK: network,
      },
    });
    if (referredBy) newReferral(req.body);

    return;
  } catch (error) {
    return res.status(500).json({ msg: error.message });
  }
};
const login = async (req, res) => {
  const { userName, password } = req.body;
  if (!userName || !password)
    return res.status(400).json({ msg: "Not all fields have been entered." });
  let user = await User.findOne({ userName: userName });
  if (!user) user = await User.findOne({ email: userName });
  if (!user)
    return res
      .status(400)
      .json({ msg: "No account with this detail has been registered." });
  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect)
    return res.status(400).json({ msg: "Incorrect password" });
  // generate account number
  const palmPayExist = user.accountNumbers.find((e) => e.bankName == "palmpay");
  const NPayServiceBankExist = user.accountNumbers.find(
    (e) => e.bankName == "9psb"
  );
  if (!palmPayExist) {
    await generateBillStackAcc({ bankName: "palmpay", userId: user._id });
  }
  if (!NPayServiceBankExist) {
    await generateBillStackAcc({ bankName: "9psb", userId: user._id });
  }

  const token = user.createJWT();
  const isReseller = user.userType === "reseller";
  const isApiUser = user.userType === "api user";

  const userTransaction = await Transaction.find({ trans_By: user._id })
    .limit(100)
    .sort("-createdAt");
  const allDataList = await Data.find();

  const MTN_SME_PRICE = allDataList
    .filter((e) => e.plan_network === "MTN")
    .map((e) => {
      const { resellerPrice, my_price, id } = e;
      let price = my_price;

      if (isReseller || isApiUser) {
        price = resellerPrice;
      }
      e["plan_amount"] = price;
      return e;
    });

  const GLO_PRICE = allDataList
    .filter((e) => e.plan_network === "GLO")
    .map((e) => {
      const { my_price, resellerPrice } = e;
      let price = my_price;

      if (isReseller || isApiUser) {
        price = resellerPrice;
      }
      e["plan_amount"] = price;
      return e;
    });
  const AIRTEL_PRICE = allDataList
    .filter((e) => e.plan_network === "AIRTEL")
    .map((e) => {
      const { my_price, resellerPrice } = e;
      let price = my_price;

      if (isReseller || isApiUser) {
        price = resellerPrice;
      }
      e["plan_amount"] = price;
      return e;
    });
  const NMOBILE_PRICE = allDataList
    .filter((e) => e.plan_network === "9MOBILE")
    .map((e) => {
      const { my_price, resellerPrice } = e;
      let price = my_price;

      if (isReseller || isApiUser) {
        price = resellerPrice;
      }
      e["plan_amount"] = price;
      return e;
    });
  const CABLETV = await cabletvModel.find({});
  if (!user.apiToken) {
    const generatedRandomToken = randomToken.generate(30);
    console.log(generatedRandomToken);
    await User.updateOne(
      { email: user.email },
      { $set: { apiToken: generatedRandomToken } },
      { new: true, runValidators: true }
    );
    user.apiToken === generatedRandomToken;
  }

  return res.status(200).json({
    token: token,
    // user: {
    //   userName: user.userName,
    //   fullName: user.userName,
    //   email: user.email,
    //   balance: user.balance,
    //   apiToken: user.apiToken,
    //   reservedAccountNo: user.reservedAccountNo,
    //   reservedAccountBank: user.reservedAccountBank,
    //   reservedAccountNo2: user.reservedAccountNo2,
    //   reservedAccountBank2: user.reservedAccountBank2,
    // },
    user,
    transactions: userTransaction,
    isAdmin: user._id === process.env.ADMIN_ID ? true : false,
    isCouponVendor:
      user._id === process.env.COUPON_VENDOR_FAIZ ||
      user._id === process.env.COUPON_VENDOR_YUSUF
        ? true
        : false,
    subscriptionPlans: {
      MTN: MTN_SME_PRICE,
      GLO: GLO_PRICE,
      AIRTEL: AIRTEL_PRICE,
      NMOBILE: NMOBILE_PRICE,
      CABLETV: CABLETV,
      CABLENAME: cableName,
      DISCO: disco,
      NETWORK: network,
    },
  });
};

const userData = async (req, res) => {
  // return details of the user and purchase objects
  const { userId, userType } = req.user;
  const isReseller = userType === "reseller";
  const isApiUser = userType === "api user";
  let user = await User.findOne({ _id: userId });
  // const data = await Data.find();
  // console.log(data);
  const userTransaction = await Transaction.find({ trans_By: userId })
    .limit(10)
    .sort("-createdAt");
  const allDataList = await Data.find().sort("dataplan_id");
  // const allDataList = MTN_SME;

  const MTN_SME_PRICE = allDataList
    .filter((e) => e.plan_network === "MTN")
    .map((e) => {
      const { resellerPrice, my_price, id } = e;
      let price = my_price;

      if (isReseller || isApiUser) {
        price = resellerPrice;
      }
      e["plan_amount"] = price;
      return e;
    });

  const GLO_PRICE = allDataList
    .filter((e) => e.plan_network === "GLO")
    .map((e) => {
      const { my_price, resellerPrice } = e;
      let price = my_price;

      if (isReseller || isApiUser) {
        price = resellerPrice;
      }
      e["plan_amount"] = price;
      return e;
    });
  const AIRTEL_PRICE = allDataList
    .filter((e) => e.plan_network === "AIRTEL")
    .map((e) => {
      const { my_price, resellerPrice } = e;
      let price = my_price;

      if (isReseller || isApiUser) {
        price = resellerPrice;
      }
      e["plan_amount"] = price;
      return e;
    });
  const NMOBILE_PRICE = allDataList
    .filter((e) => e.plan_network === "9MOBILE")
    .map((e) => {
      const { my_price, resellerPrice } = e;
      let price = my_price;

      if (isReseller || isApiUser) {
        price = resellerPrice;
      }
      e["plan_amount"] = price;
      return e;
    });
  const CABLETV = await cabletvModel.find({});
  if (user.apiToken === undefined) {
    const generatedRandomToken = randomToken.generate(30);
    await User.updateOne(
      { email: user.email },
      { $set: { apiToken: generatedRandomToken } },
      { new: true, runValidators: true }
    );
    user.apiToken === generatedRandomToken;
  }

  res.status(200).json({
    user,
    transactions: userTransaction,
    isAdmin: userId === process.env.ADMIN_ID ? true : false,
    isCouponVendor:
      userId === process.env.COUPON_VENDOR_FAIZ ||
      userId === process.env.COUPON_VENDOR_YUSUF
        ? true
        : false,
    subscriptionPlans: {
      MTN: MTN_SME_PRICE,
      GLO: GLO_PRICE,
      AIRTEL: AIRTEL_PRICE,
      NMOBILE: NMOBILE_PRICE,
      CABLETV: CABLETV,
      CABLENAME: cableName,
      DISCO: disco,
      NETWORK: network,
    },
  });
};

const updateUser = async (req, res) => {
  const {
    user: { userId },
    params: { id },
  } = req;
  if (id !== userId)
    return res
      .status(401)
      .json({ msg: "You are not allowed to update this user" });
  // if (req.body.userType && req.body.userType !== "reseller") {
  const resellerAmount = 1000;
  // console.log(resellerAmount);
  const user = await User.findOne({ _id: userId });
  // console.log(user);
  if (user.userType === req.body.userType)
    return res.status(400).json({ msg: "You are already a reseller" });
  if (user.balance < resellerAmount)
    return res.status(400).json({ msg: "Insufficient balance" });
  // console.log("here");
  await User.updateOne(
    { _id: userId },
    {
      $inc: {
        balance: -resellerAmount,
      },
    }
  );
  const upgradeTransaction = Transaction({
    trans_Id: uuid(),
    trans_By: userId,
    trans_Type: "wallet",
    trans_Network: "upgrade",
    phone_number: `upgrade to ${req.body.userType}`,
    trans_amount: resellerAmount,
    balance_Before: user.balance,
    balance_After: user.balance - resellerAmount,
    trans_Date: `${new Date().toDateString()} ${new Date().toLocaleTimeString()}`,
    trans_Status: "success",
    createdAt: Date.now(),
  });

  await upgradeTransaction.save();
  await User.updateOne(
    { _id: userId },
    { ...req.body },
    { runValidators: true }
  );

  res.status(200).json({ msg: "user updated successfully" });
  if (user.referredBy) {
    const referralBonus = 500;
    const referrer = await User.findOne({ userName: user.referredBy });
    if (!referrer) return;
    await BONUS_RECEIPT({ referrer, user, referralBonus });
    await User.updateOne(
      { _id: referrer._id },
      { $inc: { balance: referralBonus } }
    );
  }
  return;
};
const deleteUser = async (req, res) => {
  const {
    user: { userId },
    params: { id },
  } = req;
  if (id !== userId)
    return res
      .status(401)
      .json({ msg: "You are not allowed to delete this user" });
  try {
    await User.findByIdAndDelete(userId);
    res.json({ msg: "user deleted successfully" });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
const validateToken = async (req, res) => {
  try {
    const token = req.header("x-auth-token");
    if (!token) return res.json(false);

    const verified = jwt.verify(token, process.env.JWT_SECRET);
    if (!verified) return res.json(false);

    const user = await User.findById(verified.userId);
    if (!user) return res.json(false);
    await User.updateOne(
      { _id: user.id },
      { $currentDate: { lastLogin: true } }
    );
    return res.json(true);
  } catch (err) {
    // console.log(err);
    res.status(500).json({ msg: err.message });
  }
};
const requestPasswordReset = async (req, res) => {
  // res.status(200).json({ msg: "password reet successful" });
  const { email } = req.body;
  if (!email) return res.status(400).json({ msg: "Please provide email" });
  const user = await User.findOne({ email: email });

  if (!user)
    return res
      .status(400)
      .json({ msg: "No account with this email has been registered." });
  try {
    let token = await Token.findOne({ userId: user._id });
    if (token)
      return res.status(400).json({
        msg: "You just requested a password reset please check your email or try again later",
      });
    let resetToken = crypto.randomBytes(32).toString("hex");
    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(resetToken, salt);
    await new Token({
      userId: user._id,
      token: hash,
      createdAt: Date.now(),
    }).save();

    const link = `${process.env.FRONTEND_URL}/passwordReset/${resetToken}/${user._id}`;
    sendEmail(
      user.email,
      "Password Reset Request",
      { name: user.fullName, link: link },
      "../templates/requestResetPassword.handlebars"
    );

    return res.status(200).json({
      msg: "An email has been sent to you. Kindly check your email. Check spam folder if not found",
    });
  } catch (error) {
    console.log(error);
  }
};
const resetPassword = async (req, res) => {
  const { token, userId, newPassword, newPasswordCheck } = req.body;
  if (!newPassword || !newPasswordCheck || !token || !userId)
    return res.status(400).json({ msg: "All fields are required" });
  if (newPassword !== newPasswordCheck)
    return res
      .status(400)
      .json({ msg: "Enter the same password for verification" });
  try {
    let passwordResetToken = await Token.findOne({ userId });
    if (!passwordResetToken)
      return res
        .status(400)
        .json({ msg: "Invalid or expired password reset token" });
    const isValid = await bcrypt.compare(token, passwordResetToken.token);

    if (!isValid)
      return res
        .status(400)
        .json({ msg: "Invalid or expired password reset token" });

    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(newPassword, salt);
    await User.updateOne({ _id: userId }, { $set: { password: hash } });
    const user = await User.findById({ _id: userId });
    sendEmail(
      user.email,
      "Password Reset Successful",
      {
        name: user.fullName,
        link: process.env.FRONTEND_URL,
      },
      "../templates/resetPassword.handlebars"
    );
    await passwordResetToken.deleteOne();
    return res
      .status(200)
      .json({ msg: "You have successfully reset your password" });
  } catch (error) {
    console.log(error);
  }
};
const requestPinReset = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ msg: "Please provide email" });
  const user = await User.findOne({ email: email });

  if (!user)
    return res
      .status(400)
      .json({ msg: "No account with this email has been registered." });
  try {
    let token = await Token.findOne({ userId: user._id });
    // if (token) await token.deleteOne();
    if (token)
      return res.status(400).json({
        msg: "You just requested a pin reset please check your email or try again later",
      });
    let resetToken = crypto.randomBytes(32).toString("hex");
    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(resetToken, salt);
    await new Token({
      userId: user._id,
      token: hash,
      createdAt: Date.now(),
    }).save();

    const link = `${process.env.FRONTEND_URL}/pinReset/${resetToken}/${user._id}`;
    sendEmail(
      user.email,
      "Transaction Pin Reset Request",
      { name: user.fullName, link: link },
      "../templates/requestResetPin.handlebars"
    );

    return res.status(200).json({
      msg: "An email has been sent to you. Kindly check your email. Check spam folder if not found",
    });
  } catch (error) {
    console.log(error);
  }
};

const resetPin = async (req, res) => {
  const { token, userId, newPin, newPinCheck } = req.body;
  if (!newPin || !newPinCheck || !token || !userId)
    return res.status(400).json({ msg: "All fields are required" });
  if (newPin !== newPinCheck)
    return res
      .status(400)
      .json({ msg: "Enter the same password for verification" });
  try {
    let passwordResetToken = await Token.findOne({ userId });
    if (!passwordResetToken)
      return res
        .status(400)
        .json({ msg: "Invalid or expired password reset token" });
    const isValid = await bcrypt.compare(token, passwordResetToken.token);

    if (!isValid)
      return res
        .status(400)
        .json({ msg: "Invalid or expired password reset token" });

    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(newPin, salt);
    await User.updateOne({ _id: userId }, { $set: { userPin: hash } });
    const user = await User.findById({ _id: userId });
    sendEmail(
      user.email,
      "Transaction pin reset successful",
      {
        name: user.fullName,
        link: process.env.FRONTEND_URL,
      },
      "../templates/pinReset.handlebars"
    );
    await passwordResetToken.deleteOne();
    return res
      .status(200)
      .json({ msg: "You have successfully reset your pin" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "An error occcured" });
  }
};
const transferFund = async (req, res) => {
  // res.status(200).json({msg:"tranfer successful"})
  const { userName, amount, userPin } = req.body;
  const { userId } = req.user;

  const sender = await User.findById(userId);
  const { balance } = sender;
  let receiver = await User.findOne({ userName: userName });
  if (!receiver) receiver = await User.findOne({ email: userName });
  if (!userName || !amount)
    return res.status(400).json({ msg: "All fields are required " });
  if (!receiver)
    return res
      .status(400)
      .json({ msg: "No account with the username provided " });

  if (userId !== process.env.ADMIN_ID)
    return res.status(400).json({ msg: "Only admin can access this route" });
  if (
    amount < 500 &&
    userId !== process.env.ADMIN_ID &&
    userId !== process.env.COUPON_VENDOR_FAIZ &&
    userId !== process.env.COUPON_VENDOR_YUSUF
  )
    return res.status(400).json({ msg: "Minimum transfer is ₦500" });
  if (userName === sender.userName)
    return res.status(400).json({ msg: "You cannot transfer to yourself" });
  if (balance < amount)
    return res
      .status(400)
      .json({ msg: "You cannot transfer more than your balance" });
  try {
    // Transfer transaction

    const senderResponse = await TRANSFER_RECEIPT({
      isSender: true,
      receiver,
      amount,
      balance,
      userId,
    });
    if (senderResponse) {
      // Remove amount from sender balance
      console.log("before");
      await User.updateOne({ _id: userId }, { $inc: { balance: -amount } });
      console.log("after");
    }
    const receiverResponse = await TRANSFER_RECEIPT({
      isSender: false,
      sender,
      amount,
      receiver,
    });
    if (receiverResponse) {
      // add amount to receiver balance
      await User.updateOne(
        { userName: userName },
        { $inc: { balance: amount } }
      );
    }

    return res.status(200).json({
      msg: `You have successfully transfer ₦${amount} to ${userName}`,
      amount: amount,
      receipt: senderResponse,
    });
  } catch (error) {
    // if error return the amount to sender

    return res.status(500).json({ msg: error.message });
  }
};
const changePassword = async (req, res) => {
  const { oldPassword, newPassword, newPasswordCheck } = req.body;
  const user = await User.findById(req.user.userId);
  if (!(oldPassword, newPassword, newPasswordCheck))
    return res.status(400).json({ msg: "All fields are required" });
  if (oldPassword === newPassword)
    return res.status(400).json({
      msg: "You cannot use your old password.Kindly use a new password",
    });
  if (newPassword !== newPasswordCheck)
    return res
      .status(400)
      .json({ msg: "Enter the same password for verification" });

  const isOldPasswordMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isOldPasswordMatch)
    return res.status(400).json({ msg: "Your old password is wrong" });
  try {
    const salt = await bcrypt.genSalt();
    const newPasswordHash = await bcrypt.hash(newPassword, salt);
    await User.updateOne(
      { _id: req.user.userId },
      { $set: { password: newPasswordHash } }
    );
    return res.status(200).json({ msg: "Password Changed successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ msg: "An error occured" });
  }
};

const validateUser = async (req, res) => {
  try {
    let user = await User.findOne({ userName: req.params.userName });
    if (!user) user = await User.findOne({ email: req.params.userName });
    if (!user) return res.status(404).json({ msg: "user does not exist" });
    return res.status(200).json({ msg: user.email });
  } catch (error) {
    console.log(error);
  }
};
// Contacts controller

const fetchContact = async (req, res) => {
  const { userId } = req.user;
  try {
    const { _id } = await User.findById(userId);
    const contactList = await Contact.find({ userId: _id }).sort("-createdAt");
    res.status(200).json({ msg: "contact list fetched", contactList });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ msg: "something went wrong" });
  }
};
const addContact = async (req, res) => {
  const { userId } = req.user;
  const { contactName, contactNumber, contactNetwork } = req.body;
  if (!contactName || !contactNumber || !contactNetwork)
    return res.status(400).json({ msg: "all fields are required" });
  if (contactName.length > 11)
    return res
      .status(400)
      .json({ msg: "max length for contact name is 11 character " });
  if (contactNumber.length !== 11)
    return res.status(400).json({ msg: "Enter a valid number" });
  try {
    const { _id } = await User.findById(userId);
    const totalContact = await Contact.countDocuments({ userId: _id });
    if (totalContact >= 10)
      return res
        .status(400)
        .json({ msg: "Max number of contact reached, please delete some " });
    // creating the contact
    const isContactExist = await Contact.findOne({
      userId: _id,
      contactNumber,
    });
    if (isContactExist)
      return res.status(400).json({ msg: "This number is saved already" });
    await Contact.create({ userId: _id, ...req.body, createdAt: Date.now() });

    res.status(201).json({ msg: "Contact added" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ msg: "something went wrong" });
  }
};
const updateContact = async (req, res) => {
  const { contactName, contactNumber, contactNetwork } = req.body;
  const { userId } = req.user;
  if (!contactName || !contactNumber || !contactNetwork)
    return res.status(400).json({ msg: "all fields are required" });
  if (contactName.length > 11)
    return res
      .status(400)
      .json({ msg: "max length for contact name is 11 character " });
  if (contactNumber.length !== 11)
    return res.status(400).json({ msg: "Enter a valid number" });
  try {
    const { _id } = await User.findById(userId);
    const contactToUpdate = await Contact.findById(req.params.contactId);
    await Contact.updateOne(
      {
        userId: _id,
        _id: contactToUpdate._id,
      },
      { $set: { ...req.body, createdAt: Date.now() } }
    );
    res.status(200).json({ msg: "Contact updated" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ msg: "something went wrong" });
  }
};
const deleteContact = async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.contactId);
    res.status(200).json({ msg: "Contact deleted " });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "something went wrong" });
  }
};
const updateWebhookUrl = async (req, res) => {
  const { webhookUrl } = req.body;
  console.log(webhookUrl);
  const startWithHttps = webhookUrl.startsWith("https://");
  if (!startWithHttps)
    return res.status(400).json({ msg: "must start with https://" });
  try {
    await User.updateOne({ _id: req.user.userId }, { $set: { webhookUrl } });
    return res.status(200).json({ msg: "webhook updated successfully" });
  } catch (error) {
    return res.status(500).json({ msg: "something went wrong" });
  }
};
const fetchReferral = async (req, res) => {
  const { userId } = req.user;
  const { page } = req.query;
  try {
    // const
    //   let result = Referral.find(queryObject);
    console.log(userId);
    const { userName, earningBalance } = await User.findOne({ _id: userId });
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const referralList = await Referral.find({ referredBy: userName })
      .skip(skip)
      .limit(limit);

    const totalReferred = await Referral.find({
      referredBy: userName,
    }).countDocuments();
    // console.log(referralList);
    let totalEarned = referralList.reduce((acc, curr) => {
      return (acc += curr.amountEarned);
    }, 0);

    res.status(200).json({
      msg: "fetched",
      referralList: referralList.reverse(),
      earningBalance,
      totalEarned,
      totalReferred,
    });
  } catch (error) {
    console.log(error);
  }
};
const withdrawEarning = async (req, res) => {
  const { userId } = req.user;
  try {
    const {
      balance,
      earningBalance,
      userName,
      userType,
      withdrawalDetails,
      isPartner,
    } = await User.findOne({
      _id: userId,
    });
    let amountToWithdraw = earningBalance;

    // check if the user reach the minimum withdrawal
    if (!earningBalance || earningBalance < 1000)
      return res.status(400).json({ msg: "Minimum withdrawal is ₦1000 " });
    //check if he has sufficient amount
    if (amountToWithdraw > earningBalance)
      return res
        .status(400)
        .json({ msg: "Insufficient balance for this operation" });
    //deduct from earning balance
    await User.updateOne(
      { _id: userId },
      { $inc: { earningBalance: -amountToWithdraw } }
    );
    if (isPartner) {
      // Remove 15% charges
      amountToWithdraw = amountToWithdraw - amountToWithdraw * 0.15;
      // const {acc}= req.body;
      await generateReceipt({
        transactionId: uuid(),
        planNetwork: "withdrawal",
        planName: `withdrawal request of ₦${earningBalance} `,
        phoneNumber: userName,
        status: "pending",
        amountToCharge: amountToWithdraw,
        balance,
        userId,
        userName: userName,
        type: "earning",
        increased: "none",
        response: `withdrawal request of ₦${earningBalance} to ${withdrawalDetails.nameOnAccount} ${withdrawalDetails.bank} ${withdrawalDetails.accountNumber} `,
      });
      return res
        .status(200)
        .json({ msg: "withdrawal is pending for admin's approval" });
    }
    // and add to main balance
    await User.updateOne(
      { _id: userId },
      { $inc: { balance: amountToWithdraw } }
    );
    //create a transaction for the transfer
    await generateReceipt({
      transactionId: uuid(),
      planNetwork: "withdrawal",
      planName: `transfer of ₦${earningBalance} to main balance`,
      phoneNumber: userName,
      status: "success",
      amountToCharge: amountToWithdraw,
      balance,
      userId,
      userName: userName,
      type: "earning",
      increased: true,
    });
    //respond to the request
    res.status(200).json({ msg: "withdrawal successful" });
  } catch (error) {
    // respond to the request
    console.log(error);
    res.status(500).json({ msg: "Something went wrong" });
  }
};
const upgradeToPartner = async (req, res) => {
  const { userId } = req.user;
  const { bank, accountNumber, nameOnAccount } = req.body;
  try {
    const user = await User.findOne({ _id: userId });
    if (!user) return res.status(400).json({ msg: "user does not exist" });
    //check if user has already upgraded
    if (user.isPartner)
      return res.status(400).json({ msg: "You are already a partner" });
    if (user.balance < 1000)
      return res
        .status(400)
        .json({ msg: "Insufficient balance for this operation" });
    //upgrade user to partner and deduct the amount
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          isPartner: true,
          withdrawalDetails: {
            bank,
            accountNumber,
            nameOnAccount,
          },
        },
        $inc: { balance: -1000 },
      }
    );
    //generate receipt
    await generateReceipt({
      transactionId: uuid(),
      planNetwork: `upgrade to partnership package`,
      planName: `₦ ${1000}`,
      phoneNumber: user.userName,
      status: "success",
      amountToCharge: 1000,
      balance: user.balance,
      userId: user._id,
      userName: user.userName,
      type: "earning",
      wavedAmount: 1000, //profit decreased
    });
    //send email
    sendEmail(
      user.email,
      "Thanks for becoming a partner with us",
      { name: user.fullName || user.userName, link: process.env.FRONTEND_URL },
      "../templates/upgradeSuccess.handlebars"
    );
    //return response
    res
      .status(200)
      .json({ msg: "You have successfully upgraded to a partner" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "An error occur please contact an Admin" });
  }
};
const updateKyc = async (req, res) => {
  const { userId } = req.user;
  const { nin: ninNo, bvn: bvnNo } = req.body;
  const {
    MONNIFY_API_URL,
    // MONNIFY_API_ENCODED,
    MONNIFY_API_KEY,
    MONNIFY_API_SECRET,
  } = process.env;
  if (!ninNo && !bvnNo) {
    return res.status(400).json({ msg: "Please provide Bvn/Nin" });
  }

  const { userName, email, bvn, nin, accountNumbers } = await User.findOne({
    _id: userId,
  });
  if (bvn || nin)
    return res.status(400).json({ msg: "You have done your KYC before" });
  if (accountNumbers.length < 1) {
    const response = await generateAcc({
      userName,
      email,
      bvn: bvnNo,
      nin: ninNo,
    });
    // console.log(response);
    if (!response.status) {
      return res.status(400).json({ msg: response.msg });
    } else {
      const kycDetails = {
        fullName: response.msg,
        bvn: bvnNo,
        nin: ninNo,
      };
      // console.log("here");
      const isUpdated = await User.updateOne(
        { _id: userId },
        { $set: { ...kycDetails } }
      );
      console.log({ isUpdated });
      return res.status(200).json({ msg: response.msg });
    }
  }
  const ApiKeyEncoded = Buffer.from(
    MONNIFY_API_KEY + ":" + MONNIFY_API_SECRET
  ).toString("base64");
  const response = await axios.post(
    `${MONNIFY_API_URL}/api/v1/auth/login`,
    {},
    {
      headers: {
        Authorization: `Basic ${ApiKeyEncoded}`,
      },
    }
  );
  const {
    responseBody: { accessToken },
  } = response.data;
  console.log({ userName });
  const updateKYC = async (reference) => {
    let result = {};
    try {
      const accountDetails = await axios.put(
        `${MONNIFY_API_URL}/api/v1/bank-transfer/reserved-accounts/${reference}/kyc-info`,
        { ...req.body },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      const { accountName } = accountDetails.data.responseBody;

      if (accountDetails.status == 200) {
        result.status = true;
        result.msg = accountName;
      }
    } catch (error) {
      console.log({ statusCode: error.response.status });
      result.status = false;
      result.msg = error.response.data.responseMessage;
      result.statusCode = error.response.status;
    }
    console.log({ reference, result });
    return result;
  };
  let responseObject = await updateKYC(email);

  if (!responseObject.status && responseObject.statusCode != 422) {
    console.log("first");
    //422 means invalid id no provided
    responseObject = await updateKYC(userName);
  }
  if (responseObject.status) {
    const kycDetails = {
      fullName: responseObject.msg,
      bvn: bvnNo,
      nin: ninNo,
    };
    // console.log("here");
    const isUpdated = await User.updateOne(
      { _id: userId },
      { $set: { ...kycDetails } }
    );
    console.log({ isUpdated });
    return res
      .status(200)
      .json({ msg: `${kycDetails.fullName} has been added as your full name` });
  } else {
    return res.status(500).json({ msg: responseObject.msg });
  }
};
module.exports = {
  register,
  login,
  updateUser,
  deleteUser,
  validateToken,
  userData,
  requestPasswordReset,
  resetPassword,
  requestPinReset,
  resetPin,
  transferFund,
  changePassword,
  validateUser,
  addContact,
  deleteContact,
  fetchContact,
  updateContact,
  updateWebhookUrl,
  fetchReferral,
  upgradeToPartner,
  withdrawEarning,
  updateKyc,
};
