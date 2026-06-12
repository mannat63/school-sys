import mongoose from "mongoose";

const HomeworkSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    subject: { type: String, required: true },
    due_date: { type: Date, required: true },
    section_id: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true },
    teacher_id: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    institute_id: { type: mongoose.Schema.Types.ObjectId, ref: "Institute", required: true },
  },
  { timestamps: true }
);

export default mongoose.models.Homework || mongoose.model("Homework", HomeworkSchema);
