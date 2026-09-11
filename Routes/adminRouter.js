const express = require("express");
const auth = require("../Middleware/auth");
const router = express.Router();
const {
  adminDetails,
  generateCoupon,
  sendMail,
  refund,
  updateAvailableServices,
  searchUsers,
  updatePrice,
  updateCostPrice,
  getCostPrice,
  getNotification,
  updateNotification,
  upgradeUser,
  approveWithdrawal,
  resetUserPassword,
} = require("../Controllers/adminController");
const isAdmin = require("../Middleware/isAdmin");

router.get("/", auth, adminDetails);
router.get("/users", auth, searchUsers);
router.post("/generateCoupon", auth, isAdmin, generateCoupon);
router.post("/sendMail", auth, sendMail);
router.post("/updateServices", auth, updateAvailableServices);
router.post("/updatePrice", auth, isAdmin, updatePrice);
router.get("/upgradeUser/:userId/:userType", auth, isAdmin, upgradeUser);
router.get("/costPrice", auth, isAdmin, getCostPrice);
router.post("/costPrice", auth, isAdmin, updateCostPrice);
router.post("/sendMail/:id", auth, sendMail);
router.post("/refund/:id", auth, refund);
router.get("/notification", auth, getNotification);
router.post("/notification", auth, updateNotification);
router.post("/approveWithdrawal", auth, isAdmin, approveWithdrawal);
router.post("/resetUserPassword", auth, isAdmin, resetUserPassword);

module.exports = router;
