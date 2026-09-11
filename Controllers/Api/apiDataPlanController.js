const DataModel = require("../../Models/dataModel");
const pricingService = require("../../Services/pricingService");
const { sendApiError, API_ERROR_CODES } = require("../../Utils/apiErrorCodes");

const getDataPlans = async (req, res) => {
  try {
    const { network } = req.query;
    const query = { isAvailable: true };
    if (network) query.plan_network = { $regex: `^${network}$`, $options: "i" };

    const plans = await DataModel.find(query).select(
      "-planCostPrice -volumeRatio -partnerPrice -planSupplier -my_price -resellerPrice"
    );

    const priced = await Promise.all(
      plans.map(async (plan) => {
        const planCode = plan.dataplan_id || String(plan.id);
        const { chargedAmount } = await pricingService.resolveDataPrice({
          apiAccess: req.apiUser,
          planCode,
          plan,
        });
        return {
          planCode,
          network: plan.plan_network,
          name: plan.plan,
          price: chargedAmount,
          validity: plan.month_validate,
        };
      })
    );

    return res.status(200).json({ success: true, plans: priced });
  } catch (error) {
    console.log("getDataPlans (v2) error:", error);
    return sendApiError(res, 500, API_ERROR_CODES.INTERNAL_ERROR, "Internal server error.");
  }
};

module.exports = { getDataPlans };
