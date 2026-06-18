import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import RecycleBin from "@/models/RecycleBin";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const { searchParams } = new URL(req.url);
    const collection = searchParams.get("collection");

    const query = { institute_id: authUser.institute_id };
    if (collection && collection !== "ALL") query.original_collection = collection;

    const items = await RecycleBin.find(query)
      .populate("deleted_by", "name")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const counts = await RecycleBin.aggregate([
      { $match: { institute_id: authUser.institute_id } },
      { $group: { _id: "$original_collection", count: { $sum: 1 } } }
    ]);
    const countMap = Object.fromEntries(counts.map(c => [c._id, c.count]));

    return NextResponse.json({ items, counts: countMap, total: items.length });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    await RecycleBin.deleteMany({ institute_id: authUser.institute_id });
    return NextResponse.json({ success: true, message: "Recycle Bin emptied successfully" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
