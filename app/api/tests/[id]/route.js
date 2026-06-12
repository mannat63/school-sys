import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import Test from "@/models/Test";
import Result from "@/models/Result";

export async function PUT(req, { params }) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN", "TEACHER"]);
    const { id } = await params;
    const body = await req.json();
    const { name, section_id, date, subjects } = body;

    const test = await Test.findById(id);
    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });

    // Consistency check for Teacher role
    if (authUser.role === "TEACHER") {
      // In a real app, verify section belongs to teacher here if needed
    }

    test.name = name;
    test.section_id = section_id;
    test.date = new Date(date);
    test.subjects = subjects;
    await test.save();

    return NextResponse.json(test);
  } catch (error) {
    console.error("Test PUT error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await dbConnect();
    await requireRole(["ADMIN", "TEACHER"]);
    const { id } = await params;

    const test = await Test.findById(id);
    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });

    // Cascade delete results
    await Result.deleteMany({ test_id: id });
    await Test.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: "Test and associated results deleted." });
  } catch (error) {
    console.error("Test DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
