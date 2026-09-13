const mongoose = require("mongoose");

const adminAuditLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    adminName: { type: String, default: "" },
    action: { type: String, required: true }, // e.g. "MAKE_API_USER", "SUSPEND_API_USER"
    targetType: { type: String, default: "" }, // e.g. "ApiAccess", "ApiPricing"
    targetId: { type: String, default: "" },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

adminAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AdminAuditLog", adminAuditLogSchema);