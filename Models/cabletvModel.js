const mongoose = require("mongoose");
const cableTvSchema = new mongoose.Schema({
  id: Number,
  cableplan_id: String,
  cable: String,
  package: String,
  plan_amount: String,
});

module.exports = mongoose.model("CableTV", cableTvSchema);
