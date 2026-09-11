const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const isAdmin = require("../Middleware/isAdmin");

const {
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
} = require("../Controllers/Admin/apiManagementController");

// Every route here is admin-only: normal user JWT auth, then the isAdmin gate.
router.use(auth, isAdmin);

// API Users
router.post("/users/:userId/make-api-user", makeApiUser);
router.get("/users", listApiUsers);
router.get("/users/by-user/:userId", getApiUserByUserId);
router.get("/users/:id", getApiUserDetails);
router.patch("/users/:id/status", updateApiUserStatus); // { status: ACTIVE|SUSPENDED|REVOKED }
router.patch("/users/:id/config", updateApiUserConfig); // tier / allowedServices / rateLimit / webhook
router.post("/users/:id/regenerate-key", regenerateKey);
router.post("/users/:id/regenerate-secret", regenerateSecret);
router.post("/users/:id/test-webhook", testWebhook);

// API Pricing
router.get("/pricing", listPricing);
router.post("/pricing", upsertPricing);
router.delete("/pricing/:id", deletePricing);

// API Tiers
router.get("/tiers", listTiers);
router.post("/tiers", upsertTier);

// API Transactions & Logs
router.get("/transactions", listApiTransactions);
router.get("/logs", listApiLogs);

// Analytics
router.get("/analytics", getApiAnalytics);

module.exports = router;
