const User = require("../Models/usersModel");
const ApiAccess = require("../Models/apiAccessModel");
const ApiTransaction = require("../Models/apiTransactionModel");
const apiCredentialService = require("../Services/apiCredentialService");
const webhookService = require("../Services/webhookService");

const getMyApiAccess = async (req) => {
  return ApiAccess.findOne({ user: req.user.userId });
};

const getDashboard = async (req, res) => {
  try {
    const apiAccess = await getMyApiAccess(req);
    if (!apiAccess) return res.status(404).json({ msg: "No API access found for your account" });

    const user = await User.findById(req.user.userId).select("balance");

    const [totalTransactions, successfulTransactions, failedTransactions, spendAgg, recent] = await Promise.all([
      ApiTransaction.countDocuments({ apiUser: apiAccess._id }),
      ApiTransaction.countDocuments({ apiUser: apiAccess._id, status: "SUCCESS" }),
      ApiTransaction.countDocuments({ apiUser: apiAccess._id, status: "FAILED" }),
      ApiTransaction.aggregate([
        { $match: { apiUser: apiAccess._id, status: "SUCCESS" } },
        { $group: { _id: null, total: { $sum: "$chargedAmount" } } },
      ]),
      ApiTransaction.find({ apiUser: apiAccess._id }).sort("-createdAt").limit(10),
    ]);

    return res.status(200).json({
      walletBalance: user.balance,
      apiStatus: apiAccess.status,
      apiUserId: apiAccess.apiUserId,
      apiKeyPrefix: apiAccess.apiKeyPrefix,
      tier: apiAccess.tier,
      totalApiRequests: apiAccess.totalRequests,
      successfulRequests: apiAccess.successfulRequests,
      failedRequests: apiAccess.failedRequests,
      totalApiTransactions: totalTransactions,
      successfulTransactions,
      failedTransactions,
      totalApiSpend: spendAgg[0] ? spendAgg[0].total : 0,
      recentTransactions: recent.map((t) => ({
        transactionId: t.transactionId,
        service: t.service,
        network: t.network,
        amount: t.amount,
        charged: t.chargedAmount,
        status: t.status,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    console.log("getDashboard error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

const getCredentials = async (req, res) => {
  try {
    const apiAccess = await getMyApiAccess(req);
    if (!apiAccess) return res.status(404).json({ msg: "No API access found for your account" });

    // The full key/secret are never retrievable after creation/regeneration —
    // only the safe-to-display prefix and status are returned here.
    return res.status(200).json({
      apiUserId: apiAccess.apiUserId,
      apiKeyPrefix: apiAccess.apiKeyPrefix,
      status: apiAccess.status,
      tier: apiAccess.tier,
      environment: apiAccess.environment,
      webhookUrl: apiAccess.webhookUrl,
      webhookEvents: apiAccess.webhookEvents,
    });
  } catch (error) {
    console.log("getCredentials error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

const regenerateMyKey = async (req, res) => {
  try {
    const apiAccess = await getMyApiAccess(req);
    if (!apiAccess) return res.status(404).json({ msg: "No API access found for your account" });
    const apiKey = await apiCredentialService.regenerateApiKey(apiAccess);
    return res.status(200).json({ msg: "API key regenerated. Save it now — it will not be shown again.", apiKey });
  } catch (error) {
    console.log("regenerateMyKey error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

const regenerateMySecret = async (req, res) => {
  try {
    const apiAccess = await getMyApiAccess(req);
    if (!apiAccess) return res.status(404).json({ msg: "No API access found for your account" });
    const apiSecret = await apiCredentialService.regenerateApiSecret(apiAccess);
    return res
      .status(200)
      .json({ msg: "API secret regenerated. Save it now — it will not be shown again.", apiSecret });
  } catch (error) {
    console.log("regenerateMySecret error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

const updateMyWebhook = async (req, res) => {
  try {
    const { webhookUrl, webhookEvents } = req.body;
    const apiAccess = await getMyApiAccess(req);
    if (!apiAccess) return res.status(404).json({ msg: "No API access found for your account" });

    if (webhookUrl !== undefined) apiAccess.webhookUrl = webhookUrl;
    if (webhookEvents) apiAccess.webhookEvents = webhookEvents;
    await apiAccess.save();

    return res.status(200).json({ msg: "Webhook settings saved" });
  } catch (error) {
    console.log("updateMyWebhook error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

const testMyWebhook = async (req, res) => {
  try {
    const apiAccess = await getMyApiAccess(req);
    if (!apiAccess) return res.status(404).json({ msg: "No API access found for your account" });
    const result = await webhookService.sendTestWebhook(apiAccess);
    return res.status(200).json({ msg: "Test webhook sent", ...result });
  } catch (error) {
    console.log("testMyWebhook error:", error.message);
    return res.status(500).json({ msg: "Failed to deliver test webhook. Check your webhook URL." });
  }
};

module.exports = {
  getDashboard,
  getCredentials,
  regenerateMyKey,
  regenerateMySecret,
  updateMyWebhook,
  testMyWebhook,
};
