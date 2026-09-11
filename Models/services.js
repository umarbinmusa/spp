const mongoose = require("mongoose");
const servicesSchema = new mongoose.Schema({
  serviceId: { type: String },
  serviceName: { type: String },
  serviceStatus: { type: Boolean, default: true },
});
module.exports = mongoose.model("service", servicesSchema);
