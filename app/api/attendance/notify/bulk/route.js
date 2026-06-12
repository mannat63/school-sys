import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import Attendance from "@/models/Attendance";
import Institute from "@/models/Institute";
import Notification from "@/models/Notification";
import Section from "@/models/Section";
import { sendEventToN8N } from "@/services/n8n";

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);

    const body = await req.json();
    const { date } = body;

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const inst = await Institute.findById(authUser.institute_id);

    // Fetch ALL absent attendance records for the institute on the given date
    const dateStart = new Date(date);
    dateStart.setUTCHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setUTCHours(23, 59, 59, 999);

    const records = await Attendance.find({
      institute_id: authUser.institute_id,
      date: { $gte: dateStart, $lt: dateEnd },
      status: "ABSENT"
    })
    .populate({
      path: "student_id",
      populate: { path: "user_id", select: "name" } // user profile name
    })
    .populate("section_id", "name class_id")
    .populate("subject_id", "name");

    if (!records || records.length === 0) {
      return NextResponse.json({ error: "No absent records found across any sections for this date." }, { status: 400 });
    }

    let sentCount = 0;
    const errors = [];
    const dateFormatted = new Date(date).toLocaleDateString("en-GB");

    // Grouping by student to prevent multiple messages if a student is absent in 5 lectures.
    // Instead of lecture-wise, for bulk we might consolidate or send specifically. 
    // Actually, sending multiple might be spammy, let's group by student.
    const absenceMap = {};
    for (const rec of records) {
        const sid = rec.student_id ? rec.student_id._id.toString() : null;
        if (!sid) continue;
        if (!absenceMap[sid]) {
            absenceMap[sid] = {
                student: rec.student_id,
                section_name: rec.section_id?.name || "Unknown Section",
                subjects: []
            };
        }
        if (rec.subject_id?.name) {
            absenceMap[sid].subjects.push(rec.subject_id.name);
        }
    }

    for (const sid in absenceMap) {
      const data = absenceMap[sid];
      const student = data.student;
      const studentName = student?.user_id?.name || student?.parent_name || "Student";
      const parentPhone = student?.parent_phone;

      if (!parentPhone || parentPhone === "—") {
        errors.push(`Skipped ${studentName}: No valid parent phone.`);
        continue;
      }

      try {
        const subjectString = data.subjects.length > 0 ? ` for ${data.subjects.join(", ")}` : "";
        const message = `Dear Parent, your child ${studentName} was marked ABSENT${subjectString} in Sec ${data.section_name} on ${dateFormatted}. From ${inst.name}.`;

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
            section_name: data.section_name
          },
          data: {
            date: date,
            status: "ABSENT",
            subjects: data.subjects
          }
        });

        await Notification.create({
          institute_id: inst._id,
          student_id: student._id,
          type: "ATTENDANCE_ALERT",
          recipient_name: studentName,
          recipient_phone: parentPhone,
          message: message,
          status: "SENT",
          is_read: false
        });

        sentCount++;
      } catch (err) {
        errors.push(`Failed to notify ${studentName}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      total_absences: records.length,
      skipped: errors.length,
      errors,
      message: `Master send complete! Sent ${sentCount} grouped attendance notification${sentCount !== 1 ? "s" : ""} across all batches for ${dateFormatted}.`
    });

  } catch (error) {
    console.error("Master Attendance Notify Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
