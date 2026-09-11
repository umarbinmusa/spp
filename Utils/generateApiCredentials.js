const crypto = require("crypto");
const bcrypt = require("bcrypt");

// apiUserId — public, human-referenceable identifier (e.g. API_8F92KLM2)
const generateApiUserId = () => {
  return `API_${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
};

// apiKey — shown once, sent by developers on every request. We hash it with
// SHA-256 (fast + deterministic) purely so we can look it up by hash and
// never keep the raw key at rest.
const generateApiKey = (environment = "live") => {
  const raw = crypto.randomBytes(20).toString("hex");
  return `ak_${environment}_${raw}`;
};

const hashApiKey = (apiKey) => {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
};

const apiKeyPrefix = (apiKey) => {
  // Safe-to-display fragment, e.g. "ak_live_9f2a3c1d"
  return apiKey.slice(0, 16);
};

// apiSecret — shown once, never required on normal API requests. We store
// only a bcrypt hash since, unlike the key, we never need to look records up
// by it — only verify it when a developer re-confirms it for a sensitive
// admin-triggered action.
const generateApiSecret = () => {
  return `as_${crypto.randomBytes(24).toString("hex")}`;
};

const hashSecret = async (secret) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(secret, salt);
};

const compareSecret = async (secret, hash) => {
  return bcrypt.compare(secret, hash);
};

// webhookSecret — used to HMAC-sign outgoing webhook payloads, so unlike the
// API secret we must keep it retrievable (not one-way hashed) to sign with
// it on every delivery. Never returned in logs.
const generateWebhookSecret = () => {
  return `whsec_${crypto.randomBytes(20).toString("hex")}`;
};

module.exports = {
  generateApiUserId,
  generateApiKey,
  hashApiKey,
  apiKeyPrefix,
  generateApiSecret,
  hashSecret,
  compareSecret,
  generateWebhookSecret,
};
