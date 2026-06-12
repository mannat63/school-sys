import mongoose from "mongoose";

const TeacherSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    institute_id: { type: mongoose.Schema.Types.ObjectId, ref: "Institute", required: true },
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }],
  },
  { timestamps: true }
);

// Delete cached model to force schema re-registration on hot-reload
if (mongoose.models.Teacher) {
  delete mongoose.models.Teacher;
}

export default mongoose.model("Teacher", TeacherSchema);
