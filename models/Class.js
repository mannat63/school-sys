import mongoose from "mongoose";

const ClassSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    institute_id: { type: mongoose.Schema.Types.ObjectId, ref: "Institute", required: true },
  },
  { timestamps: true }
);

export default mongoose.models.Class || mongoose.model("Class", ClassSchema);
