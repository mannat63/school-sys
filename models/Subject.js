import mongoose from "mongoose";

const SubjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    institute_id: { type: mongoose.Schema.Types.ObjectId, ref: "Institute", required: true },
  },
  { timestamps: true }
);

export default mongoose.models.Subject || mongoose.model("Subject", SubjectSchema);
