const ApiTransaction = require("../../Models/apiTransactionModel");
const { sendApiError, API_ERROR_CODES } = require("../../Utils/apiErrorCodes");

const getTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    // Scoping every lookup by apiUser is what guarantees one API user can
    // never read another API user's transaction, even if they guess an ID.
    const txn = await ApiTransaction.findOne({ transactionId, apiUser: req.apiUser._id });
    if (!txn) {
      return sendApiError(res, 404, API_ERROR_CODES.TRANSACTION_NOT_FOUND, "Transaction not found.");
    }
    return res.status(200).json({
      success: true,
      transaction: {
        transactionId: txn.transactionId,
        requestId: txn.requestId,
        status: txn.status,
        service: txn.service,
        network: txn.network,
        amount: txn.amount,
        charged: txn.chargedAmount,
        createdAt: txn.createdAt,
      },
    });
  } catch (error) {
    console.log("getTransaction (v2) error:", error);
    return sendApiError(res, 500, API_ERROR_CODES.INTERNAL_ERROR, "Internal server error.");
  }
};

const getTransactions = async (req, res) => {
  try {
    const { service, status, from, to, transactionId, requestId } = req.query;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const query = { apiUser: req.apiUser._id };
    if (service) query.service = String(service).toUpperCase();
    if (status) query.status = String(status).toUpperCase();
    if (transactionId) query.transactionId = transactionId;
    if (requestId) query.requestId = requestId;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const [transactions, total] = await Promise.all([
      ApiTransaction.find(query).sort("-createdAt").skip(skip).limit(limit),
      ApiTransaction.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      totalTransactions: total,
      transactions: transactions.map((txn) => ({
        transactionId: txn.transactionId,
        requestId: txn.requestId,
        status: txn.status,
        service: txn.service,
        network: txn.network,
        amount: txn.amount,
        charged: txn.chargedAmount,
        createdAt: txn.createdAt,
      })),
    });
  } catch (error) {
    console.log("getTransactions (v2) error:", error);
    return sendApiError(res, 500, API_ERROR_CODES.INTERNAL_ERROR, "Internal server error.");
  }
};

module.exports = { getTransaction, getTransactions };
