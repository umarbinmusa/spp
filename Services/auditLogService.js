const AdminAuditLog = require("../Models/adminAuditLogModel");

const logAdminAction = async ({ adminId, adminName, action, targetType, targetId, details }) => {
  try {
    await AdminAuditLog.create({
      admin: adminId,
      adminName: adminName || "",
      action,
      targetType: targetType || "",
      targetId: targetId ? String(targetId) : "",
      details: details || {},
    });
  } catch (error) {
    // Auditing must never break the admin action it is logging.
    console.log("AdminAuditLog error:", error.message);
  }
};

module.exports = { logAdminAction };
