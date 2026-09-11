require("dotenv").config();
const isAdmin = async (req, res, next) => {
  const { AGENT_1, AGENT_2, AGENT_3, ADMIN_ID } = process.env;
  const agents = [AGENT_1, AGENT_2, AGENT_3];
  const isAgent = agents.find((e) => e === req.user.userId) === req.user.userId;
  let isAdmin = ADMIN_ID === req.user.userId;
  if (!isAdmin && !isAgent) {
    return res
      .status(400)
      .json({ msg: "You are not allowed to perform this action" });
  }
  next();
};
module.exports = isAdmin;
