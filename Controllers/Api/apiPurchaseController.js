const { sendApiError, API_ERROR_CODES } = require("../../Utils/apiErrorCodes");
const apiTransactionService = require("../../Services/apiTransactionService");
const Services = require("../../Models/services");
const { default: axios } = require("axios");

const isServiceEnabledGlobally = async (serviceNameRegex) => {
  const svc = await Services.findOne({ serviceName: { $regex: serviceNameRegex, $options: "i" } });
  if (!svc) return true; // if admin hasn't configured this service row, don't block on it
  return svc.serviceStatus;
};

const ensureAllowedForApiUser = (apiUser, service) => {
  if (!apiUser.allowedServices || !apiUser.allowedServices.length) return true;
  return apiUser.allowedServices.includes(service);
};

const formatTransactionResponse = (txn) => {
  const base = {
    success: txn.status === "SUCCESS" || txn.status === "PENDING",
    status: txn.status,
    transactionId: txn.transactionId,
    requestId: txn.requestId,
    service: txn.service,
    network: txn.network,
    amount: txn.amount,
    charged: txn.chargedAmount,
  };
  if (txn.status === "SUCCESS") {
    base.message = `${txn.service.charAt(0)}${txn.service.slice(1).toLowerCase()} purchase successful`;
  } else if (txn.status === "PENDING") {
    base.message = "Transaction is being processed";
  } else if (txn.status === "FAILED") {
    base.success = false;
    base.message = (txn.response && txn.response.msg) || "Transaction failed";
  }
  return base;
};

const buyAirtime = async (req, res) => {
  try {
    const { phone, network, amount, requestId } = req.body;
    if (!phone || !network || !amount || !requestId) {
      return sendApiError(
        res,
        400,
        API_ERROR_CODES.INVALID_REQUEST,
        "phone, network, amount and requestId are all required."
      );
    }
    if (!(await isServiceEnabledGlobally("^airtime$"))) {
      return sendApiError(res, 400, API_ERROR_CODES.SERVICE_DISABLED, "Airtime service is currently disabled.");
    }
    if (!ensureAllowedForApiUser(req.apiUser, "AIRTIME")) {
      return sendApiError(res, 403, API_ERROR_CODES.SERVICE_DISABLED, "Airtime is not enabled for your API access.");
    }

    const result = await apiTransactionService.processAirtime({
      apiAccess: req.apiUser,
      phone,
      network,
      amount,
      requestId,
    });

    if (result.duplicate) return res.status(200).json(formatTransactionResponse(result.duplicate));
    if (result.error) {
      const httpCode = result.error.code === "INSUFFICIENT_BALANCE" ? 402 : 400;
      return sendApiError(res, httpCode, result.error.code, result.error.message, {
        transactionId: result.transaction ? result.transaction.transactionId : undefined,
      });
    }
    return res.status(200).json(formatTransactionResponse(result.transaction));
  } catch (error) {
    console.log("buyAirtime (v2) error:", error);
    return sendApiError(res, 500, API_ERROR_CODES.INTERNAL_ERROR, "Internal server error.");
  }
};

const buyData = async (req, res) => {
  try {
    const { phone, network, planCode, requestId } = req.body;
    if (!phone || !network || !planCode || !requestId) {
      return sendApiError(
        res,
        400,
        API_ERROR_CODES.INVALID_REQUEST,
        "phone, network, planCode and requestId are all required."
      );
    }
    if (!(await isServiceEnabledGlobally("^data$"))) {
      return sendApiError(res, 400, API_ERROR_CODES.SERVICE_DISABLED, "Data service is currently disabled.");
    }
    if (!ensureAllowedForApiUser(req.apiUser, "DATA")) {
      return sendApiError(res, 403, API_ERROR_CODES.SERVICE_DISABLED, "Data is not enabled for your API access.");
    }

    const result = await apiTransactionService.processData({
      apiAccess: req.apiUser,
      phone,
      network,
      planCode,
      requestId,
    });

    if (result.duplicate) return res.status(200).json(formatTransactionResponse(result.duplicate));
    if (result.error) {
      const httpCode = result.error.code === "INSUFFICIENT_BALANCE" ? 402 : 400;
      return sendApiError(res, httpCode, result.error.code, result.error.message, {
        transactionId: result.transaction ? result.transaction.transactionId : undefined,
      });
    }
    return res.status(200).json(formatTransactionResponse(result.transaction));
  } catch (error) {
    console.log("buyData (v2) error:", error);
    return sendApiError(res, 500, API_ERROR_CODES.INTERNAL_ERROR, "Internal server error.");
  }
};

