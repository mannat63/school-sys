import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser } from "@/lib/auth";
import TimetableEntry from "@/models/TimetableEntry";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();
    const authUser = await getAuthUser();
    const { searchParams } = new URL(req.url);
    const section_id = searchParams.get("section_id");
    const teacher_id = searchParams.get("teacher_id");
    const day = searchParams.get("day");

    const query = { institute_id: authUser.institute_id };
    if (day) query.day = day;
    
    if (authUser.role === "TEACHER") {
      const { default: Teacher } = await import("@/models/Teacher");
      const teacher = await Teacher.findOne({ user_id: authUser._id }, { _id: 1 }).lean();
      if (!teacher) return NextResponse.json([]);
      query.teacher_id = teacher._id;
      if (section_id) query.section_id = section_id;
    } else if (authUser.role === "STUDENT") {
      const { default: Student } = await import("@/models/Student");
      const student = await Student.findOne({ user_id: authUser._id }, { section_id: 1 }).lean();
      if (!student) return NextResponse.json([]);
      query.section_id = student.section_id;
    } else {
      if (section_id) query.section_id = section_id;
      if (teacher_id) query.teacher_id = teacher_id;
    }

    const entries = await TimetableEntry.find(query)
      .populate({ path: "section_id", select: "name class_id", populate: { path: "class_id", select: "name" } })
      .populate("subject_id", "name")
      .populate({
        path: "teacher_id",
        select: "user_id subjects",
        populate: { path: "user_id", select: "name" },
      })
      .lean();

    return NextResponse.json(entries);
  } catch (error) {
    console.error("Timetable GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await getAuthUser();
    const data = await req.json();

    // Ensure institute_id is from auth, not client
    data.institute_id = authUser.institute_id;

    // Conflict Check 1: Teacher already scheduled at this day+period
    const teacherConflict = await TimetableEntry.findOne({
      teacher_id: data.teacher_id,
      day: data.day,
      period_no: data.period_no,
      institute_id: authUser.institute_id,
    }).populate({ path: "section_id", select: "name class_id", populate: { path: "class_id", select: "name" } });
    
    if (teacherConflict) {
      const clsName = teacherConflict.section_id?.class_id?.name || "Unknown Class";
      const secName = teacherConflict.section_id?.name || "Unknown Section";
      return NextResponse.json(
        { error: `⚠️ Conflict: This teacher is already scheduled for ${clsName} - Sec ${secName} during Period ${data.period_no} on ${data.day}.` },
        { status: 409 }
      );
    }

    // Conflict Check 2: Section already has a class at this day+period
    const sectionConflict = await TimetableEntry.findOne({
      section_id: data.section_id,
      day: data.day,
      period_no: data.period_no,
      institute_id: authUser.institute_id,
    });
    if (sectionConflict) {
      return NextResponse.json(
        { error: "⚠️ This section already has a class scheduled at this time." },
        { status: 409 }
      );
    }

    const newEntry = await TimetableEntry.create(data);
    return NextResponse.json(newEntry, { status: 201 });
  } catch (error) {
    console.error("Timetable POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await dbConnect();
    const authUser = await getAuthUser();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    // Ensure admin can only delete their institute's entries
    await TimetableEntry.findOneAndDelete({ _id: id, institute_id: authUser.institute_id });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
