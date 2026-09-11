const ApiLog = require("../Models/apiLogModel");
const ApiAccess = require("../Models/apiAccessModel");

const apiRequestLogger = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const responseTimeMs = Date.now() - start;
    const success = res.statusCode < 400;

    ApiLog.create({
      apiUser: req.apiUser ? req.apiUser._id : undefined,
      endpoint: req.originalUrl,
      method: req.method,
      requestId: (req.body && req.body.requestId) || null,
      statusCode: res.statusCode,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
      responseTimeMs,
      success,
    }).catch((e) => console.log("ApiLog write error:", e.message));

    if (req.apiUser) {
      ApiAccess.updateOne(
        { _id: req.apiUser._id },
        {
          $inc: {
            totalRequests: 1,
            successfulRequests: success ? 1 : 0,
            failedRequests: success ? 0 : 1,
          },
        }
      ).catch(() => {});
    }
  });

  next();
};

module.exports = apiRequestLogger;
