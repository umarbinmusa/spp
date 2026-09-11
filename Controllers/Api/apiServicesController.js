const Services = require("../../Models/services");
const { sendApiError, API_ERROR_CODES } = require("../../Utils/apiErrorCodes");

// The existing Services collection has no enforced naming convention (no
// seed data anywhere in the codebase pins it to "AIRTIME" vs "airtime" vs
// "Air Time"), so we match by keyword rather than exact equality — the same
// approach isServiceEnabledGlobally() in apiPurchaseController.js already
// uses for the same reason.
const SERVICE_KEYWORDS = {
  AIRTIME: /airtime/i,
  DATA: /data/i,
  ELECTRICITY: /electric/i,
  CABLE: /cable/i,
};

const canonicalServiceKey = (serviceName) => {
  return Object.keys(SERVICE_KEYWORDS).find((key) => SERVICE_KEYWORDS[key].test(serviceName || "")) || null;
};

const getServices = async (req, res) => {
  try {
    const allServices = await Services.find({ serviceStatus: true }).select("serviceId serviceName");
    const allowed = req.apiUser.allowedServices && req.apiUser.allowedServices.length
      ? req.apiUser.allowedServices
      : ["AIRTIME", "DATA", "ELECTRICITY", "CABLE"];

    const services = allServices
      .filter((svc) => {
        const key = canonicalServiceKey(svc.serviceName);
        return key && allowed.includes(key);
      })
      .map((svc) => ({ serviceId: svc.serviceId, name: svc.serviceName }));

    return res.status(200).json({ success: true, services });
  } catch (error) {
    console.log("getServices (v2) error:", error);
    return sendApiError(res, 500, API_ERROR_CODES.INTERNAL_ERROR, "Internal server error.");
  }
};

module.exports = { getServices };
