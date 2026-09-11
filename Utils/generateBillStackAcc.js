const { default: axios } = require("axios");
const usersModel = require("../Models/usersModel");

const generateBillStackAcc = async ({ bankName, userId }) => {
  const { BILLSTACK_API, BILLSTACK_SECRET } = process.env;
  try {
    const user = await usersModel.findOne({
      _id: userId,
    });

    const firstName = user.userName;
    const lastName = user.fullName ? user.fullName : user.userName;
    const payload = {
      reference: bankName + "_" + user.email,
      email: user.email,
      phone: user.phoneNumber,
      firstName,
      lastName,
      bank: bankName.toUpperCase(),
    };
    // const payload = {
    //   reference: "onisabiabdullahi@gmail.com",
    //   email: "onisabiabdullahi@gmail.com",
    //   phone: "08108126121",
    //   firstName: "onisabi",
    //   lastName: "abdullahi",
    //   bank: "PALMPAY",
    // };
    // console.log(payload);
    const billStackAcc = await axios.post(
      BILLSTACK_API + "/generateVirtualAccount/",
      payload,
      {
        headers: { Authorization: `Bearer ${BILLSTACK_SECRET}` },
      }
    );
    console.log(billStackAcc);
    const accountResponse = billStackAcc.data;
    console.log(accountResponse);
    if (billStackAcc.data.status) {
      const accountDetails = accountResponse.data.account[0];
      const accountInfo = {
        bankName,
        accountNumber: accountDetails.account_number,
      };
      // console.log(accountInfo);
      await usersModel.updateOne(
        { _id: userId },
        {
          $push: { accountNumbers: accountInfo },
        }
      );
      return { status: true };
    } else {
      let errMsg =
        accountResponse.message ||
        `unable to generate ${bankName} account at the moment`;
      if (errMsg == "Refrence already exist") {
        errMsg = `You have generated ${bankName} account before `;
      }
      return {
        status: false,
        msg: errMsg,
      };
    }
  } catch (error) {
    // console.log(error);
    let errMsg = error?.response?.data?.message || "something went wrong";
    return { msg: errMsg, status: false };
  }
};
module.exports = generateBillStackAcc;