const buyElectricity = async (req, res) => {
  try {
    const { meterId, meterNumber, meterType, amount, requestId } = req.body;
    if (!meterId || !meterNumber || !meterType || !amount || !requestId) {
      return sendApiError(
        res,
        400,
        API_ERROR_CODES.INVALID_REQUEST,
        "meterId, meterNumber, meterType, amount and requestId are all required."
      );
    }
    if (!(await isServiceEnabledGlobally("^electricity$"))) {
      return sendApiError(res, 400, API_ERROR_CODES.SERVICE_DISABLED, "Electricity service is currently disabled.");
    }
    if (!ensureAllowedForApiUser(req.apiUser, "ELECTRICITY")) {
      return sendApiError(
        res,
        403,
        API_ERROR_CODES.SERVICE_DISABLED,
        "Electricity is not enabled for your API access."
      );
    }

    const result = await apiTransactionService.processElectricity({
      apiAccess: req.apiUser,
      meterId,
      meterNumber,
      meterType,
      amount,
      requestId,
    });

    if (result.duplicate) return res.status(200).json(formatTransactionResponse(result.duplicate));
    if (result.error) {
      const httpCode = result.error.code === "INSUFFICIENT_BALANCE" ? 402 : 400;
      return sendApiError(res, httpCode, result.error.code, result.error.message, {
        transactionId: result.transaction ? result.transaction.transactionId : undefined,
      });
    }
    return res.status(200).json(formatTransactionResponse(result.transaction));
  } catch (error) {
    console.log("buyElectricity (v2) error:", error);
    return sendApiError(res, 500, API_ERROR_CODES.INTERNAL_ERROR, "Internal server error.");
  }
};

const buyCableTv = async (req, res) => {
  // Mirrors the existing website behaviour — cable is not live yet.
  return sendApiError(res, 400, API_ERROR_CODES.SERVICE_DISABLED, "Cable TV is not available at the moment.");
};

const validateMeter = async (req, res) => {
  try {
    const { meterNumber, meterId, meterType } = req.body;
    if (!meterNumber || !meterId) {
      return sendApiError(res, 400, API_ERROR_CODES.INVALID_REQUEST, "meterNumber and meterId are required.");
    }
    const response = await axios.post(
      `${process.env.DATARELOADED_API}/buy/validateMeter`,
      { meterNumber, meterId, meterType },
      { headers: { Authorization: process.env.DATARELOADED_API_KEY } }
    );
    const { invalid, name, address } = response.data;
    if (invalid) {
      return sendApiError(res, 400, API_ERROR_CODES.INVALID_REQUEST, "Meter could not be validated.");
    }
    return res.status(200).json({ success: true, name, address });
  } catch (error) {
    console.log("validateMeter (v2) error:", error.message);
    return sendApiError(res, 502, API_ERROR_CODES.SUPPLIER_ERROR, "Unable to validate meter at this time.");
  }
};

const validateCable = async (req, res) => {
  return sendApiError(res, 400, API_ERROR_CODES.SERVICE_DISABLED, "Cable TV is not available at the moment.");
};

module.exports = { buyAirtime, buyData, buyElectricity, buyCableTv, validateMeter, validateCable };
