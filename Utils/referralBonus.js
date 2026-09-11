const User = require("../Models/usersModel");
const Referral = require("../Models/referralModel");
const Transaction = require("../Models/transactionModel");
const generateReceipt = require("../Controllers/generateReceipt");
const { randomUUID } = require("crypto");
const referralBonus = async ({
  sponsorUserName,
  userName,
  bonusAmount,
  amountToCharge,
  partnerPrice,
  sponsorTransId,
}) => {
  // let bonusAmount = "";
  if (bonusAmount < 1) return;
  try {
    const sponsor = await User.findOne({ userName: sponsorUserName });
    console.log(sponsor.userType);
    console.log({
      sponsorUserName,
      userName,
      bonusAmount,
      amountToCharge,
      partnerPrice,
      sponsorTransId,
    });
    if (!sponsor) return;
    if (!sponsor.isPartner) return;
    if (sponsor.isPartner) bonusAmount = amountToCharge - partnerPrice;
    // if (sponsor.userType === "smart earner" || sponsor.userType === "api user")
    //   return;
    // increasing sponsor balance
    await User.updateOne(
      {
        _id: sponsor._id,
      },
      {
        $inc: { earningBalance: bonusAmount },
      }
    );
    console.log("earning balance increased");
    // increasing the total amount earned on the user
    await Referral.updateOne(
      { referredBy: sponsor.userName, userName },
      { $inc: { amountEarned: bonusAmount } }
    );
    console.log("referee balance increased");
    // create the transaction for the sponsor
    const earningId = randomUUID();
    await generateReceipt({
      transactionId: earningId,
      planNetwork: `earning from ${userName}'s transaction`,
      planName: `₦ ${bonusAmount}`,
      phoneNumber: sponsor.userName,
      status: "success",
      amountToCharge: bonusAmount,
      balance: sponsor.earningBalance,
      userId: sponsor._id,
      userName: sponsor.userName,
      type: "earning",
      increased: true,
      wavedAmount: -bonusAmount, //profit decreased
      // volumeRatio: volumeRatio,
    });
    //save the earning ID in the owners transaction in case of refund
    // console.log({ sponsorTransId });
    const isUpdated = await Transaction.updateOne(
      { trans_Id: sponsorTransId },
      { earningId: earningId }
    );
    console.log(isUpdated);
  } catch (error) {
    console.log(`Error in referralBonus : ${error}`);
    return;
  }
};
const reverseReferralBonus = async ({
  sponsorUserName,
  userName,
  bonusAmount: volume,
  // amountToCharge,
  earningId,
}) => {
  console.log({
    sponsorUserName,
    userName,
    bonusAmount: volume,
    // amountToCharge,
    earningId,
  });
  let bonusAmount = volume;
  if (volume < 1) return;
  try {
    // decreasing sponsor balance
    const sponsor = await User.findOne({ userName: sponsorUserName });
    if (!sponsor) return;
    if (!sponsor.isPartner) return;
    if (sponsor.isPartner) {
      // bonusAmount = amountToCharge;
      const sponsorTransaction = await Transaction.findOne({
        trans_Id: earningId,
      });
      if (!sponsorTransaction) {
        console.log("No sponsor transaction");
        return;
      }
      // console.log({ sponsorTransaction });
      const { trans_profit } = sponsorTransaction;
      bonusAmount = Math.abs(trans_profit);
    }
    // if (sponsor.userType === "smart earner" || sponsor.userType === "api user")
    //   return;
    await User.updateOne(
      {
        _id: sponsor._id,
      },
      {
        $inc: { earningBalance: -bonusAmount },
      }
    );
    // decreasing the total amount earned on the user
    await Referral.updateOne(
      { referredBy: sponsor.userName, userName },
      { $inc: { amountEarned: -bonusAmount } }
    );
    // create the transaction for the sponsor
    await generateReceipt({
      transactionId: randomUUID(),
      planNetwork: `chargeback on refunded transaction for ${userName}`,
      planName: `₦ ${-bonusAmount}`,
      phoneNumber: sponsor.userName,
      status: "success",
      amountToCharge: bonusAmount,
      balance: sponsor.earningBalance,
      userId: sponsor._id,
      userName: sponsor.userName,
      type: "earning",
      // wavedAmount: bonusAmount, //profit decreased
    });
  } catch (error) {
    console.log(error);
  }
};
const addReferral = async ({ userName, sponsorId }) => {
  try {
    await Referral.create({ userName, referredBy: sponsorId });
  } catch (error) {
    console.log(error);
  }
};
module.exports = { referralBonus, reverseReferralBonus, addReferral };
