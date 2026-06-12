import mongoose from "mongoose";

const SectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    class_id: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
    institute_id: { type: mongoose.Schema.Types.ObjectId, ref: "Institute", required: true },
  },
  { timestamps: true }
);

export default mongoose.models.Section || mongoose.model("Section", SectionSchema);
