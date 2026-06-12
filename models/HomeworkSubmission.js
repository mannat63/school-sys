import mongoose from "mongoose";

const HomeworkSubmissionSchema = new mongoose.Schema(
  {
    homework_id: { type: mongoose.Schema.Types.ObjectId, ref: "Homework", required: true },
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    status: { type: String, enum: ["PENDING", "SUBMITTED", "GRADED"], default: "PENDING" },
    student_comment: { type: String, default: "" },
    teacher_feedback: { type: String, default: "" },
    grade: { type: String, default: "" }, // can be points, grade block, etc.
    institute_id: { type: mongoose.Schema.Types.ObjectId, ref: "Institute", required: true },
  },
  { timestamps: true }
);

export default mongoose.models.HomeworkSubmission || mongoose.model("HomeworkSubmission", HomeworkSubmissionSchema);
