const express = require("express");
const { dataReloadedWebhook, billStack } = require("../Controllers/webhooks");
const router = express.Router();
router.post("/dataReloaded", dataReloadedWebhook);
router.post("/billStack", billStack);

module.exports = router;
