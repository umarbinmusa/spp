const dataModel = require("../Models/dataModel");

const NETWORK_NUMBER = { MTN: 1, GLO: 2, AIRTEL: 3, "9MOBILE": 4 };

// "mtn", " Airtel " -> "MTN", "AIRTEL" so plans always land in the right Buy Data list
const normalizeNetwork = (value) => String(value || "").trim().toUpperCase();

// Missing availability = available. Only an explicit false/"false"/0 hides a plan.
const parseAvailability = (value) => {
  if (value === undefined || value === null || value === "") return true;
  return [true, "true", 1, "1", "on"].includes(value);
};

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
    const network = normalizeNetwork(planNetwork);
    if (!NETWORK_NUMBER[network])
      return res.status(400).json({ msg: "Invalid network" });
    if (await dataModel.findOne({ id: planId }))
      return res
        .status(400)
        .json({ msg: "A plan with this Plan ID already exists" });
    await dataModel.create({
      id: planId,
      dataplan_id: String(planId),
      network: NETWORK_NUMBER[network],
      plan_network: network,
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
      isAvailable: parseAvailability(planAvailability),
    });
    res.status(200).json({ msg: "The plan has been added" });
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
    const network = normalizeNetwork(planNetwork);
    if (!NETWORK_NUMBER[network])
      return res.status(400).json({ msg: "Invalid network" });
    await dataModel.findOneAndUpdate(
      { _id },
      {
        $set: {
          id: planId,
          dataplan_id: String(planId),
          network: NETWORK_NUMBER[network],
          plan_network: network,
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
          isAvailable: parseAvailability(planAvailability),
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
