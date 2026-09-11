const express = require("express");
const {
  coupon,
  flutterwave,
  initiateFlutterwave,
  monnify,
  vPay,
} = require("../Controllers/fundWalletController");
const auth = require("../Middleware/auth");
const router = express.Router();

router.post("/coupon", auth, coupon);
router.post("/flutterwave/initiate", auth, initiateFlutterwave);
router.post("/flutterwave", flutterwave);
router.all("/monnify", monnify);
router.all("/vpay", vPay);

module.exports = router;
