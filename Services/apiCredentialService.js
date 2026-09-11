const ApiAccess = require("../Models/apiAccessModel");
const {
  generateApiUserId,
  generateApiKey,
  hashApiKey,
  apiKeyPrefix,
  generateApiSecret,
  hashSecret,
  generateWebhookSecret,
} = require("../Utils/generateApiCredentials");

/**
 * Creates brand-new API access for a user. Returns the plaintext apiKey and
 * apiSecret exactly once — they are never retrievable again after this call.
 */
const createApiAccess = async ({
  userId,
  tier = "STARTER",
  allowedServices,
  rateLimit,
  webhookUrl,
  environment = "live",
  createdBy,
}) => {
  const apiUserId = generateApiUserId();
  const apiKey = generateApiKey(environment);
  const apiSecret = generateApiSecret();
  const webhookSecret = generateWebhookSecret();

  const apiAccess = await ApiAccess.create({
    user: userId,
    apiUserId,
    apiKeyHash: hashApiKey(apiKey),
    apiKeyPrefix: apiKeyPrefix(apiKey),
    secretHash: await hashSecret(apiSecret),
    webhookUrl: webhookUrl || "",
    webhookSecret,
    environment,
    status: "ACTIVE",
    tier,
    allowedServices: allowedServices && allowedServices.length ? allowedServices : undefined,
    rateLimit: rateLimit || null,
    createdBy,
  });

  return { apiAccess, apiKey, apiSecret };
};

/**
 * Regenerates the API key only. The old key is immediately invalidated.
 */
const regenerateApiKey = async (apiAccess) => {
  const apiKey = generateApiKey(apiAccess.environment);
  apiAccess.apiKeyHash = hashApiKey(apiKey);
  apiAccess.apiKeyPrefix = apiKeyPrefix(apiKey);
  await apiAccess.save();
  return apiKey;
};

/**
 * Regenerates the API secret only.
 */
const regenerateApiSecret = async (apiAccess) => {
  const apiSecret = generateApiSecret();
  apiAccess.secretHash = await hashSecret(apiSecret);
  await apiAccess.save();
  return apiSecret;
};

module.exports = { createApiAccess, regenerateApiKey, regenerateApiSecret };
