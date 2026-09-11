const usersModel = require("./Models/usersModel");
const Referral = require("./Models/referralModel");
require("dotenv").config();
const mongoose = require("mongoose");

const copyAndDeleteSubdocuments = async () => {
  try {
    mongoose.connect(process.env.MONGODB_URI);
    console.log("DB connected");
    const users = await usersModel.find();
    // await usersModel.updateMany(
    //   {},
    //   {
    //     referrals: [],
    //   }
    // );
    for (const user of users) {
      console.log(user);
      for (const referral of user.referrals ? user.referrals : []) {
        if (!referral._id && !referral.userName) continue;
        const newReferral = new Referral({
          userName: referral.userName,
          referredBy: user.userName,
          amountEarned: 0,
        });
        await newReferral.save();
      }
      console.log("a loop ended");
      // console.log("deleted");
      // await usersModel.findOneAndUpdate(
      //   { _id: user._id },
      //   {
      //     referrals: [],
      //   }
      // );
    }
    console.log("all loop ended");
    process.exit(0);
  } catch (error) {
    console.log(error);
  }
};
copyAndDeleteSubdocuments();
