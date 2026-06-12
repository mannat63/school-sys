import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import Student from "@/models/Student";
import User from "@/models/User";

export async function PUT(req, { params }) {
  try {
    await dbConnect();
    await requireRole(["ADMIN"]);

    const { id } = await params;
    const body = await req.json();
    const { name, phoneOrEmail, section_id, parent_name, parent_phone, admission_date } = body;

    const student = await Student.findById(id);
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    // Update the linked User record
    if (student.user_id) {
      await User.findByIdAndUpdate(student.user_id, { name, phoneOrEmail });
    }

    // Update the Student record
    student.section_id = section_id;
    student.parent_name = parent_name;
    student.parent_phone = parent_phone;
    if (admission_date) student.admission_date = new Date(admission_date);
    await student.save();

    return NextResponse.json(student);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await dbConnect();
    await requireRole(["ADMIN"]);

    const { id } = await params;
    const student = await Student.findById(id);
    if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Cascade delete related records
    const { default: Fee } = await import("@/models/Fee");
    const { default: Attendance } = await import("@/models/Attendance");
    const { default: Result } = await import("@/models/Result");
    const { default: Payment } = await import("@/models/Payment");

    await Promise.all([
      User.findByIdAndDelete(student.user_id),
      Fee.deleteMany({ student_id: id }),
      Attendance.deleteMany({ student_id: id }),
      Result.deleteMany({ student_id: id }),
      Payment.deleteMany({ student_id: id }),
      Student.findByIdAndDelete(id)
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
