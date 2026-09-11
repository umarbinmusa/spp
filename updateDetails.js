const mongoose = require("mongoose");
const User = require("./Models/usersModel");
require("dotenv").config();
const populate = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("DB connected");
    let update = await User.updateMany(
      {},
      {
        $set: {
          reservedAccountNo: "",
          reservedAccountBank: "",
          reservedAccountNo2: "",
          reservedAccountBank2: "",
        },
      }
    );
    console.log(update);
    console.log("Success!!");
    process.exit(0);
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
};

populate();
