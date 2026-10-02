const User = require("../../Models/usersModel");
const ApiAccess = require("../../Models/apiAccessModel");
const ApiPricing = require("../../Models/apiPricingModel");
const ApiTier = require("../../Models/apiTierModel");
const ApiTransaction = require("../../Models/apiTransactionModel");
const ApiLog = require("../../Models/apiLogModel");

const apiCredentialService = require("../../Services/apiCredentialService");
const webhookService = require("../../Services/webhookService");
const { logAdminAction } = require("../../Services/auditLogService");

// ---------------------------------------------------------------------------
// Make user -> API User
// ---------------------------------------------------------------------------
const makeApiUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { tier, allowedServices, rateLimit, webhookUrl } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const existing = await ApiAccess.findOne({ user: userId });
    if (existing) {
      return res.status(400).json({ msg: "This user already has API access." });
    }

    const { apiAccess, apiKey, apiSecret } = await apiCredentialService.createApiAccess({
      userId,
      tier,
      allowedServices,
      rateLimit,
      webhookUrl,
      createdBy: req.user.userId,
    });

    await User.updateOne({ _id: userId }, { $set: { userType: "api user" } });

    await logAdminAction({
      adminId: req.user.userId,
      action: "MAKE_API_USER",
      targetType: "ApiAccess",
      targetId: apiAccess._id,
      details: { userId, tier: apiAccess.tier },
    });

    // apiKey and apiSecret are returned ONLY here, at creation time.
    return res.status(201).json({
      msg: "API access created successfully",
      apiUserId: apiAccess.apiUserId,
      apiKey,
      apiSecret,
      status: apiAccess.status,
      tier: apiAccess.tier,
      allowedServices: apiAccess.allowedServices,
      rateLimit: apiAccess.rateLimit,
    });
  } catch (error) {
    console.log("makeApiUser error:", error);
    return res.status(500).json({ msg: "Something went wrong while creating API access" });
  }
};

