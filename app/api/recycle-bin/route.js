import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import RecycleBin from "@/models/RecycleBin";

export const dynamic = "force-dynamic";

export async function DELETE(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    
    // Delete all records in the recycle bin for this institute
    await RecycleBin.deleteMany({ institute_id: authUser.institute_id });
    
    return NextResponse.json({ success: true, message: "Recycle Bin emptied successfully" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
