import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import Section from "@/models/Section";
import RecycleBin from "@/models/RecycleBin";

export async function PUT(req, { params }) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const { id } = await params;
    const body = await req.json();
    let { name, class_id } = body;

    // Default prefix if not present
    if (name && !name.toLowerCase().startsWith("section")) {
      name = `Section ${name}`;
    }

    const section = await Section.findOneAndUpdate(
      { _id: id, institute_id: authUser.institute_id },
      { name, class_id },
      { new: true }
    )
      .populate("class_id", "name");

    if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });
    return NextResponse.json(section);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const { id } = await params;
    
    // Check for relational integrity
    const { default: Student } = await import("@/models/Student");
    const studentCount = await Student.countDocuments({ section_id: id, institute_id: authUser.institute_id });
    if (studentCount > 0) {
      return NextResponse.json({ error: "Cannot delete section with active students" }, { status: 400 });
    }

    const section = await Section.findOne({ _id: id, institute_id: authUser.institute_id });
    if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });
    
    await RecycleBin.create({
      original_collection: "Section",
      original_id: section._id,
      institute_id: section.institute_id,
      data: section.toObject(),
      deleted_by: authUser._id
    });

    await Section.deleteOne({ _id: id });
    
    // Cleanup related data like Attendance and Tests (Results cascade deleted if we delete Tests)
    const { default: Attendance } = await import("@/models/Attendance");
    const { default: Test } = await import("@/models/Test");
    const { default: Result } = await import("@/models/Result");

    await Attendance.deleteMany({ section_id: id });
    const tests = await Test.find({ section_id: id }, { _id: 1 });
    const testIds = tests.map(t => t._id);
    await Result.deleteMany({ test_id: { $in: testIds } });
    await Test.deleteMany({ section_id: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
