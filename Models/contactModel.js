const mongoose = require("mongoose");
const contactSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "user",
  },
  contactName: { type: String },
  contactNumber: { type: String },
  contactNetwork: { type: String, enum: ["MTN", "GLO", "AIRTEL", "9MOBILE"] },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 2592000, // this is the expiry time in seconds(expires in month time)
  },
});
module.exports = mongoose.model("contact", contactSchema);
