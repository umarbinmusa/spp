const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const {
  getDashboard,
  getCredentials,
  regenerateMyKey,
  regenerateMySecret,
  updateMyWebhook,
  testMyWebhook,
} = require("../Controllers/apiUserController");

// These use the normal website JWT (auth), not the API key — this is the
// developer logging into the dashboard to manage their own API access.
router.get("/dashboard", auth, getDashboard);
router.get("/credentials", auth, getCredentials);
router.post("/regenerate-key", auth, regenerateMyKey);
router.post("/regenerate-secret", auth, regenerateMySecret);
router.post("/webhook", auth, updateMyWebhook);
router.post("/webhook/test", auth, testMyWebhook);

module.exports = router;
