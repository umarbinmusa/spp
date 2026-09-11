const express = require("express");

const searchTransaction = require("../Controllers/transactionsController");
const router = express.Router();

router.get("/", searchTransaction);
module.exports = router;