// ---------------------------------------------------------------------------
// List / view API users
// ---------------------------------------------------------------------------
const listApiUsers = async (req, res) => {
  try {
    const { status, tier, search } = req.query;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 30;
    const skip = (page - 1) * limit;

    const query = {};
    if (status) query.status = String(status).toUpperCase();
    if (tier) query.tier = String(tier).toUpperCase();
    if (search) query.apiUserId = { $regex: search, $options: "i" };

    const [apiUsers, total] = await Promise.all([
      ApiAccess.find(query)
        .populate("user", "fullName userName email balance userType")
        .sort("-createdAt")
        .skip(skip)
        .limit(limit),
      ApiAccess.countDocuments(query),
    ]);

    return res.status(200).json({
      apiUsers: apiUsers.map((a) => ({
        id: a._id,
        apiUserId: a.apiUserId,
        apiKeyPrefix: a.apiKeyPrefix,
        name: a.user ? a.user.fullName || a.user.userName : "Unknown",
        email: a.user ? a.user.email : null,
        wallet: a.user ? a.user.balance : null,
        status: a.status,
        tier: a.tier,
        totalRequests: a.totalRequests,
        successfulRequests: a.successfulRequests,
        failedRequests: a.failedRequests,
        createdAt: a.createdAt,
      })),
      totalPages: Math.ceil(total / limit),
      totalApiUsers: total,
    });
  } catch (error) {
    console.log("listApiUsers error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

const buildApiUserDetail = async (apiAccess) => {
  const [totalTransactions, successfulTransactions, failedTransactions, revenueAgg] = await Promise.all([
    ApiTransaction.countDocuments({ apiUser: apiAccess._id }),
    ApiTransaction.countDocuments({ apiUser: apiAccess._id, status: "SUCCESS" }),
    ApiTransaction.countDocuments({ apiUser: apiAccess._id, status: "FAILED" }),
    ApiTransaction.aggregate([
      { $match: { apiUser: apiAccess._id, status: "SUCCESS" } },
      { $group: { _id: null, total: { $sum: "$chargedAmount" } } },
    ]),
  ]);

  return {
    id: apiAccess._id,
    apiUserId: apiAccess.apiUserId,
    apiKeyPrefix: apiAccess.apiKeyPrefix,
    status: apiAccess.status,
    tier: apiAccess.tier,
    allowedServices: apiAccess.allowedServices,
    rateLimit: apiAccess.rateLimit,
    webhookUrl: apiAccess.webhookUrl,
    webhookEvents: apiAccess.webhookEvents,
    lastUsedAt: apiAccess.lastUsedAt,
    user: apiAccess.user,
    totalRequests: apiAccess.totalRequests,
    successfulRequests: apiAccess.successfulRequests,
    failedRequests: apiAccess.failedRequests,
    totalTransactions,
    successfulTransactions,
    failedTransactions,
    totalApiRevenue: revenueAgg[0] ? revenueAgg[0].total : 0,
    createdAt: apiAccess.createdAt,
  };
};

const getApiUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const apiAccess = await ApiAccess.findById(id).populate(
      "user",
      "fullName userName email balance userType"
    );
    if (!apiAccess) return res.status(404).json({ msg: "API user not found" });
    return res.status(200).json(await buildApiUserDetail(apiAccess));
  } catch (error) {
    console.log("getApiUserDetails error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

// Lets the frontend jump straight from a normal user record (e.g. the Users
// page) to that user's API access detail, without already knowing the
// ApiAccess document's own _id.
const getApiUserByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const apiAccess = await ApiAccess.findOne({ user: userId }).populate(
      "user",
      "fullName userName email balance userType"
    );
    if (!apiAccess) return res.status(404).json({ msg: "This user has no API access" });
    return res.status(200).json(await buildApiUserDetail(apiAccess));
  } catch (error) {
    console.log("getApiUserByUserId error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

// ---------------------------------------------------------------------------
// Status management
// ---------------------------------------------------------------------------
const updateApiUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // ACTIVE | SUSPENDED | REVOKED
    if (!["ACTIVE", "SUSPENDED", "REVOKED"].includes(status)) {
      return res.status(400).json({ msg: "Invalid status" });
    }
    const apiAccess = await ApiAccess.findById(id);
    if (!apiAccess) return res.status(404).json({ msg: "API user not found" });

    apiAccess.status = status;
    await apiAccess.save();

    await logAdminAction({
      adminId: req.user.userId,
      action: `SET_API_STATUS_${status}`,
      targetType: "ApiAccess",
      targetId: apiAccess._id,
    });

    return res.status(200).json({ msg: `API user status updated to ${status}` });
  } catch (error) {
    console.log("updateApiUserStatus error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

const updateApiUserConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const { tier, allowedServices, rateLimit, webhookUrl, webhookEvents } = req.body;
    const apiAccess = await ApiAccess.findById(id);
    if (!apiAccess) return res.status(404).json({ msg: "API user not found" });

    if (tier) apiAccess.tier = tier;
    if (allowedServices) apiAccess.allowedServices = allowedServices;
    if (rateLimit !== undefined) apiAccess.rateLimit = rateLimit;
    if (webhookUrl !== undefined) apiAccess.webhookUrl = webhookUrl;
    if (webhookEvents) apiAccess.webhookEvents = webhookEvents;
    await apiAccess.save();

    await logAdminAction({
      adminId: req.user.userId,
      action: "UPDATE_API_USER_CONFIG",
      targetType: "ApiAccess",
      targetId: apiAccess._id,
      details: { tier, allowedServices, rateLimit, webhookUrl },
    });

    return res.status(200).json({ msg: "API user configuration updated" });
  } catch (error) {
    console.log("updateApiUserConfig error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

// ---------------------------------------------------------------------------
// Credential regeneration (revocable + rotatable, per the security requirements)
// ---------------------------------------------------------------------------
const regenerateKey = async (req, res) => {
  try {
    const { id } = req.params;
    const apiAccess = await ApiAccess.findById(id);
    if (!apiAccess) return res.status(404).json({ msg: "API user not found" });

    const apiKey = await apiCredentialService.regenerateApiKey(apiAccess);

    await logAdminAction({
      adminId: req.user.userId,
      action: "REGENERATE_API_KEY",
      targetType: "ApiAccess",
      targetId: apiAccess._id,
    });

    return res.status(200).json({ msg: "API key regenerated", apiKey });
  } catch (error) {
    console.log("regenerateKey error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

const regenerateSecret = async (req, res) => {
  try {
    const { id } = req.params;
    const apiAccess = await ApiAccess.findById(id);
    if (!apiAccess) return res.status(404).json({ msg: "API user not found" });

    const apiSecret = await apiCredentialService.regenerateApiSecret(apiAccess);

    await logAdminAction({
      adminId: req.user.userId,
      action: "REGENERATE_API_SECRET",
      targetType: "ApiAccess",
      targetId: apiAccess._id,
    });

    return res.status(200).json({ msg: "API secret regenerated", apiSecret });
  } catch (error) {
    console.log("regenerateSecret error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

// ---------------------------------------------------------------------------
// Pricing management
// ---------------------------------------------------------------------------
const listPricing = async (req, res) => {
  try {
    const { scope, apiUser, tier, service } = req.query;
    const query = {};
    if (scope) query.scope = String(scope).toUpperCase();
    if (apiUser) query.apiUser = apiUser;
    if (tier) query.tier = String(tier).toUpperCase();
    if (service) query.service = String(service).toUpperCase();

    const pricing = await ApiPricing.find(query).sort("-updatedAt");
    return res.status(200).json({ pricing });
  } catch (error) {
    console.log("listPricing error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

const upsertPricing = async (req, res) => {
  try {
    const { scope, apiUser, tier, service, network, planCode, pricingType, price, discount, active } = req.body;

    if (!scope || !service || !pricingType || price === undefined) {
      return res.status(400).json({ msg: "scope, service, pricingType and price are required" });
    }
    if (scope === "USER" && !apiUser) {
      return res.status(400).json({ msg: "apiUser is required when scope is USER" });
    }
    if (scope === "TIER" && !tier) {
      return res.status(400).json({ msg: "tier is required when scope is TIER" });
    }

    const filter = {
      scope,
      apiUser: scope === "USER" ? apiUser : null,
      tier: scope === "TIER" ? tier : null,
      service,
      network: network || null,
      planCode: planCode || null,
    };

    const update = {
      ...filter,
      pricingType,
      price,
      discount: discount || 0,
      active: active === undefined ? true : active,
      createdBy: req.user.userId,
    };

    const pricing = await ApiPricing.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });

    await logAdminAction({
      adminId: req.user.userId,
      action: "SET_API_PRICING",
      targetType: "ApiPricing",
      targetId: pricing._id,
      details: filter,
    });

    return res.status(200).json({ msg: "Pricing saved", pricing });
  } catch (error) {
    console.log("upsertPricing error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

const deletePricing = async (req, res) => {
  try {
    const { id } = req.params;
    await ApiPricing.findByIdAndDelete(id);
    await logAdminAction({
      adminId: req.user.userId,
      action: "DELETE_API_PRICING",
      targetType: "ApiPricing",
      targetId: id,
    });
    return res.status(200).json({ msg: "Pricing rule removed" });
  } catch (error) {
    console.log("deletePricing error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------
const listTiers = async (req, res) => {
  try {
    const tiers = await ApiTier.find().sort("name");
    return res.status(200).json({ tiers });
  } catch (error) {
    console.log("listTiers error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

const upsertTier = async (req, res) => {
  try {
    const { name, description, rateLimit, isCustomPricing } = req.body;
    if (!name || !rateLimit) {
      return res.status(400).json({ msg: "name and rateLimit are required" });
    }
    const tier = await ApiTier.findOneAndUpdate(
      { name },
      { name, description, rateLimit, isCustomPricing: !!isCustomPricing },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await logAdminAction({
      adminId: req.user.userId,
      action: "UPSERT_API_TIER",
      targetType: "ApiTier",
      targetId: tier._id,
      details: { name, rateLimit },
    });

    return res.status(200).json({ msg: "Tier saved", tier });
  } catch (error) {
    console.log("upsertTier error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

// ---------------------------------------------------------------------------
// Transactions / Logs (admin-wide views)
// ---------------------------------------------------------------------------
const listApiTransactions = async (req, res) => {
  try {
    const { apiUser, service, status, from, to } = req.query;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 30;
    const skip = (page - 1) * limit;

    const query = {};
    if (apiUser) query.apiUser = apiUser;
    if (service) query.service = String(service).toUpperCase();
    if (status) query.status = String(status).toUpperCase();
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const [transactions, total] = await Promise.all([
      ApiTransaction.find(query)
        .populate("apiUser", "apiUserId")
        .sort("-createdAt")
        .skip(skip)
        .limit(limit),
      ApiTransaction.countDocuments(query),
    ]);

    return res.status(200).json({ transactions, totalPages: Math.ceil(total / limit), totalTransactions: total });
  } catch (error) {
    console.log("listApiTransactions error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

const listApiLogs = async (req, res) => {
  try {
    const { apiUser, statusCode, endpoint } = req.query;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const query = {};
    if (apiUser) query.apiUser = apiUser;
    if (statusCode) query.statusCode = Number(statusCode);
    if (endpoint) query.endpoint = { $regex: endpoint, $options: "i" };

    const [logs, total] = await Promise.all([
      ApiLog.find(query).populate("apiUser", "apiUserId").sort("-createdAt").skip(skip).limit(limit),
      ApiLog.countDocuments(query),
    ]);

    return res.status(200).json({ logs, totalPages: Math.ceil(total / limit), totalLogs: total });
  } catch (error) {
    console.log("listApiLogs error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

// ---------------------------------------------------------------------------
// Webhook test (admin triggered, on behalf of an API user)
// ---------------------------------------------------------------------------
const testWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const apiAccess = await ApiAccess.findById(id);
    if (!apiAccess) return res.status(404).json({ msg: "API user not found" });
    const result = await webhookService.sendTestWebhook(apiAccess);
    return res.status(200).json({ msg: "Test webhook sent", ...result });
  } catch (error) {
    console.log("testWebhook error:", error.message);
    return res.status(500).json({ msg: "Failed to deliver test webhook" });
  }
};

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
const getApiAnalytics = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      apiUsersCount,
      activeApiUsersCount,
      txnsToday,
      revenueTodayAgg,
      revenueMonthAgg,
      successCount,
      failedCount,
      totalCount,
    ] = await Promise.all([
      ApiAccess.countDocuments(),
      ApiAccess.countDocuments({ status: "ACTIVE" }),
      ApiTransaction.countDocuments({ createdAt: { $gte: startOfToday } }),
      ApiTransaction.aggregate([
        { $match: { createdAt: { $gte: startOfToday }, status: "SUCCESS" } },
        { $group: { _id: null, total: { $sum: "$chargedAmount" } } },
      ]),
      ApiTransaction.aggregate([
        { $match: { createdAt: { $gte: startOfMonth }, status: "SUCCESS" } },
        { $group: { _id: null, total: { $sum: "$chargedAmount" } } },
      ]),
      ApiTransaction.countDocuments({ status: "SUCCESS" }),
      ApiTransaction.countDocuments({ status: "FAILED" }),
      ApiTransaction.countDocuments(),
    ]);

    const successRate = totalCount ? ((successCount / totalCount) * 100).toFixed(1) : "0.0";
    const failureRate = totalCount ? ((failedCount / totalCount) * 100).toFixed(1) : "0.0";

    return res.status(200).json({
      apiUsers: apiUsersCount,
      activeApiUsers: activeApiUsersCount,
      apiTransactionsToday: txnsToday,
      apiRevenueToday: revenueTodayAgg[0] ? revenueTodayAgg[0].total : 0,
      apiRevenueThisMonth: revenueMonthAgg[0] ? revenueMonthAgg[0].total : 0,
      successfulTransactionsRate: `${successRate}%`,
      failedTransactionsRate: `${failureRate}%`,
    });
  } catch (error) {
    console.log("getApiAnalytics error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

module.exports = {
  makeApiUser,
  listApiUsers,
  getApiUserDetails,
  getApiUserByUserId,
  updateApiUserStatus,
  updateApiUserConfig,
  regenerateKey,
  regenerateSecret,
  listPricing,
  upsertPricing,
  deletePricing,
  listTiers,
  upsertTier,
  listApiTransactions,
  listApiLogs,
  testWebhook,
  getApiAnalytics,
};
