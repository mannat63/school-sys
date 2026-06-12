import mongoose from "mongoose";

const ParentSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    student_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
    institute_id: { type: mongoose.Schema.Types.ObjectId, ref: "Institute", required: true },
  },
  { timestamps: true }
);

export default mongoose.models.Parent || mongoose.model("Parent", ParentSchema);
