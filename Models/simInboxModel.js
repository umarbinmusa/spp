const mongoose = require("mongoose");
const inboxSchema = new mongoose.Schema({
  server: { type: String },
  sim: { type: String },
  to: { type: String },
  recipient: { type: String },
  sender: { type: String },
  from: { type: String },
  phone: { type: String },
  message: { type: String },
  keyword: { type: String },
  ref: { type: String },
  date: { type: String },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 2592000, // this is the expiry time in seconds(expires in month time)
  },
});
module.exports = mongoose.model("inbox", inboxSchema);
