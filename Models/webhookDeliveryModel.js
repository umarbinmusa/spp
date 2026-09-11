const mongoose = require("mongoose");

const webhookDeliverySchema = new mongoose.Schema(
  {
    apiUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApiAccess",
      required: true,
      index: true,
    },
    event: { type: String, required: true },
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: "ApiTransaction" },
    url: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "PENDING",
    },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null },
    responseCode: { type: Number, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WebhookDelivery", webhookDeliverySchema);
