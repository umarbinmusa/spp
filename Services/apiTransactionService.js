const { v4: uuid } = require("uuid");
const ApiTransaction = require("../Models/apiTransactionModel");
const DataModel = require("../Models/dataModel");
const walletService = require("./walletService");
const pricingService = require("./pricingService");
const webhookService = require("./webhookService");

// Reuse the exact same supplier-integration functions the website purchase
// flow uses — we are not duplicating business logic, only wrapping it with
// API-specific pricing, idempotency and wallet handling.
const BUYAIRTIME = require("../Controllers/APICALLS/Airtime/buyAirtime");
const BUYDATA = require("../Controllers/APICALLS/Data/Data");
const BUYELECTRICITY = require("../Controllers/APICALLS/Electricity/electricity");

// IMPORTANT: this legacy backend uses DIFFERENT numeric network IDs for
// airtime vs. data — confirmed against buyAirtime/buyData controllers and
// API_DATA/network.js. 9MOBILE is "4" for airtime but "6" for data. Do not
// unify these into a single map.
const AIRTIME_NETWORK_ID_MAP = { MTN: "1", GLO: "2", AIRTEL: "3", "9MOBILE": "4" };
const DATA_NETWORK_ID_MAP = { MTN: "1", GLO: "2", AIRTEL: "3", "9MOBILE": "6" };

const genTransactionId = () => {
  return `AST-${Date.now().toString(36).toUpperCase()}${uuid().split("-")[0].toUpperCase()}`;
};

const findExistingByRequestId = async (apiUserId, requestId) => {
  if (!requestId) return null;
  return ApiTransaction.findOne({ apiUser: apiUserId, requestId });
};

/**
 * Creates the PENDING ApiTransaction row. The unique (apiUser, requestId)
 * index is the real idempotency guarantee — if two identical requests race
 * each other, the second insert throws E11000 and we return the first one.
 */
const createPendingTransaction = async (data) => {
  try {
    return { txn: await ApiTransaction.create(data) };
  } catch (error) {
    if (error.code === 11000) {
      const existing = await findExistingByRequestId(data.apiUser, data.requestId);
      if (existing) return { txn: null, duplicate: existing };
    }
    throw error;
  }
};

const processAirtime = async ({ apiAccess, phone, network, amount, requestId }) => {
  const existing = await findExistingByRequestId(apiAccess._id, requestId);
  if (existing) return { duplicate: true, transaction: existing };

  const net = String(network).toUpperCase();
  const networkId = AIRTIME_NETWORK_ID_MAP[net];
  if (!networkId) {
    return { error: { code: "INVALID_NETWORK", message: `Unsupported network: ${network}` } };
  }
  const faceAmount = Number(amount);
  if (!faceAmount || faceAmount < 50) {
    return { error: { code: "INVALID_AMOUNT", message: "Minimum airtime amount is 50." } };
  }

  const { chargedAmount } = await pricingService.resolveAirtimePrice({ apiAccess, network: net, faceAmount });

  const { txn, duplicate } = await createPendingTransaction({
    apiUser: apiAccess._id,
    user: apiAccess.user,
    requestId,
    transactionId: genTransactionId(),
    service: "AIRTIME",
    network: net,
    phoneNumber: phone,
    amount: faceAmount,
    chargedAmount,
    status: "PENDING",
  });
  if (duplicate) return { duplicate: true, transaction: duplicate };

  const debit = await walletService.debitWallet({
    userId: apiAccess.user,
    amount: chargedAmount,
    type: "AIRTIME",
    transactionRef: txn.transactionId,
    apiTransaction: txn._id,
    source: "API",
  });

  if (!debit.success) {
    txn.status = "FAILED";
    txn.response = { reason: "INSUFFICIENT_BALANCE" };
    await txn.save();
    return {
      error: { code: "INSUFFICIENT_BALANCE", message: "Insufficient wallet balance." },
      transaction: txn,
    };
  }

  let supplierResult;
  try {
    supplierResult = await BUYAIRTIME({ network: networkId, mobile_number: phone, amount: faceAmount });
  } catch (e) {
    supplierResult = { status: false, msg: "Supplier error" };
  }

  if (supplierResult.status) {
    txn.status = "SUCCESS";
    txn.supplierReference = supplierResult.apiResponseId || null;
    txn.response = { msg: supplierResult.msg };
  } else {
    await walletService.creditWallet({
      userId: apiAccess.user,
      amount: chargedAmount,
      type: "REFUND",
      transactionRef: txn.transactionId,
      apiTransaction: txn._id,
      source: "API",
    });
    txn.status = "FAILED";
    txn.response = { msg: supplierResult.msg || "Transaction failed" };
  }
  await txn.save();

  webhookService.dispatch(apiAccess, txn).catch((e) => console.log("webhook dispatch error:", e.message));

  return { transaction: txn };
};

