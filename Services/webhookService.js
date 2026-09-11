const crypto = require("crypto");
const axios = require("axios");
const WebhookDelivery = require("../Models/webhookDeliveryModel");

const EVENT_MAP = {
  SUCCESS: "transaction.success",
  FAILED: "transaction.failed",
  PENDING: "transaction.pending",
};

const sign = (payload, secret) => {
  return crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
};

const attemptDelivery = async (delivery, apiAccess, retriesLeft = 3) => {
  const signature = apiAccess.webhookSecret ? sign(delivery.payload, apiAccess.webhookSecret) : undefined;
  try {
    const response = await axios.post(delivery.url, delivery.payload, {
      headers: {
        "Content-Type": "application/json",
        ...(signature ? { "X-Assalam-Signature": signature } : {}),
      },
      timeout: 8000,
    });
    delivery.status = "SUCCESS";
    delivery.responseCode = response.status;
    delivery.attempts += 1;
    delivery.lastAttemptAt = new Date();
    await delivery.save();
  } catch (error) {
    delivery.attempts += 1;
    delivery.lastAttemptAt = new Date();
    delivery.responseCode = error.response ? error.response.status : null;

    if (retriesLeft > 0) {
      delivery.status = "PENDING";
      await delivery.save();
      const backoffMs = (4 - retriesLeft) * 10000; // 10s, 20s, 30s
      setTimeout(() => attemptDelivery(delivery, apiAccess, retriesLeft - 1), backoffMs);
    } else {
      delivery.status = "FAILED";
      await delivery.save();
    }
  }
};

/**
 * Fires (and records) a webhook for a transaction status change, if the
 * API user has a webhook configured and subscribed to that event.
 */
const dispatch = async (apiAccess, apiTxn) => {
  if (!apiAccess.webhookUrl) return null;
  const event = EVENT_MAP[apiTxn.status];
  if (!event) return null;
  if (apiAccess.webhookEvents && apiAccess.webhookEvents.length && !apiAccess.webhookEvents.includes(event)) {
    return null;
  }

  const payload = {
    event,
    transactionId: apiTxn.transactionId,
    requestId: apiTxn.requestId,
    service: apiTxn.service,
    status: apiTxn.status,
    amount: apiTxn.amount,
  };

  const delivery = await WebhookDelivery.create({
    apiUser: apiAccess._id,
    event,
    transaction: apiTxn._id,
    url: apiAccess.webhookUrl,
    payload,
    status: "PENDING",
    attempts: 0,
  });

  await attemptDelivery(delivery, apiAccess);
  return delivery;
};

/**
 * Sends a one-off test payload to the configured webhook URL, without
 * creating an ApiTransaction. Used by the "Test Webhook" button.
 */
const sendTestWebhook = async (apiAccess) => {
  if (!apiAccess.webhookUrl) {
    throw new Error("No webhook URL configured");
  }
  const payload = {
    event: "webhook.test",
    message: "This is a test webhook from Assalam Telecom",
    sentAt: new Date().toISOString(),
  };
  const signature = apiAccess.webhookSecret ? sign(payload, apiAccess.webhookSecret) : undefined;
  const response = await axios.post(apiAccess.webhookUrl, payload, {
    headers: {
      "Content-Type": "application/json",
      ...(signature ? { "X-Assalam-Signature": signature } : {}),
    },
    timeout: 8000,
  });
  return { statusCode: response.status };
};

module.exports = { dispatch, sign, sendTestWebhook };
