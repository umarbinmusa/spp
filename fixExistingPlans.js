// One-time repair for plans added before the fix. Run: node fixExistingPlans.js
const mongoose = require("mongoose");
require("dotenv").config();
const dataModel = require("./Models/dataModel");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const plans = await dataModel.find({});
  let fixed = 0;
  for (const p of plans) {
    const network = String(p.plan_network || "").trim().toUpperCase();
    const map = { MTN: 1, GLO: 2, AIRTEL: 3, "9MOBILE": 4 };
    const update = {};
    if (p.dataplan_id !== String(p.id) && String(p.dataplan_id).startsWith("[object"))
      update.dataplan_id = String(p.id);
    if (map[network] && (p.plan_network !== network || p.network !== map[network])) {
      update.plan_network = network;
      update.network = map[network];
    }
    if (Object.keys(update).length) {
      await dataModel.updateOne({ _id: p._id }, { $set: update });
      fixed++;
    }
  }
  const hidden = await dataModel.find({ isAvailable: false }).select("id plan plan_network");
  console.log(`Repaired ${fixed} plan(s).`);
  console.log(`Plans still marked unavailable (${hidden.length}):`);
  hidden.forEach((h) => console.log(` - ${h.plan_network} ${h.plan} (id ${h.id})`));
  await mongoose.disconnect();
})();
