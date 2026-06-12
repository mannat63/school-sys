import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import ClassModel from "@/models/Class";
import Section from "@/models/Section";

export const dynamic = "force-dynamic";

export async function DELETE(req, { params }) {
  try {
    await dbConnect();
    await requireRole(["ADMIN"]);
    
    const { id } = await params;
    // Delete the class
    await ClassModel.findByIdAndDelete(id);
    
    // Also delete associated sections
    await Section.deleteMany({ class_id: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
