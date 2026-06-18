import mongoose from "mongoose";

const ActivityLogSchema = new mongoose.Schema(
  {
    institute_id:  { type: mongoose.Schema.Types.ObjectId, ref: "Institute", required: true, index: true },
    action:        { type: String, required: true, enum: ["CREATED", "UPDATED", "DELETED", "RESTORED", "LOGIN"] },
    entity:        { type: String, required: true },
    record_id:     { type: mongoose.Schema.Types.ObjectId },
    record_label:  { type: String },
    performed_by:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    performed_by_name: { type: String },
    details:       { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

ActivityLogSchema.index({ institute_id: 1, createdAt: -1 });

export default mongoose.models.ActivityLog || mongoose.model("ActivityLog", ActivityLogSchema);
