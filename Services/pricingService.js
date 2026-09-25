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
 * Priority: the plan's own apiPrice field (set via the admin "Update Price"
 * screen) -> user-specific ApiPricing override -> TIER ApiPricing ->
 * DEFAULT ApiPricing -> reseller/base price as a last resort.
 *
 * Update Price is checked FIRST and wins outright whenever it's set: that
 * screen is the single source of truth an admin actually uses day-to-day,
 * so an API user must be charged exactly what's configured there. The
 * USER/TIER/DEFAULT ApiPricing rules (configured separately, from the API
 * Management > API Pricing tab) only ever kick in for a plan where nobody
 * has set an apiPrice at all.
 */
const resolveDataPrice = async ({ apiAccess, planCode, plan }) => {
  if (plan.apiPrice) {
    return { chargedAmount: round2(Number(plan.apiPrice)), source: "PLAN_API_PRICE" };
  }

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
