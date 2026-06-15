import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser, requireRole } from "@/lib/auth";
import Class from "@/models/Class";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();
    const authUser = await getAuthUser();
    if (!authUser || !authUser.institute_id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    // Sort logically by class number if we can (e.g. Class 1, Class 2... Class 10)
    // For now returning unsorted or let front-end sort
    const classes = await Class.find({ institute_id: authUser.institute_id });
    return NextResponse.json(classes);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const data = await req.json();
    const existingClass = await Class.findOne({ name: data.name, institute_id: authUser.institute_id });
    if (existingClass) {
      return NextResponse.json({ error: "A class with this name already exists." }, { status: 400 });
    }

    data.institute_id = authUser.institute_id;
    const newClass = await Class.create(data);
    return NextResponse.json(newClass, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
