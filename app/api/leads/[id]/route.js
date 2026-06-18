import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import Lead from "@/models/Lead";

export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const body = await req.json();

    const lead = await Lead.findOneAndUpdate(
      { _id: params.id, institute_id: authUser.institute_id },
      { $set: body },
      { new: true }
    ).populate("assigned_to", "name").lean();

    if (!lead) return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
    return NextResponse.json({ success: true, lead });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    await Lead.deleteOne({ _id: params.id, institute_id: authUser.institute_id });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