const processData = async ({ apiAccess, phone, network, planCode, requestId }) => {
  const existing = await findExistingByRequestId(apiAccess._id, requestId);
  if (existing) return { duplicate: true, transaction: existing };

  const net = String(network).toUpperCase();
  const networkId = DATA_NETWORK_ID_MAP[net];
  if (!networkId) {
    return { error: { code: "INVALID_NETWORK", message: `Unsupported network: ${network}` } };
  }

  const plan = await DataModel.findOne({ dataplan_id: planCode }).catch(() => null) ||
    (await DataModel.findOne({ id: planCode }).catch(() => null));
  if (!plan) {
    return { error: { code: "PLAN_NOT_FOUND", message: `No data plan matching "${planCode}".` } };
  }
  if (!plan.isAvailable) {
    return { error: { code: "PLAN_NOT_FOUND", message: `${plan.plan_network} ${plan.plan} is currently unavailable.` } };
  }
  if (plan.plan_network && String(plan.plan_network).toUpperCase() !== net) {
    return {
      error: {
        code: "PLAN_NOT_FOUND",
        message: `Plan "${planCode}" belongs to ${plan.plan_network}, not ${net}.`,
      },
    };
  }

  const { chargedAmount } = await pricingService.resolveDataPrice({ apiAccess, planCode, plan });

  const { txn, duplicate } = await createPendingTransaction({
    apiUser: apiAccess._id,
    user: apiAccess.user,
    requestId,
    transactionId: genTransactionId(),
    service: "DATA",
    network: net,
    planCode,
    phoneNumber: phone,
    amount: Number(plan.plan_amount) || chargedAmount,
    chargedAmount,
    status: "PENDING",
  });
  if (duplicate) return { duplicate: true, transaction: duplicate };

  const debit = await walletService.debitWallet({
    userId: apiAccess.user,
    amount: chargedAmount,
    type: "DATA",
    transactionRef: txn.transactionId,
    apiTransaction: txn._id,
    source: "API",
  });

  if (!debit.success) {
    txn.status = "FAILED";
    txn.response = { reason: "INSUFFICIENT_BALANCE" };
    await txn.save();
    return {
      error: { code: "INSUFFICIENT_BALANCE", message: "Insufficient wallet balance." },
      transaction: txn,
    };
  }

  let supplierResult;
  try {
    // NOTE: we deliberately use `networkId` (derived from the client's
    // `network` field) rather than `plan.network`, because the dataModel's
    // `network` field is not populated by the current data-plan seed data
    // (only `plan_network`, the display name, is) — mirroring exactly how
    // the existing website buyData controller sources this value.
    supplierResult = await BUYDATA({ network: networkId, mobile_number: phone, plan: plan.id });
  } catch (e) {
    supplierResult = { status: false, msg: "Supplier error" };
  }

  if (supplierResult.status) {
    txn.status = "SUCCESS";
    txn.response = { msg: supplierResult.msg, data: supplierResult.data };
  } else {
    await walletService.creditWallet({
      userId: apiAccess.user,
      amount: chargedAmount,
      type: "REFUND",
      transactionRef: txn.transactionId,
      apiTransaction: txn._id,
      source: "API",
    });
    txn.status = "FAILED";
    txn.response = { msg: supplierResult.msg || "Transaction failed" };
  }
  await txn.save();

  webhookService.dispatch(apiAccess, txn).catch((e) => console.log("webhook dispatch error:", e.message));

  return { transaction: txn };
};

const processElectricity = async ({ apiAccess, meterId, meterNumber, meterType, amount, requestId }) => {
  const existing = await findExistingByRequestId(apiAccess._id, requestId);
  if (existing) return { duplicate: true, transaction: existing };

  const faceAmount = parseFloat(amount);
  if (!faceAmount || faceAmount <= 0) {
    return { error: { code: "INVALID_AMOUNT", message: "A valid amount is required." } };
  }

  const { fee } = await pricingService.resolveElectricityFee({ apiAccess });
  const chargedAmount = faceAmount + fee;

  const { txn, duplicate } = await createPendingTransaction({
    apiUser: apiAccess._id,
    user: apiAccess.user,
    requestId,
    transactionId: genTransactionId(),
    service: "ELECTRICITY",
    meterNumber,
    amount: faceAmount,
    chargedAmount,
    status: "PENDING",
  });
  if (duplicate) return { duplicate: true, transaction: duplicate };

  const debit = await walletService.debitWallet({
    userId: apiAccess.user,
    amount: chargedAmount,
    type: "ELECTRICITY",
    transactionRef: txn.transactionId,
    apiTransaction: txn._id,
    source: "API",
  });

  if (!debit.success) {
    txn.status = "FAILED";
    txn.response = { reason: "INSUFFICIENT_BALANCE" };
    await txn.save();
    return {
      error: { code: "INSUFFICIENT_BALANCE", message: "Insufficient wallet balance." },
      transaction: txn,
    };
  }

  let supplierResult;
  try {
    supplierResult = await BUYELECTRICITY({ meterId, meterNumber, amount: faceAmount, meterType });
  } catch (e) {
    supplierResult = { status: false, msg: "Supplier error" };
  }

  if (supplierResult.status) {
    txn.status = "SUCCESS";
    txn.response = { msg: supplierResult.msg, token: supplierResult.token };
  } else {
    await walletService.creditWallet({
      userId: apiAccess.user,
      amount: chargedAmount,
      type: "REFUND",
      transactionRef: txn.transactionId,
      apiTransaction: txn._id,
      source: "API",
    });
    txn.status = "FAILED";
    txn.response = { msg: supplierResult.msg || "Transaction failed" };
  }
  await txn.save();

  webhookService.dispatch(apiAccess, txn).catch((e) => console.log("webhook dispatch error:", e.message));

  return { transaction: txn };
};

module.exports = { processAirtime, processData, processElectricity };
