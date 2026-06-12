import mongoose from "mongoose";

const AttendanceSchema = new mongoose.Schema(
  {
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ["PRESENT", "ABSENT", "NOT_MARKED"], required: true },
    marked_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    section_id: { type: mongoose.Schema.Types.ObjectId, ref: "Section" },
    subject_id: { type: mongoose.Schema.Types.ObjectId, ref: "Subject" },
    period_no: { type: Number },
    institute_id: { type: mongoose.Schema.Types.ObjectId, ref: "Institute", required: true },
  },
  { timestamps: true }
);

// Compound indexes for fast querying by institute + date, section, student
AttendanceSchema.index({ institute_id: 1, date: 1 });
AttendanceSchema.index({ institute_id: 1, student_id: 1, date: 1 });
AttendanceSchema.index({ institute_id: 1, section_id: 1, date: 1 });
// Upsert key: unique constraint to prevent duplicate attendance per student per day per subject per period
AttendanceSchema.index({ student_id: 1, section_id: 1, subject_id: 1, period_no: 1, date: 1, institute_id: 1 }, { unique: true });

// Force re-registration to pick up schema changes (prevents stale cache)
if (mongoose.models.Attendance) delete mongoose.models.Attendance;
export default mongoose.model("Attendance", AttendanceSchema);
