const express = require("express");
const {
  login,
  register,
  updateUser,
  deleteUser,
  validateToken,
  userData,
  requestPasswordReset,
  resetPassword,
  requestPinReset,
  resetPin,
  transferFund,
  changePassword,
  validateUser,
  // generateVpay,
  // updateWebhookUrl,
  addContact,
  fetchContact,
  updateContact,
  deleteContact,
  updateWebhookUrl,
  upgradeToPartner,
  fetchReferral,
  withdrawEarning,
  updateKyc,
} = require("../Controllers/userControllers");
const auth = require("../Middleware/auth");
const router = express.Router();

router.get("/", auth, userData);
router.post("/login", login);
router.post("/register", register);
// router.get("/generateAcc", auth, generateVpay);
router
  .post("/contact", auth, addContact)
  .get("/contact", auth, fetchContact)
  .patch("/contact/:contactId", auth, updateContact)
  .delete("/contact/:contactId", auth, deleteContact);
router.get("/referral", auth, fetchReferral);
router.post("/withdrawEarning", auth, withdrawEarning);
router.route("/user/:id").patch(auth, updateUser).delete(auth, deleteUser);
router.post("/requestPasswordReset", requestPasswordReset);
router.post("/resetpassword", resetPassword);
router.post("/requestPinReset", auth, requestPinReset);
router.post("/resetpin", resetPin);
router.post("/istokenValid", validateToken);
router.post("/transferFund", auth, transferFund);
router.post("/changePassword", auth, changePassword);
router.get("/validateUser/:userName", auth, validateUser);
router.post("/updateWebhook", auth, updateWebhookUrl);
router.post("/upgradeToPartner", auth, upgradeToPartner);
router.post("/updateKyc", auth, updateKyc);

module.exports = router;
