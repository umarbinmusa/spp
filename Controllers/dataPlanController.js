const dataModel = require("../Models/dataModel");

const fetchDataPlan = async (req, res) => {
  const { network, dataType } = req.query;
  const queryInfo = {};
  if (network && network !== "all") {
    queryInfo.plan_network = network;
  }
  if (dataType && dataType !== "all") {
    queryInfo.plan_type = dataType;
  }
  const plans = await dataModel.find(queryInfo).sort("volumeRatio");
  res.json(plans);
};
const addPlan = async (req, res) => {
  const requiredFields = [
    "planNetwork",
    "planName",
    "planType",
    "planValidity",
    "planId",
    "resellerPrice",
    "smartEarnerPrice",
    "apiPrice",
    "planCostPrice",
    "partnerPrice",
    "planVolumeRatio",
  ];

  const missingFields = requiredFields.filter((field) => !req.body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      msg: `Missing or empty fields: ${missingFields.join(", ")}`,
    });
  }
  try {
    const {
      planNetwork,
      planName,
      planType,
      planValidity,
      planId,
      resellerPrice,
      smartEarnerPrice,
      apiPrice,
      planCostPrice,
      partnerPrice,
      planAvailability,
      planVolumeRatio,
    } = req.body;
    const networkNumber = { MTN: 1, GLO: 2, AIRTEL: 3, "9MOBILE": 4 };
    await dataModel.create({
      id: planId,
      dataplan_id: toString(planId),
      network: networkNumber[planNetwork],
      plan_network: planNetwork,
      plan_type: planType,
      month_validate: planValidity,
      plan: planName,
      plan_amount: smartEarnerPrice,
      my_price: smartEarnerPrice,
      resellerPrice: resellerPrice,
      partnerPrice: partnerPrice,
      apiPrice: apiPrice,
      volumeRatio: planVolumeRatio,
      planCostPrice: planCostPrice,
      isAvailable: planAvailability ? true : false,
    });
    res.status(200).json({ msg: "The plan has been updated " });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Something went wrong" });
  }
};
const deletePlan = async (req, res) => {
  try {
    const planId = req.query.planId;
    if (!planId)
      return res.status(400).json({ msg: "Plan Id must be provided" });
    await dataModel.deleteOne({ _id: planId });
    res.status(200).json({ msg: "Plan Deleted successfully" });
  } catch (error) {
    res.status(500).json({ msg: "Something went wrong" });
  }
};
const updatePlan = async (req, res) => {
  const requiredFields = [
    "_id",
    "planNetwork",
    "planName",
    "planType",
    "planValidity",
    "planId",
    "resellerPrice",
    "smartEarnerPrice",
    "apiPrice",
    "planCostPrice",
    "partnerPrice",
    "planVolumeRatio",
  ];

  const missingFields = requiredFields.filter((field) => !req.body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      msg: `Missing or empty fields: ${missingFields.join(", ")}`,
    });
  }
  try {
    const {
      _id,
      planNetwork,
      planName,
      planType,
      planValidity,
      planId,
      resellerPrice,
      smartEarnerPrice,
      apiPrice,
      planCostPrice,
      partnerPrice,
      planAvailability,
      planVolumeRatio,
    } = req.body;
    const networkNumber = { MTN: 1, GLO: 2, AIRTEL: 3, "9MOBILE": 4 };
    await dataModel.findOneAndUpdate(
      { _id },
      {
        $set: {
          id: planId,
          dataplan_id: planId,
          network: networkNumber[planNetwork],
          plan_network: planNetwork,
          plan_type: planType,
          month_validate: planValidity,
          plan: planName,
          plan_amount: smartEarnerPrice,
          my_price: smartEarnerPrice,
          resellerPrice: resellerPrice,
          partnerPrice: partnerPrice,
          apiPrice: apiPrice,
          volumeRatio: planVolumeRatio,
          planCostPrice: planCostPrice,
          isAvailable: planAvailability ? true : false,
        },
      }
    );
    res.status(200).json({ msg: "The plan has been updated " });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Something went wrong" });
  }
};
module.exports = {
  fetchDataPlan,
  addPlan,
  deletePlan,
  updatePlan,
};
