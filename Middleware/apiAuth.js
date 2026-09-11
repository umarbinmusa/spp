const ApiAccess = require("../Models/apiAccessModel");
const { hashApiKey } = require("../Utils/generateApiCredentials");
const { sendApiError, API_ERROR_CODES } = require("../Utils/apiErrorCodes");

// This is deliberately separate from Middleware/auth.js (the normal user
// JWT auth). External developer integrations must never be able to log in
// using a website session token, and website users must never be able to
// use an API key to browse the dashboard.
const apiAuth = async (req, res, next) => {
  try {
    let apiKey = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      apiKey = authHeader.split(" ")[1];
    } else if (req.headers["x-api-key"]) {
      apiKey = req.headers["x-api-key"];
    }

    if (!apiKey) {
      return sendApiError(res, 401, API_ERROR_CODES.INVALID_API_KEY, "Missing API key.");
    }

    const apiAccess = await ApiAccess.findOne({ apiKeyHash: hashApiKey(apiKey) });

    if (!apiAccess) {
      return sendApiError(res, 401, API_ERROR_CODES.INVALID_API_KEY, "Invalid API key.");
    }

    if (apiAccess.status === "SUSPENDED") {
      return sendApiError(
        res,
        403,
        API_ERROR_CODES.API_ACCESS_SUSPENDED,
        "Your API access has been suspended."
      );
    }

    if (apiAccess.status === "REVOKED") {
      return sendApiError(
        res,
        403,
        API_ERROR_CODES.API_ACCESS_REVOKED,
        "Your API access has been revoked."
      );
    }

    req.apiUser = apiAccess;

    // fire-and-forget, never block the request on this
    ApiAccess.updateOne({ _id: apiAccess._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});

    next();
  } catch (error) {
    console.log("apiAuth error:", error);
    return sendApiError(res, 500, API_ERROR_CODES.INTERNAL_ERROR, "Internal server error.");
  }
};

module.exports = apiAuth;
