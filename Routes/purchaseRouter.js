const express = require("express");
const {
  buyAirtime,
  buyData,
  buyElectricity,
  buyCableTv,
  validateMeter,
  validateCableTv,
  buyMtnCGData,
} = require("../Controllers/purchaseControllers");
const router = express.Router();

router.post("/airtime", buyAirtime); //b2b airtime
router.post("/data", buyData);
router.post("/electricity", buyElectricity);
router.post("/cableTv", buyCableTv);
router.post("/validatemeter", validateMeter);
router.post("/validatecabletv", validateCableTv);

module.exports = router;
