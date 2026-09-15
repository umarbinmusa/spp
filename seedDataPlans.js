// Seeds the Data and CostPrice collections used to populate every "select a
// plan" dropdown in the app. Safe to run more than once — it skips seeding
// a collection that already has documents in it, instead of blindly
// inserting duplicates. Unlike populate.js, this NEVER touches User
// documents or wallet balances.
const mongoose = require("mongoose");
require("dotenv").config();

const dataModel = require("./Models/dataModel");
const costPriceModel = require("./Models/costPriceModel");
const { MTN_SME, GLO, AIRTEL, NMOBILE } = require("./API_DATA/newData");

const costPrices = [
  { network: "MTN", costPrice: 256 },
  { network: "MTN-CG", costPrice: 260 },
  { network: "MTN-SME2", costPrice: 256 },
  { network: "MTN-COUPON", costPrice: 205 },
  { network: "GLO", costPrice: 230 },
  { network: "AIRTEL", costPrice: 207 },
  { network: "9MOBILE", costPrice: 160 },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("DB connected:", mongoose.connection.name);

    const existingPlans = await dataModel.countDocuments();
    if (existingPlans > 0) {
      console.log(`Data collection already has ${existingPlans} plans — skipping (nothing inserted).`);
    } else {
      await dataModel.create(MTN_SME);
      await dataModel.create(AIRTEL);
      await dataModel.create(GLO);
      await dataModel.create(NMOBILE);
      const total = await dataModel.countDocuments();
      console.log(`Inserted data plans. Data collection now has ${total} documents.`);
    }

    const existingCostPrices = await costPriceModel.countDocuments();
    if (existingCostPrices > 0) {
      console.log(`CostPrice collection already has ${existingCostPrices} entries — skipping.`);
    } else {
      await costPriceModel.create(costPrices);
      console.log("Inserted cost prices.");
    }

    console.log("Done. No user balances or accounts were touched.");
    process.exit(0);
  } catch (error) {
    console.log("Seed failed:", error.message);
    process.exit(1);
  }
};

seed();
