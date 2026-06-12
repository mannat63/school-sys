import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import Fee from "@/models/Fee";
import Student from "@/models/Student";
import Institute from "@/models/Institute";
import Notification from "@/models/Notification";

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN", "TEACHER"]);

    const body = await req.json();
    const { fees } = body; // Array of fee objects: { _id, student_id, name, parent_phone, due_amount, days_overdue }

    if (!Array.isArray(fees) || fees.length === 0) {
      return NextResponse.json({ error: "No fees provided for reminders" }, { status: 400 });
    }

    let sentCount = 0;
    const errors = [];
    const inst = await Institute.findById(authUser.institute_id);
    
    const { default: Settings } = await import("@/models/Settings");
    const settings = await Settings.findOne({ institute_id: authUser.institute_id }).lean();
    const razorpay_link = settings?.razorpay_link || "";

    for (const fee of fees) {
      if (!fee.parent_phone || fee.parent_phone === "—") {
        errors.push(`Skipped ${fee.name}: No valid phone number.`);
        continue;
      }
      
      try {
        
        await Notification.create({
          institute_id: inst._id,
          student_id: fee.student_id,
          type: "FEE_REMINDER",
          recipient_name: fee.name,
          recipient_phone: fee.parent_phone,
          message: `Dear Parent, reminder from ${inst.name}: outstanding fees of ₹${fee.due_amount} for ${fee.name} are overdue by ${fee.days_overdue} days. Please clear them. ${razorpay_link ? `Pay here: ${razorpay_link}` : ''}`,
          status: "SENT"
        });
        
        sentCount++;
      } catch (err) {
        errors.push(`Failed to send to ${fee.name}: ${err.message}`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      sent: sentCount, 
      skipped: errors.length,
      errors 
    });

  } catch (error) {
    console.error("Defaulters Remind Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
