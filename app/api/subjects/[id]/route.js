import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import Subject from "@/models/Subject";

export const dynamic = "force-dynamic";

export async function PUT(req, { params }) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const { id } = await params;
    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const sub = await Subject.findOneAndUpdate(
      { _id: id, institute_id: authUser.institute_id },
      { name: name.trim() },
      { new: true }
    );
    if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(sub);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const { id } = await params;
    const sub = await Subject.findOneAndDelete({ _id: id, institute_id: authUser.institute_id });
    if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
