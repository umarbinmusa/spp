const mongoose = require("mongoose");
const costPriceSchema = new mongoose.Schema({
  network: { type: String },
  costPrice: { type: Number },
});
module.exports = CostPrice = mongoose.model("costPrice", costPriceSchema);
