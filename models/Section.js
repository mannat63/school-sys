import mongoose from "mongoose";

const SectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    class_id: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
    institute_id: { type: mongoose.Schema.Types.ObjectId, ref: "Institute", required: true },
    capacity: { type: Number, default: 30 },
  },
  { timestamps: true }
);

SectionSchema.index({ institute_id: 1 });
SectionSchema.index({ institute_id: 1, class_id: 1 });

export default mongoose.models.Section || mongoose.model("Section", SectionSchema);
