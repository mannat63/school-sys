import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser, requireRole } from "@/lib/auth";
import Teacher from "@/models/Teacher";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbConnect();
    const authUser = await getAuthUser();

    if (authUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const teachers = await Teacher.find({ institute_id: authUser.institute_id })
      .select("user_id institute_id subjects")
      .populate("user_id", "name phoneOrEmail")
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

    const finalContact = email?.trim() ? email.trim() : phone?.trim();

    let user = await User.findOne({ phoneOrEmail: new RegExp(`^${finalContact}$`, "i") });
    if (user) {
      if (user.role !== "TEACHER" && user.role !== "ADMIN") {
        user.role = "TEACHER";
        await user.save();
      }
    } else {
      user = await User.create({
        name,
        phoneOrEmail: finalContact,
        role: "TEACHER",
        institute_id: authUser.institute_id,
      });
    }

    const teacher = await Teacher.create({
      user_id: user._id,
      institute_id: authUser.institute_id,
      subjects: subjects || []
    });

    return NextResponse.json(teacher, { status: 201 });
  } catch (error) {
    console.error("Teachers POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
