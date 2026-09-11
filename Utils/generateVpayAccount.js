const axios = require("axios");
require("dotenv").config();
const User = require("../Models/usersModel");

const generateVpayAcc = async ({ email, firstName, lastName, phoneNumber }) => {
  const { VPAY_API_URL, VPAY_USERNAME, VPAY_PASSWORD, VPAY_PUBLIC_KEY } =
    process.env;

  try {
    // axios
    const authFetch = axios.create({
      baseURL: VPAY_API_URL,
    });
    const response = await authFetch.post(
      "/api/service/v1/query/merchant/login",
      { username: VPAY_USERNAME, password: VPAY_PASSWORD },
      { headers: { publicKey: VPAY_PUBLIC_KEY } }
    );
    const token = response.data.token;
    // request;
    authFetch.interceptors.request.use(
      (config) => {
        config.headers.common["b-access-token"] = token;
        config.headers.common["publicKey"] = VPAY_PUBLIC_KEY;
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
    console.log("generating account number...");

    // GENERATE ACCOUNT NUMBER ID
    console.log({ email, phoneNumber, firstName, lastName });
    const {
      data: { id: customerId },
    } = await authFetch.post("/api/service/v1/query/customer/add", {
      email: email,
      phone: phoneNumber || "08108126121",
      contactfirstname: firstName,
      contactlastname: lastName,
    });
    // console.log(data);
    console.log("generated!!");
    // GET CUSTOMER BY CUSTOMER ID
    const { data: userDetails } = await authFetch.get(
      `/api/service/v1/query/customer/${customerId}/show`
    );

    if (!userDetails.nuban) {
      console.log("account details not available for this user");
      return;
    }
    await User.updateOne(
      { email: email },
      {
        $set: {
          reservedAccountNo3: userDetails.nuban,
          reservedAccountBank3: "VFD microfinance bank",
        },
      }
    );
  } catch (e) {
    console.log(e);
    // console.log(e.response || e.data.message || e);
  }
};

module.exports = generateVpayAcc;
