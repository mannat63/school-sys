import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  institute_id: { type: mongoose.Schema.Types.ObjectId, ref: "Institute", required: true },
  student_id: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
  type: { type: String, enum: ["FEE_REMINDER", "ATTENDANCE_ALERT", "REPORT_CARD", "TEST_RESULT_ALERT", "HOMEWORK_ALERT"], required: true },
  recipient_name: { type: String, required: true },
  recipient_phone: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ["SENT", "FAILED"], default: "SENT" },
  is_read: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
});

export default mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);
