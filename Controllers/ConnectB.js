const mongoose = require("mongoose");
const ConnectDB = (URI) => {
  return mongoose.connect(URI);
};

module.exports = ConnectDB;
