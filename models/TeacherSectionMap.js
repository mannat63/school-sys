import mongoose from "mongoose";

const TeacherSectionMapSchema = new mongoose.Schema(
  {
    teacher_id: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    section_id: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true },
    subject_id: { type: mongoose.Schema.Types.ObjectId, ref: "Subject" },
    institute_id: { type: mongoose.Schema.Types.ObjectId, ref: "Institute", required: true },
  },
  { timestamps: true }
);

export default mongoose.models.TeacherSectionMap || mongoose.model("TeacherSectionMap", TeacherSectionMapSchema);
