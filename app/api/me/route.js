import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import dbConnect from "@/lib/db/mongodb";
import User from "@/models/User";
import Student from "@/models/Student";
import Teacher from "@/models/Teacher";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbConnect();
    const user = await getAuthUser();

    const base = { role: user.role, name: user.name, phoneOrEmail: user.phoneOrEmail };

    if (user.role === "TEACHER") {
      const { default: Subject } = await import("@/models/Subject");
      const { default: TimetableEntry } = await import("@/models/TimetableEntry");
      const teacher = await Teacher.findOne({ user_id: user._id }, { subjects: 1 }).lean();
      const subjects = teacher?.subjects?.length
        ? await Subject.find({ _id: { $in: teacher.subjects } }, { name: 1 }).lean()
        : [];
      const timetables = teacher ? await TimetableEntry.find({ teacher_id: teacher._id }, { section_id: 1 }).lean() : [];
      const sectionIds = [...new Set(timetables.map(t => t.section_id?.toString()).filter(Boolean))];
      const studentCount = sectionIds.length ? await Student.countDocuments({ section_id: { $in: sectionIds } }) : 0;
      return NextResponse.json({ ...base, teacherId: teacher?._id, sectionsCount: sectionIds.length, studentCount, subjectNames: subjects.map(s => s.name) });
    }

    if (user.role === "STUDENT") {
      const student = await Student.findOne({ user_id: user._id })
        .populate({ path: "section_id", select: "name class_id", populate: { path: "class_id", select: "name" } })
        .lean();
      return NextResponse.json({ ...base, studentId: student?._id, sectionName: student?.section_id?.name, className: student?.section_id?.class_id?.name });
    }

    return NextResponse.json(base);
  } catch (error) {
    return NextResponse.json({ role: "STUDENT" }, { status: 401 });
  }
}

export async function PUT(req) {
  try {
    await dbConnect();
    const user = await getAuthUser();
    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    await User.findByIdAndUpdate(user._id, { name: name.trim() });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
