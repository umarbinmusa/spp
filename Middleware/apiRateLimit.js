const { sendApiError, API_ERROR_CODES } = require("../Utils/apiErrorCodes");

// Simple in-memory fixed-window limiter keyed by ApiAccess._id.
// NOTE: this is per-process. If this app is ever scaled to multiple
// instances, swap this Map for a shared store (e.g. Redis) — the interface
// below is intentionally small so that swap is a one-file change.
const WINDOW_MS = 60 * 1000;
const buckets = new Map();

const TIER_DEFAULT_LIMITS = {
  STARTER: 60,
  PRO: 120,
  BUSINESS: 300,
  ENTERPRISE: 1000,
};

// periodic cleanup so the map doesn't grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.windowStart >= WINDOW_MS * 2) buckets.delete(key);
  }
}, WINDOW_MS * 2).unref();

const apiRateLimit = (req, res, next) => {
  const apiAccess = req.apiUser;
  if (!apiAccess) return next(); // apiAuth should always run first

  const limit = apiAccess.rateLimit || TIER_DEFAULT_LIMITS[apiAccess.tier] || 60;
  const key = String(apiAccess._id);
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    bucket = { windowStart: now, count: 0 };
  }
  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count > limit) {
    return sendApiError(
      res,
      429,
      API_ERROR_CODES.RATE_LIMIT_EXCEEDED,
      "Too many API requests. Please try again later."
    );
  }

  next();
};

module.exports = apiRateLimit;
