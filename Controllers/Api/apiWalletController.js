const User = require("../../Models/usersModel");
const { sendApiError, API_ERROR_CODES } = require("../../Utils/apiErrorCodes");

const getWallet = async (req, res) => {
  try {
    const user = await User.findById(req.apiUser.user).select("balance");
    if (!user) {
      return sendApiError(res, 404, API_ERROR_CODES.INTERNAL_ERROR, "Wallet owner not found.");
    }
    return res.status(200).json({ success: true, balance: user.balance, currency: "NGN" });
  } catch (error) {
    console.log("getWallet (v2) error:", error);
    return sendApiError(res, 500, API_ERROR_CODES.INTERNAL_ERROR, "Internal server error.");
  }
};

module.exports = { getWallet };
