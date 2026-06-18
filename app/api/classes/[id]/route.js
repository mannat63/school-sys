import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import ClassModel from "@/models/Class";
import Section from "@/models/Section";
import RecycleBin from "@/models/RecycleBin";
import { logActivity } from "@/lib/logActivity";

export const dynamic = "force-dynamic";

export async function PUT(req, { params }) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const { id } = await params;
    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    const cls = await ClassModel.findOneAndUpdate(
      { _id: id, institute_id: authUser.institute_id },
      { name: name.trim() },
      { new: true }
    );
    if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(cls);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);

    const { id } = await params;

    const classObj = await ClassModel.findById(id);
    if (!classObj) return NextResponse.json({ error: "Class not found" }, { status: 404 });

    const sections = await Section.find({ class_id: id });

    await RecycleBin.create({
      original_collection: "Class",
      original_id: classObj._id,
      institute_id: classObj.institute_id,
      data: { class: classObj.toObject(), sections: sections.map(s => s.toObject()) },
      deleted_by: authUser._id
    });

    await ClassModel.findByIdAndDelete(id);
    await Section.deleteMany({ class_id: id });

    logActivity({ institute_id: authUser.institute_id, action: "DELETED", collection: "Class", record_id: id, record_label: classObj.name, performed_by: authUser._id, performed_by_name: authUser.name });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
