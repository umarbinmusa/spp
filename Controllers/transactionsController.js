const Transaction = require("../Models/transactionModel");
const Users = require("../Models/usersModel");

const searchTransaction = async (req, res) => {
  const { type, phoneNumber, sort, userName, from, to, status } = req.query;
  const { AGENT_1, AGENT_2, AGENT_3, ADMIN_ID } = process.env;
  const agents = [AGENT_1, AGENT_2, AGENT_3];
  const isAgent = agents.find((e) => e === req.user.userId) === req.user.userId;
  let isAdmin = ADMIN_ID === req.user.userId;

  let queryObject = {};
  if (!isAdmin && !isAgent) {
    queryObject = { trans_By: req.user.userId };
  }
  // type of transaction
  if (type && type !== "all") {
    console.log({ type });
    // queryObject.trans_Type = type;
    queryObject.trans_Type = { $regex: type, $options: "i" };
  }
  // filter with phone number
  if (phoneNumber) {
    queryObject.phone_number = { $regex: phoneNumber, $options: "i" };
  }

  // filter with transaction status
  if (status && status !== "all") {
    queryObject.trans_Status = { $regex: status, $options: "i" };
  }
  //  filter with userId
  // if (userName && userId) {
  //   queryObject.trans_By = userId;
  // }
  if (userName) {
    // queryObject.trans_UserName = userAccount;
    queryObject.trans_UserName = { $regex: userName, $options: "i" };
  }
  // if (userName) {
  //   query.trans_By = userId;
  // }
  if (from) {
    queryObject.createdAt = { $gte: from, $lt: to || new Date() };
  }

  let result = Transaction.find(queryObject);
  if (sort) {
    const sortList = sort.split(",").join(" ");
    result = result.sort(sortList);
  } else {
    result = result.sort("-createdAt");
  }

  // Fetch transactions for the selected day to calculate no of GB sold

  let start = from ? from : new Date().setHours(0, 0, 0, 0);
  let end = to ? to : new Date().setHours(23, 59, 59, 999);

  let query = {
    createdAt: { $gte: start, $lt: end },
  };
  if (!isAdmin && !isAgent) {
    query.trans_By = req.user.userId;
  }

  // Calculating total GB purchased
  const today = await Transaction.find({ ...queryObject, ...query });
  const totalSales = today.reduce((acc, cur) => {
    acc += cur.trans_volume_ratio;
    return acc;
  }, 0);

  // Calculating profit for selected transactions
  const totalProfit = today.reduce((acc, cur) => {
    const currentProfit = isNaN(cur.trans_profit) ? 0 : cur.trans_profit;
    acc += currentProfit;
    return acc;
  }, 0);

  const calculateStat = (network, type) => {
    let result = {
      network: `${network} ${type}`,
      profit: 0,
      total_volume_sold: 0,
    };
    let filtered = today.filter(
      (e) =>
        e.trans_Type &&
        e.trans_Network.split(" ")[0] === network &&
        e.trans_Network.split(" ")[1] === type
    );
    // profit
    result.profit = filtered.reduce((acc, cur) => {
      const currentProfit = isNaN(cur.trans_profit) ? 0 : cur.trans_profit;
      acc += currentProfit;
      return acc;
    }, 0);
    // total sales
    result.total_volume_sold = filtered.reduce((acc, cur) => {
      acc += cur.trans_volume_ratio;
      return acc;
    }, 0);
    return result;
  };
  const calculateMoneyFlow = (type) => {
    let total = 0;
    const ADMIN = process.env.ADMIN_ID;
    if (type === "DEBIT") {
      const totalDebit = today.reduce((acc, cur) => {
        if (
          cur.balance_After < cur.balance_Before &&
          cur.trans_By !== ADMIN &&
          cur.trans_Status !== "refunded"
        ) {
          acc += cur.trans_amount;
        }
        return acc;
      }, 0);
      total = totalDebit;
    }
    if (type === "CREDIT") {
      const totalCredit = today.reduce((acc, cur) => {
        if (
          cur.balance_After > cur.balance_Before &&
          cur.trans_By !== ADMIN &&
          cur.trans_Type !== "refund"
        ) {
          acc += cur.trans_amount;
        }
        return acc;
      }, 0);
      total = totalCredit;
    }
    return total;
  };
  let mtnSMESales = calculateStat("MTN", "SME");
  let mtnDIRECTSales = calculateStat("MTN", "DATA_TRANSFER");
  let mtnAwoofSales = calculateStat("MTN", "AWOOF");
  let AirtelCGSales = calculateStat("AIRTEL", "CG");
  let AirtelAWOOFSales = calculateStat("AIRTEL", "AWOOF");
  let gloCGSales = calculateStat("GLO", "CG");
  let gloAWOOFSales = calculateStat("GLO", "AWOOF");
  let NmobileSMESales = calculateStat("9MOBILE", "SME");
  let totalDebit = calculateMoneyFlow("DEBIT");
  let totalCredit = calculateMoneyFlow("CREDIT");
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || (isAdmin || isAgent ? 100 : 30);
  const skip = (page - 1) * limit;
  result = await result.skip(skip).limit(limit);
  let noOfTransaction = await Transaction.countDocuments(queryObject);
  const totalPages = Math.ceil(noOfTransaction / limit);

  res.status(200).json({
    stat: isAdmin
      ? [
          mtnSMESales,
          mtnDIRECTSales,
          mtnAwoofSales,
          AirtelCGSales,
          AirtelAWOOFSales,
          gloCGSales,
          gloAWOOFSales,
          NmobileSMESales,
        ]
      : [],
    totalPages,
    totalSales,
    totalProfit: totalProfit,
    totalDebit,
    totalCredit,
    transactions: result,
  });
};
module.exports = searchTransaction;
