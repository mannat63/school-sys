import mongoose from "mongoose";

const StudentSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    section_id: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true },
    parent_name: { type: String, required: true },
    parent_phone: { type: String, required: true },
    admission_date: { type: Date, default: Date.now },
    institute_id: { type: mongoose.Schema.Types.ObjectId, ref: "Institute", required: true },
  },
  { timestamps: true }
);

// Compound indexes for common query patterns
StudentSchema.index({ institute_id: 1, section_id: 1 });
StudentSchema.index({ institute_id: 1, user_id: 1 }, { unique: true });

export default mongoose.models.Student || mongoose.model("Student", StudentSchema);
