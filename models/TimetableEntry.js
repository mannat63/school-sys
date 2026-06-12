import mongoose from "mongoose";

const TimetableEntrySchema = new mongoose.Schema(
  {
    section_id: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true },
    subject_id: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    teacher_id: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    day: { type: String, required: true },
    period_no: { type: Number, required: true },
    institute_id: { type: mongoose.Schema.Types.ObjectId, ref: "Institute", required: true },
  },
  { timestamps: true }
);

export default mongoose.models.TimetableEntry || mongoose.model("TimetableEntry", TimetableEntrySchema);
