const User = require("../Models/usersModel");
const axios = require("axios");
const generateAcc = async ({ userName, email, bvn, nin }) => {
  const {
    MONNIFY_API_URL,
    MONNIFY_API_KEY,
    MONNIFY_API_CONTRACT_CODE,
    MONNIFY_API_SECRET,
  } = process.env;
  const ApiKeyEncoded = Buffer.from(
    MONNIFY_API_KEY + ":" + MONNIFY_API_SECRET
  ).toString("base64");
  try {
    const response = await axios.post(
      `${MONNIFY_API_URL}/api/v1/auth/login`,
      {},
      {
        headers: {
          Authorization: `Basic ${ApiKeyEncoded}`,
        },
      }
    );
    const {
      responseBody: { accessToken },
    } = response.data;
    const accountDetails = await axios.post(
      `${MONNIFY_API_URL}/api/v2/bank-transfer/reserved-accounts`,
      {
        accountReference: email,
        accountName: userName,
        currencyCode: "NGN",
        contractCode: MONNIFY_API_CONTRACT_CODE,
        customerEmail: email,
        customerName: userName,
        getAllAvailableBanks: true,
        bvn,
        nin,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    console.log("generating account number for the new user");
    const accountList = accountDetails.data.responseBody.accounts;
    const accountName = accountDetails.data.responseBody.accountName;

    let userToUpdate = await User.findOne({ email, userName });

    await User.updateOne(
      { _id: userToUpdate._id },
      {
        $push: { accountNumbers: accountList },
      }
    );
    return { status: true, msg: accountName };
  } catch (error) {
    console.log(error);
    return { status: false, msg: error.response.data.responseMessage };
  }
};
module.exports = generateAcc;
