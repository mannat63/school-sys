import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import Attendance from "@/models/Attendance";
import Student from "@/models/Student";
import User from "@/models/User";
import Section from "@/models/Section";
import Institute from "@/models/Institute";
import Notification from "@/models/Notification";
import { sendEventToN8N } from "@/services/n8n";

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN", "TEACHER"]);

    const body = await req.json();
    const { section_id, subject_id, date } = body;

    if (!section_id || !date) {
      return NextResponse.json({ error: "section_id and date are required" }, { status: 400 });
    }

    // Get section name
    const section = await Section.findById(section_id);
    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
    const inst = await Institute.findById(authUser.institute_id);

    let subjectName = "";
    if (subject_id) {
       const { default: Subject } = await import("@/models/Subject");
       const sub = await Subject.findById(subject_id);
       if (sub) subjectName = ` for ${sub.name}`;
    }

    // Fetch attendance records for this section and date
    const dateStart = new Date(date);
    const dateEnd = new Date(date);
    dateEnd.setDate(dateEnd.getDate() + 1);

    const query = {
      section_id,
      date: { $gte: dateStart, $lt: dateEnd }
    };
    if (subject_id !== undefined) query.subject_id = subject_id;

    const records = await Attendance.find(query).populate({
      path: "student_id",
      populate: { path: "user_id", select: "name" }
    });

    if (!records || records.length === 0) {
      return NextResponse.json({ error: "No attendance records found for this date. Please save attendance first." }, { status: 400 });
    }

    let sentCount = 0;
    const errors = [];
    const dateFormatted = new Date(date).toLocaleDateString("en-GB");

    for (const rec of records) {
      const student = rec.student_id;
      const studentName = student?.user_id?.name || student?.parent_name || "Student";
      const parentPhone = student?.parent_phone;

      if (!parentPhone || parentPhone === "—") {
        errors.push(`Skipped ${studentName}: No valid parent phone.`);
        continue;
      }

      try {
        if (rec.status === "ABSENT") {
          await sendEventToN8N({
            event_type: "attendance_alert",
            timestamp: new Date().toISOString(),
            institute: {
              id: inst._id.toString(),
              name: inst.name
            },
            student: {
              id: student._id.toString(),
              name: studentName,
              parent_phone: parentPhone,
              section_name: section.name
            },
            data: {
              date: date,
              status: "ABSENT"
            }
          });

          await Notification.create({
            institute_id: inst._id,
            student_id: student._id,
            type: "ATTENDANCE_ALERT",
            recipient_name: studentName,
            recipient_phone: parentPhone,
            message: `Dear Parent, your child ${studentName} was marked ABSENT${subjectName} in Sec ${section.name} on ${new Date(date).toLocaleDateString("en-GB")}. From ${inst.name}.`,
            status: "SENT",
            is_read: false
          });

          sentCount++;
        }
      } catch (err) {
        errors.push(`Failed to notify ${studentName}: ${err.message}`);
      }
    }

    const presentCount = records.filter(r => r.status === "PRESENT").length;
    const absentCount = records.filter(r => r.status === "ABSENT").length;

    return NextResponse.json({
      success: true,
      sent: sentCount,
      total: records.length,
      present: presentCount,
      absent: absentCount,
      skipped: errors.length,
      errors,
      message: `Sent ${sentCount} attendance notification${sentCount !== 1 ? "s" : ""} for ${section.name} (${dateFormatted}). Present: ${presentCount}, Absent: ${absentCount}.`
    });

  } catch (error) {
    console.error("Attendance Notify Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
