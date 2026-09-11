const axios = require("axios");

const buyElectricity = async (payload) => {
  // return { status: true, msg: "successful purchase token" };
  try {
    const BuyDataResponse = await axios.post(
      `${process.env.DATARELOADED_API}/buy/electricity`,
      payload,
      {
        headers: {
          Authorization: process.env.DATARELOADED_API_KEY,
        },
      }
    );
    if (BuyDataResponse.data.Status === "failed")
      return { status: false, msg: "Transaction failed" };
    return {
      status: true,
      token: BuyDataResponse.data.token,
      msg: "Electricity token purchase successful",
    };
  } catch (error) {
    return { status: false, msg: "Transaction failed" };
  }
};
module.exports = buyElectricity;
