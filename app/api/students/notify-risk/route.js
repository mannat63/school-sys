import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import Student from "@/models/Student";
import Notification from "@/models/Notification";

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN", "TEACHER"]);

    const body = await req.json();
    const { student_id, risk_type, risk_value } = body;

    if (!student_id || !risk_type) {
      return NextResponse.json(
        { error: "student_id and risk_type are required" },
        { status: 400 }
      );
    }

    const student = await Student.findById(student_id)
      .populate("user_id", "name phoneOrEmail")
      .populate("section_id", "name")
      .lean();

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const studentName = student.user_id?.name || student.parent_name || "Student";
    const parentPhone = student.parent_phone;
    const sectionName = student.section_id?.name || "Unknown";

    // Build message based on risk type
    const riskMessages = {
      fees: `Dear Parent, this is a reminder that your child ${studentName}'s fee payment of ${risk_value || "dues"} is overdue. Please clear the balance at the earliest. — ${sectionName}`,
      attendance: `Dear Parent, your child ${studentName}'s attendance has dropped to ${risk_value || "below threshold"}. Please ensure regular attendance. — ${sectionName}`,
      performance: `Dear Parent, your child ${studentName}'s academic performance is at ${risk_value || "below average"}. Please discuss with the concern teacher. — ${sectionName}`,
    };

    const message =
      riskMessages[risk_type] ||
      `Dear Parent, ${studentName} requires your attention regarding ${risk_type}. Value: ${risk_value}. — ${sectionName}`;

    const notifType =
      risk_type === "fees"
        ? "FEE_REMINDER"
        : risk_type === "attendance"
        ? "ATTENDANCE_ALERT"
        : "PERFORMANCE_ALERT";

    await Notification.create({
      institute_id: authUser.institute_id,
      student_id: student._id,
      type: notifType,
      recipient_name: student.parent_name || studentName,
      recipient_phone: parentPhone || student.user_id?.phoneOrEmail || "N/A",
      message,
      status: "SENT",
    });

    return NextResponse.json({
      success: true,
      message: `Risk notification (${risk_type}) sent to ${studentName}'s parent`,
    });
  } catch (error) {
    console.error("Risk Notify Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
