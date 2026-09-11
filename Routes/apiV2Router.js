const express = require("express");
const router = express.Router();

const apiAuth = require("../Middleware/apiAuth");
const apiRateLimit = require("../Middleware/apiRateLimit");
const apiRequestLogger = require("../Middleware/apiRequestLogger");

const {
  buyAirtime,
  buyData,
  buyElectricity,
  buyCableTv,
  validateMeter,
  validateCable,
} = require("../Controllers/Api/apiPurchaseController");
const { getTransaction, getTransactions } = require("../Controllers/Api/apiTransactionController");
const { getWallet } = require("../Controllers/Api/apiWalletController");
const { getDataPlans } = require("../Controllers/Api/apiDataPlanController");
const { getServices } = require("../Controllers/Api/apiServicesController");

// Every /api/v2 route is external-developer facing: authenticate via API
// key (never the website JWT), enforce per-tier rate limits, then log.
router.use(apiAuth);
router.use(apiRateLimit);
router.use(apiRequestLogger);

router.post("/airtime", buyAirtime);
router.post("/data", buyData);
router.post("/electricity", buyElectricity);
router.post("/cable", buyCableTv);

router.get("/transaction/:transactionId", getTransaction);
router.get("/transactions", getTransactions);

router.get("/data/plans", getDataPlans);
router.get("/services", getServices);
router.get("/wallet", getWallet);

router.post("/validate/meter", validateMeter);
router.post("/validate/cable", validateCable);

module.exports = router;
