import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser, requireRole } from "@/lib/auth";
import Teacher from "@/models/Teacher";
import User from "@/models/User";
import "@/models/Subject";
import { logActivity } from "@/lib/logActivity";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbConnect();
    const authUser = await getAuthUser();

    const teachers = await Teacher.find({ institute_id: authUser.institute_id })
      .select("user_id institute_id subjects")
      .populate("user_id", "name phoneOrEmail phone")
      .populate("subjects", "name")
      .lean();

    return NextResponse.json(teachers);
  } catch (error) {
    console.error("Teachers GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);

    const body = await req.json();
    const { name, email, phone, subjects } = body;

    if (phone && !/^\+91 \d{10}$/.test(phone)) {
      return NextResponse.json({ error: "Phone number must be exactly 10 digits prefixed with +91 (e.g., +91 9876543210)" }, { status: 400 });
    }

    const finalContact = email?.trim() ? email.trim() : phone?.trim();

    let user = await User.findOne({ phoneOrEmail: new RegExp(`^${finalContact}$`, "i") });
    if (user) {
      if (user.role !== "TEACHER" && user.role !== "ADMIN") {
        user.role = "TEACHER";
      }
      if (phone && user.phone !== phone) {
        user.phone = phone;
      }
      await user.save();
    } else {
      user = await User.create({
        name,
        phoneOrEmail: finalContact,
        phone,
        role: "TEACHER",
        institute_id: authUser.institute_id,
      });
    }

    const teacher = await Teacher.create({
      user_id: user._id,
      institute_id: authUser.institute_id,
      subjects: subjects || []
    });

    logActivity({ institute_id: authUser.institute_id, action: "CREATED", collection: "Teacher", record_id: teacher._id, record_label: name, performed_by: authUser._id, performed_by_name: authUser.name });

    return NextResponse.json(teacher, { status: 201 });
  } catch (error) {
    console.error("Teachers POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
