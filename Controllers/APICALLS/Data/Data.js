const axios = require("axios");

const BUYDATA = async ({ network, mobile_number, plan }) => {
  // return {
  //   status: true,
  //   msg: "Data Purchase successful",
  //   data: {},
  // };
  try {
    const BuyDataResponse = await axios.post(
      `${process.env.DATARELOADED_API}/buy/data`,
      {
        network: network,
        mobile_number: mobile_number,
        plan: plan,
      },
      {
        headers: {
          Authorization: process.env.DATARELOADED_API_KEY,
        },
      }
    );
    return {
      status: true,
      msg: BuyDataResponse.data.msg || "Data Purchase successful",
      data: BuyDataResponse.data.receipt,
    };
  } catch (error) {
    if (error.response) {
      console.log(error.response.data);
    } else {
      console.log("BUYDATA request failed with no response:", error.message);
    }
    return {
      status: false,
      msg: (error.response && error.response.data && error.response.data.msg) || "Transaction failed",
    };
  }
};
module.exports = BUYDATA;
