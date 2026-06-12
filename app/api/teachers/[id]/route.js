import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import Teacher from "@/models/Teacher";
import User from "@/models/User";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function PUT(req, { params }) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const { id } = await params;
    const body = await req.json();
    const { name, email, phone, phoneOrEmail, subjects } = body;
    // Support both old (phoneOrEmail) and new (email+phone) formats
    const finalContact = email?.trim() ? email.trim() : phone?.trim() ? phone.trim() : phoneOrEmail;

    console.log(`Teacher Update Request: ID=${id}, Institute=${authUser.institute_id}`);

    // First find by ID
    const teacher = await Teacher.findById(id);
    if (!teacher) {
      console.error(`Teacher NOT FOUND by ID: ${id}`);
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    // Then check institute ownership
    if (teacher.institute_id.toString() !== authUser.institute_id.toString()) {
      console.error(`Teacher OWNERSHIP MISMATCH: Teacher Inst=${teacher.institute_id}, Auth Inst=${authUser.institute_id}`);
      return NextResponse.json({ error: "Forbidden: Not your teacher" }, { status: 403 });
    }

    // Now update the linked user
    await User.findByIdAndUpdate(teacher.user_id, { name, phoneOrEmail: finalContact });
    if (subjects) {
      teacher.subjects = subjects;
      await teacher.save();
    }

    const updated = await Teacher.findById(id).populate("user_id", "name phoneOrEmail").populate("subjects", "name");
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const { id } = await params;
    const teacher = await Teacher.findOneAndDelete({ _id: id, institute_id: authUser.institute_id });
    if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    await User.findByIdAndDelete(teacher.user_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
