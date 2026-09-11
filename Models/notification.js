const mongoose = require("mongoose");
const notificationSchema = new mongoose.Schema({
  msg: { type: String, default: "You're welcome!" },
});
module.exports = mongoose.model("notification", notificationSchema);
