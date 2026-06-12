import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser, requireRole } from "@/lib/auth";
import Test from "@/models/Test";
import Teacher from "@/models/Teacher";
import Student from "@/models/Student";
import Section from "@/models/Section";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();
    const authUser = await getAuthUser();

    const { searchParams } = new URL(req.url);
    const section_id = searchParams.get("section_id");

    const query = { institute_id: authUser.institute_id };

    if (authUser.role === "TEACHER") {
      const teacher = await Teacher.findOne(
        { user_id: authUser._id },
        { _id: 1 }
      ).lean();
      if (!teacher) return NextResponse.json([], { status: 200 });

      const { default: TimetableEntry } = await import("@/models/TimetableEntry");
      const timetables = await TimetableEntry.find({ teacher_id: teacher._id }, { section_id: 1 }).lean();
      const sectionIds = timetables.map(t => t.section_id.toString());

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
        { _id: 1, section_id: 1 }
      ).lean();
      if (!student) return NextResponse.json([], { status: 200 });
      query.section_id = student.section_id;
    } else {
      if (section_id) query.section_id = section_id;
    }

    // Sort newest first, project only needed fields
    const tests = await Test.find(query)
      .select("name section_id date subjects total_marks")
      .populate("section_id", "name class_id")
      .sort({ date: -1 })
      .limit(50)
      .lean();

    // Populate class_id on the sections to avoid front-end mapping issues
    await Section.populate(tests, { path: "section_id.class_id", select: "name", model: "Class" });

    return NextResponse.json(tests);
  } catch (error) {
    console.error("Tests GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN", "TEACHER"]);

    const body = await req.json();
    const { name, section_id, date, subjects } = body;

    if (authUser.role === "TEACHER") {
      const teacher = await Teacher.findOne(
        { user_id: authUser._id },
        { _id: 1 }
      ).lean();
      if (!teacher) throw new Error("Teacher profile not found");

      const { default: TimetableEntry } = await import("@/models/TimetableEntry");
      const isTeaching = await TimetableEntry.exists({
        section_id, teacher_id: teacher._id, institute_id: authUser.institute_id
      });
      if (!isTeaching) {
        return NextResponse.json(
          { error: "Forbidden: Not your section" },
          { status: 403 }
        );
      }
    }

    const computedTotalMarks = subjects.reduce((sum, s) => sum + (Number(s.max_marks) || 0), 0);

    const testItem = await Test.create({
      name,
      section_id,
      date,
      subjects,
      total_marks: computedTotalMarks,
      institute_id: authUser.institute_id,
    });

    return NextResponse.json(testItem, { status: 201 });
  } catch (error) {
    console.error("Tests POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
