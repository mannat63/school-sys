import mongoose from "mongoose";

const RecycleBinSchema = new mongoose.Schema(
  {
    original_collection: { type: String, required: true },
    original_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    institute_id: { type: mongoose.Schema.Types.ObjectId, ref: "Institute", required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    deleted_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

// Delete cached model to force schema re-registration on hot-reload
if (mongoose.models.RecycleBin) {
  delete mongoose.models.RecycleBin;
}

export default mongoose.model("RecycleBin", RecycleBinSchema);
