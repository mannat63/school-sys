import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser } from "@/lib/auth";
import Attendance from "@/models/Attendance";
import Student from "@/models/Student";
import Teacher from "@/models/Teacher";
import Section from "@/models/Section";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();
    const authUser = await getAuthUser();

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const section_id = searchParams.get("section_id");
    const subject_id = searchParams.get("subject_id");
    const period_no = searchParams.get("period_no");

    const query = { institute_id: authUser.institute_id };
    if (subject_id) query.subject_id = subject_id;
    if (period_no) query.period_no = Number(period_no);
    if (date) {
      const startDate = new Date(date);
      startDate.setUTCHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setUTCHours(23, 59, 59, 999);
      query.date = { $gte: startDate, $lte: endDate };
    }

    if (authUser.role === "TEACHER") {
      const teacher = await Teacher.findOne(
        { user_id: authUser._id },
        { _id: 1 }
      ).lean();
      if (!teacher) return NextResponse.json([], { status: 200 });

      const { default: TimetableEntry } = await import("@/models/TimetableEntry");
      const timetables = await TimetableEntry.find({ teacher_id: teacher._id }, { section_id: 1 }).lean();
      const sectionIds = [...new Set(timetables.map(t => t.section_id?.toString() || ""))].filter(Boolean);

      if (section_id && !sectionIds.includes(section_id)) {
        return NextResponse.json(
          { error: "Forbidden: Not your section" },
          { status: 403 }
        );
      }
      query.section_id = section_id ? section_id : { $in: sectionIds };
    } else if (authUser.role === "STUDENT") {
      const student = await Student.findOne(
        { user_id: authUser._id },
        { _id: 1 }
      ).lean();
      if (!student) return NextResponse.json([], { status: 200 });
      query.student_id = student._id;
    } else {
      if (section_id) query.section_id = section_id;
    }

    // Only fetch fields needed by the UI
    const attendance = await Attendance.find(query)
      .select("student_id section_id subject_id period_no date status")
      .populate("subject_id", "name code")
      .lean();

    return NextResponse.json(attendance);
  } catch (error) {
    console.error("Attendance GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
