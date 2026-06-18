import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser } from "@/lib/auth";
import Class from "@/models/Class";
import Section from "@/models/Section";
import Subject from "@/models/Subject";
import TimetableEntry from "@/models/TimetableEntry";
import Student from "@/models/Student";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbConnect();
    const authUser = await getAuthUser();
    const iid = authUser.institute_id;
    const oid = new mongoose.Types.ObjectId(iid);

    const [classes, sections, allSubjects, timetableEntries, studentCounts] = await Promise.all([
      Class.find({ institute_id: iid }).lean(),
      Section.find({ institute_id: iid }).populate("class_id", "name").lean(),
      Subject.find({ institute_id: iid }).lean(),
      TimetableEntry.find({ institute_id: iid }).populate("subject_id", "name").lean(),
      Student.aggregate([
        { $match: { institute_id: oid } },
        { $group: { _id: "$section_id", count: { $sum: 1 } } },
      ]),
    ]);

    const countMap = Object.fromEntries(studentCounts.map(s => [s._id.toString(), s.count]));

    // Build: classId → { class, sections[], subjectNames Set }
    const classMap = {};
    for (const cls of classes) {
      classMap[cls._id.toString()] = { class: cls, sections: [], subjects: new Set() };
    }

    for (const sec of sections) {
      const clsId = (sec.class_id?._id || sec.class_id)?.toString();
      if (clsId && classMap[clsId]) {
        classMap[clsId].sections.push({ ...sec, studentCount: countMap[sec._id.toString()] || 0 });
      }
    }

    // Map section → classId
    const sectionClassMap = Object.fromEntries(
      sections.map(s => [s._id.toString(), (s.class_id?._id || s.class_id)?.toString()])
    );

    for (const entry of timetableEntries) {
      const secId   = entry.section_id?.toString();
      const clsId   = sectionClassMap[secId];
      const subName = entry.subject_id?.name;
      if (clsId && classMap[clsId] && subName) classMap[clsId].subjects.add(subName);
    }

    const courses = Object.values(classMap).map(({ class: cls, sections, subjects }) => ({
      classId:       cls._id,
      className:     cls.name,
      sections:      sections.map(s => ({ id: s._id, name: s.name, studentCount: s.studentCount })),
      subjects:      [...subjects].sort(),
      totalStudents: sections.reduce((sum, s) => sum + s.studentCount, 0),
    })).sort((a, b) => a.className.localeCompare(b.className));

    return NextResponse.json({ courses, allSubjects });
  } catch (error) {
    console.error("Subjects overview error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
