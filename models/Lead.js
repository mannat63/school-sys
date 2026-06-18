import mongoose from "mongoose";

const LeadSchema = new mongoose.Schema(
  {
    name:             { type: String, required: true },
    phone:            { type: String, required: true },
    email:            { type: String },
    source:           { type: String, enum: ["WEBSITE", "GOOGLE_SHEET", "REFERRAL", "WALK_IN", "SOCIAL_MEDIA", "PHONE", "OTHER"], default: "WEBSITE" },
    status:           { type: String, enum: ["NEW", "CONTACTED", "INTERESTED", "DEMO_SCHEDULED", "FOLLOW_UP", "CONVERTED", "LOST"], default: "NEW" },
    course_interest:  { type: String },   // e.g. "JEE 11", "NEET 12"
    notes:            { type: String },
    assigned_to:      { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // counsellor
    follow_up_date:   { type: Date },
    lost_reason:      { type: String },
    converted_student_id: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    institute_id:     { type: mongoose.Schema.Types.ObjectId, ref: "Institute", required: true },
  },
  { timestamps: true }
);

LeadSchema.index({ institute_id: 1, status: 1 });
LeadSchema.index({ institute_id: 1, assigned_to: 1, status: 1 });
LeadSchema.index({ institute_id: 1, createdAt: -1 });
LeadSchema.index({ institute_id: 1, follow_up_date: 1 });

export default mongoose.models.Lead || mongoose.model("Lead", LeadSchema);
