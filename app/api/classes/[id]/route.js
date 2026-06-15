import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import ClassModel from "@/models/Class";
import Section from "@/models/Section";
import RecycleBin from "@/models/RecycleBin";

export const dynamic = "force-dynamic";

export async function DELETE(req, { params }) {
  try {
    await dbConnect();
    await requireRole(["ADMIN"]);
    
    const { id } = await params;
    
    const classObj = await ClassModel.findById(id);
    if (!classObj) return NextResponse.json({ error: "Class not found" }, { status: 404 });

    const sections = await Section.find({ class_id: id });

    await RecycleBin.create({
      original_collection: "Class",
      original_id: classObj._id,
      institute_id: classObj.institute_id,
      data: { class: classObj.toObject(), sections: sections.map(s => s.toObject()) },
      deleted_by: (await requireRole(["ADMIN"]))._id
    });

    // Delete the class
    await ClassModel.findByIdAndDelete(id);
    
    // Also delete associated sections
    await Section.deleteMany({ class_id: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
