const mongoose = require("mongoose");

const apiLogSchema = new mongoose.Schema({
  apiUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ApiAccess",
    index: true,
  },
  endpoint: { type: String, required: true },
  method: { type: String, required: true },
  requestId: { type: String, default: null },
  statusCode: { type: Number, required: true },
  ipAddress: { type: String, default: null },
  userAgent: { type: String, default: null },
  responseTimeMs: { type: Number, default: 0 },
  success: { type: Boolean, default: true },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 7776000, // auto-prune logs after ~90 days
  },
});

apiLogSchema.index({ apiUser: 1, createdAt: -1 });

module.exports = mongoose.model("ApiLog", apiLogSchema);
