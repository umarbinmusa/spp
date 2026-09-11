const express = require("express");
const auth = require("../Middleware/auth");
const {
  fetchDataPlan,
  addPlan,
  updatePlan,
  deletePlan,
} = require("../Controllers/dataPlanController");
const isAdmin = require("../Middleware/isAdmin");

const router = express.Router();
router.get("/", fetchDataPlan);
router
  .post("/add", auth, isAdmin, addPlan)
  .patch("/update", auth, isAdmin, updatePlan)
  .delete("/delete", auth, isAdmin, deletePlan);

module.exports = router;
