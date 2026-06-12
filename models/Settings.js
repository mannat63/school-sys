import mongoose from "mongoose";

const SettingsSchema = new mongoose.Schema(
  {
    institute_id: { type: mongoose.Schema.Types.ObjectId, ref: "Institute", required: true, unique: true },
    feeReminders: { type: Boolean, default: true },
    attendanceAlerts: { type: Boolean, default: true },
    razorpay_link: { type: String, default: "" },
    timetable_config: { 
      type: Array, 
      default: [
        { no: 1, label: "9:00–9:45" },
        { no: 2, label: "9:45–10:30" },
        { no: 3, label: "10:45–11:30" },
        { no: 4, label: "11:30–12:15" },
        { no: null, label: "12:15–1:00", isBreak: true, breakTitle: "Lunch Break" },
        { no: 5, label: "1:00–1:45" },
        { no: 6, label: "1:45–2:30" },
        { no: 7, label: "2:45–3:30" },
        { no: 8, label: "3:30–4:15" },
      ]
    }
  },
  { timestamps: true }
);

export default mongoose.models.Settings || mongoose.model("Settings", SettingsSchema);
