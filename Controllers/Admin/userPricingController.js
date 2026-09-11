const User = require("../../Models/usersModel");
const UserPricing = require("../../Models/userPricingModel");
const { logAdminAction } = require("../../Services/auditLogService");

// ---------------------------------------------------------------------------
// List a specific user's custom pricing rules
// ---------------------------------------------------------------------------
const listUserPricing = async (req, res) => {
  try {
    const { userId } = req.params;
    const pricing = await UserPricing.find({ user: userId }).sort("-updatedAt");
    return res.status(200).json({ pricing });
  } catch (error) {
    console.log("listUserPricing error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

// ---------------------------------------------------------------------------
// Set (create or update) a custom price for a specific user
// ---------------------------------------------------------------------------
const upsertUserPricing = async (req, res) => {
  try {
    const { userId } = req.params;
    const { service, network, dataId, pricingType, price, active } = req.body;

    if (!service || !pricingType || price === undefined) {
      return res.status(400).json({ msg: "service, pricingType and price are required" });
    }
    if (service === "AIRTIME" && !network) {
      return res.status(400).json({ msg: "network is required for AIRTIME pricing" });
    }
    if (service === "DATA" && !dataId) {
      return res.status(400).json({ msg: "dataId is required for DATA pricing" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const filter = {
      user: userId,
      service,
      network: service === "AIRTIME" ? String(network).toUpperCase() : null,
      dataId: service === "DATA" ? Number(dataId) : null,
    };

    const update = {
      ...filter,
      pricingType,
      price,
      active: active === undefined ? true : active,
      createdBy: req.user.userId,
    };

    const pricing = await UserPricing.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });

    await logAdminAction({
      adminId: req.user.userId,
      action: "SET_USER_PRICING",
      targetType: "UserPricing",
      targetId: pricing._id,
      details: { userId, service, network, dataId, pricingType, price },
    });

    return res.status(200).json({ msg: "Custom price saved", pricing });
  } catch (error) {
    console.log("upsertUserPricing error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

// ---------------------------------------------------------------------------
// Remove a custom price rule (the user falls back to normal tier pricing)
// ---------------------------------------------------------------------------
const deleteUserPricing = async (req, res) => {
  try {
    const { id } = req.params;
    await UserPricing.findByIdAndDelete(id);
    await logAdminAction({
      adminId: req.user.userId,
      action: "DELETE_USER_PRICING",
      targetType: "UserPricing",
      targetId: id,
    });
    return res.status(200).json({ msg: "Custom price removed" });
  } catch (error) {
    console.log("deleteUserPricing error:", error);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

module.exports = { listUserPricing, upsertUserPricing, deleteUserPricing };
