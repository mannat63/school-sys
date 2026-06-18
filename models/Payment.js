import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    fee_id: { type: mongoose.Schema.Types.ObjectId, ref: "Fee", required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ["CASH", "UPI", "BANK_TRANSFER"], required: true },
    reference_note: { type: String }, // optional transaction id / remark
    status: { type: String, enum: ["PENDING", "CONFIRMED"], default: "PENDING" },
    institute_id: { type: mongoose.Schema.Types.ObjectId, ref: "Institute", required: true },
  },
  { timestamps: true }
);

PaymentSchema.index({ institute_id: 1, status: 1 });
PaymentSchema.index({ institute_id: 1, createdAt: -1 });
PaymentSchema.index({ institute_id: 1, student_id: 1 });

export default mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);
