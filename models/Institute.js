import mongoose from "mongoose";

const InstituteSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    owner_name: { type: String, required: true },
    email: { type: String },
    phone: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.Institute || mongoose.model("Institute", InstituteSchema);
