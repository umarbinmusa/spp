const { UnauthenticatedError } = require("../errors");
const User = require("../Models/usersModel");
const jwt = require("jsonwebtoken");
const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const apiToken = authHeader.split(" ")[1];
    const user = await User.findOne({ apiToken: apiToken });
    if (!user) return res.status(401).json({ msg: "Invalid token provided" });
    const tempUserToken = await jwt.sign(
      {
        userId: user._id,
        userType: user.userType,
      },
      process.env.JWT_SECRET
    );
    token = tempUserToken;
  } else {
    token = req.header("x-auth-token");
  }

  if (!token)
    return res
      .status(401)
      .json({ msg: "No authentication token, authorization denied." });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch {
    return res
      .status(401)
      .json({ msg: "Token verification failed, authorization denied." });
  }
};
module.exports = auth;
