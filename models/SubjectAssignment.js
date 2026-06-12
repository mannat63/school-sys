import mongoose from "mongoose";

const SubjectAssignmentSchema = new mongoose.Schema(
  {
    section_id: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true },
    subject_id: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    teacher_id: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    institute_id: { type: mongoose.Schema.Types.ObjectId, ref: "Institute", required: true },
  },
  { timestamps: true }
);

export default mongoose.models.SubjectAssignment || mongoose.model("SubjectAssignment", SubjectAssignmentSchema);
