import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser, requireRole } from "@/lib/auth";
import Course from "@/models/Course";

export async function GET(req) {
  try {
    await dbConnect();
    const authUser = await getAuthUser();
    
    // Everyone can view courses in their institute
    const courses = await Course.find({ institute_id: authUser.institute_id });
    return NextResponse.json(courses);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);

    const body = await req.json();
    const { name, description, base_fee } = body;

    const course = await Course.create({
      name,
      description,
      base_fee: Number(base_fee) || 0,
      institute_id: authUser.institute_id
    });

    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
