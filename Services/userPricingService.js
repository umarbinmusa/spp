const UserPricing = require("../Models/userPricingModel");

/**
 * Returns { chargedAmount } if this specific user has a custom AIRTIME
 * price for this network, otherwise null — meaning "fall back to the
 * normal customer/reseller/partner logic".
 */
const resolveUserAirtimePrice = async ({ userId, network, faceAmount }) => {
  const override = await UserPricing.findOne({
    user: userId,
    service: "AIRTIME",
    network: String(network).toUpperCase(),
    active: true,
  });
  if (!override) return null;
  const chargedAmount = Math.round(faceAmount * (override.price / 100) * 100) / 100;
  return { chargedAmount };
};

/**
 * Returns { chargedAmount } if this specific user has a custom DATA price
 * for this exact plan, otherwise null.
 */
const resolveUserDataPrice = async ({ userId, dataId }) => {
  const override = await UserPricing.findOne({
    user: userId,
    service: "DATA",
    dataId,
    active: true,
  });
  if (!override) return null;
  return { chargedAmount: override.price };
};

/**
 * Returns { fee } if this specific user has a custom ELECTRICITY
 * convenience fee, otherwise null.
 */
const resolveUserElectricityFee = async ({ userId }) => {
  const override = await UserPricing.findOne({
    user: userId,
    service: "ELECTRICITY",
    active: true,
  });
  if (!override) return null;
  return { fee: override.price };
};

module.exports = { resolveUserAirtimePrice, resolveUserDataPrice, resolveUserElectricityFee };
