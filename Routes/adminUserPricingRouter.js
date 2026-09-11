const express = require("express");
const router = express.Router();
const auth = require("../Middleware/auth");
const isAdmin = require("../Middleware/isAdmin");
const {
  listUserPricing,
  upsertUserPricing,
  deleteUserPricing,
} = require("../Controllers/Admin/userPricingController");

router.use(auth, isAdmin);

router.get("/:userId", listUserPricing);
router.post("/:userId", upsertUserPricing);
router.delete("/rule/:id", deleteUserPricing);

module.exports = router;
