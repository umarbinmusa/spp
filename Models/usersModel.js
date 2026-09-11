const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const validator = require("validator");
const jwt = require("jsonwebtoken");
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Please provide email"],

    validate: {
      validator: validator.isEmail,
      message: "Please provide valid email",
    },
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: [true, "enter a password"],
  },
  referredBy: { type: String, lowercase: true },
  referrals: [
    {
      userName: "",
      email: "",
      amountEarn: 0,
    },
  ],
  accountNumbers: [{ bankName: String, accountNumber: String }],
  referrals: [{ userName: String, totalEarned: Number }],

  userName: { type: String, required: true, lowercase: true, trim: true },
  phoneNumber: { type: String, required: true, trim: true },

  balance: { type: Number },
  apiToken: { type: String },
  lastLogin: { type: Date },
  userType: {
    type: String,
    default: "smart earner",
    enum: ["smart earner", "reseller", "api user"],
  },
  balance: { type: Number, default: 0 },
  createdAt: {
    type: Date,
    default: Date.now,
    // expires: 2592000, // this is the expiry time in seconds(expires in month time)
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  fullName: { type: String, default: "" },
  bvn: { type: String, default: "" },
  nin: { type: String, default: "" },
});

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});
// userSchema.pre("save", async function () {
//   if (!this.isModified("userPin")) return;
//   const salt = await bcrypt.genSalt(10);
//   this.userPin = await bcrypt.hash(this.userPin, salt);
// });

userSchema.methods.comparePassword = async function (canditatePassword) {
  const isMatch = await bcrypt.compare(canditatePassword, this.password);
  return isMatch;
};
// userSchema.methods.compareUserPin = async function (userPin) {
//   const isMatch = await bcrypt.compare(userPin, this.userPin);
//   return isMatch;
// };

userSchema.methods.createJWT = function () {
  return jwt.sign(
    {
      userId: this._id,
      userType: this.userType,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    }
  );
};

module.exports = mongoose.model("User", userSchema);
