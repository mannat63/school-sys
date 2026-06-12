import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import Parent from "@/models/Parent";

export async function GET(req) {
  try {
    await dbConnect();
    const parents = await Parent.find({ institute_id: req.headers.get("x-institute-id") || "660c1d2b8b9a5c4e7f1d2e3f" })
      .populate("user_id")
      .populate("student_ids");
    return NextResponse.json(parents);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const data = await req.json();
    await dbConnect();
    const newParent = await Parent.create(data);
    return NextResponse.json(newParent, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
