const ApiPricing = require("../Models/apiPricingModel");

// Fallback prices used only when nothing has been configured anywhere in
// ApiPricing — this is the last link in the priority chain, never the first.
const FALLBACK_AIRTIME_PERCENTAGE = {
  MTN: 99,
  AIRTEL: 99,
  GLO: 98.5,
  "9MOBILE": 98,
};
const FALLBACK_ELECTRICITY_FEE = 50;

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Resolves the API price for an airtime purchase.
 * Priority: user-specific -> tier -> system default -> hardcoded fallback.
 */
const resolveAirtimePrice = async ({ apiAccess, network, faceAmount }) => {
  const net = String(network).toUpperCase();

  let pricing = await ApiPricing.findOne({
    scope: "USER",
    apiUser: apiAccess._id,
    service: "AIRTIME",
    network: net,
    active: true,
  });
  let source = "USER";

  if (!pricing) {
    pricing = await ApiPricing.findOne({
      scope: "TIER",
      tier: apiAccess.tier,
      service: "AIRTIME",
      network: net,
      active: true,
    });
    source = "TIER";
  }

  if (!pricing) {
    pricing = await ApiPricing.findOne({
      scope: "DEFAULT",
      service: "AIRTIME",
      network: net,
      active: true,
    });
    source = "DEFAULT";
  }

  let percentage;
  if (pricing) {
    percentage = pricing.price;
  } else {
    percentage = FALLBACK_AIRTIME_PERCENTAGE[net] ?? 99;
    source = "FALLBACK";
  }

  const chargedAmount = round2(faceAmount * (percentage / 100));
  return { chargedAmount, percentage, source };
};

/**
 * Resolves the API price for a data plan purchase.
 *
 * Priority: user-specific override -> the plan's own apiPrice field (set
 * via the existing admin "Update Price" screen) -> TIER ApiPricing ->
 * DEFAULT ApiPricing -> reseller/base price as a last resort.
 *
 * The plan's apiPrice is checked before TIER/DEFAULT deliberately: admins
 * already maintain per-plan pricing from the Update Price screen, and that
 * should be the single source of truth for every API user unless the admin
 * has explicitly configured something different for one specific API user.
 * TIER/DEFAULT rules only matter for a plan where apiPrice was never set.
 */
const resolveDataPrice = async ({ apiAccess, planCode, plan }) => {
  const userPricing = await ApiPricing.findOne({
    scope: "USER",
    apiUser: apiAccess._id,
    service: "DATA",
    planCode,
    active: true,
  });
  if (userPricing) {
    return { chargedAmount: round2(userPricing.price), source: "USER" };
  }

  if (plan.apiPrice) {
    return { chargedAmount: round2(Number(plan.apiPrice)), source: "PLAN_API_PRICE" };
  }

  const tierPricing = await ApiPricing.findOne({
    scope: "TIER",
    tier: apiAccess.tier,
    service: "DATA",
    planCode,
    active: true,
  });
  if (tierPricing) {
    return { chargedAmount: round2(tierPricing.price), source: "TIER" };
  }

  const defaultPricing = await ApiPricing.findOne({
    scope: "DEFAULT",
    service: "DATA",
    planCode,
    active: true,
  });
  if (defaultPricing) {
    return { chargedAmount: round2(defaultPricing.price), source: "DEFAULT" };
  }

  const chargedAmount = Number(plan.resellerPrice || plan.my_price);
  return { chargedAmount: round2(chargedAmount), source: "FALLBACK_SYSTEM_PRICE" };
};

/**
 * Resolves the API convenience fee for an electricity purchase.
 */
const resolveElectricityFee = async ({ apiAccess }) => {
  let pricing = await ApiPricing.findOne({
    scope: "USER",
    apiUser: apiAccess._id,
    service: "ELECTRICITY",
    active: true,
  });
  let source = "USER";

  if (!pricing) {
    pricing = await ApiPricing.findOne({
      scope: "TIER",
      tier: apiAccess.tier,
      service: "ELECTRICITY",
      active: true,
    });
    source = "TIER";
  }

  if (!pricing) {
    pricing = await ApiPricing.findOne({
      scope: "DEFAULT",
      service: "ELECTRICITY",
      active: true,
    });
    source = "DEFAULT";
  }

  if (pricing) return { fee: pricing.price, source };
  return { fee: FALLBACK_ELECTRICITY_FEE, source: "FALLBACK" };
};

module.exports = { resolveAirtimePrice, resolveDataPrice, resolveElectricityFee };
