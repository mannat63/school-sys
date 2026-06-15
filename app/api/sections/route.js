import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser, requireRole } from "@/lib/auth";
import Section from "@/models/Section";
import Teacher from "@/models/Teacher";
import Student from "@/models/Student";
import Course from "@/models/Course";
import User from "@/models/User";
import Institute from "@/models/Institute";
import Class from "@/models/Class";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();
    const authUser = await getAuthUser();
    
    if (!authUser || !authUser.institute_id) {
      console.error("Sections GET: Unauthorized or missing institute_id");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let query = { institute_id: authUser.institute_id };

    if (authUser.role === "TEACHER") {
      const teacher = await Teacher.findOne(
        { user_id: authUser._id },
        { _id: 1 }
      ).lean();
      if (!teacher) return NextResponse.json([], { status: 200 });
      const { default: TimetableEntry } = await import("@/models/TimetableEntry");
      const timetables = await TimetableEntry.find({ teacher_id: teacher._id }, { section_id: 1 }).lean();
      const sectionIds = timetables.map(t => t.section_id);
      query._id = { $in: sectionIds };
    } else if (authUser.role === "STUDENT") {
      const student = await Student.findOne(
        { user_id: authUser._id },
        { _id: 1, class_id: 1, section_id: 1 }
      ).lean();
      if (!student) return NextResponse.json([], { status: 200 });
      query._id = student.section_id;
    }

    const sections = await Section.find(query)
      .select("name class_id")
      .populate("class_id", "name")
      .lean();

    return NextResponse.json(sections);
  } catch (error) {
    console.error("Sections GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);

    const body = await req.json();
    let { name, class_id } = body;

    // Default prefix if not present
    if (name && !name.toLowerCase().startsWith("section")) {
      name = `Section ${name}`;
    }

    const existingSection = await Section.findOne({ name, class_id, institute_id: authUser.institute_id });
    if (existingSection) {
      return NextResponse.json({ error: "A section with this name already exists in this class." }, { status: 400 });
    }

    const section = await Section.create({
      name,
      class_id,
      institute_id: authUser.institute_id,
    });

    return NextResponse.json(section, { status: 201 });
  } catch (error) {
    console.error("Sections POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
