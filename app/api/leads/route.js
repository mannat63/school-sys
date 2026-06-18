import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import Lead from "@/models/Lead";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const iid = authUser.institute_id;

    const { searchParams } = new URL(req.url);
    const status    = searchParams.get("status");
    const assigned  = searchParams.get("assigned");
    const page      = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit     = Math.min(100, parseInt(searchParams.get("limit") || "50"));
    const skip      = (page - 1) * limit;

    const filter = { institute_id: iid };
    if (status && status !== "ALL") filter.status = status;
    if (assigned) filter.assigned_to = assigned;

    const [leads, total, statusCounts] = await Promise.all([
      Lead.find(filter)
        .populate("assigned_to", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Lead.countDocuments(filter),
      Lead.aggregate([
        { $match: { institute_id: iid } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const counts = {};
    for (const s of statusCounts) counts[s._id] = s.count;

    return NextResponse.json({ success: true, leads, total, page, pages: Math.ceil(total / limit), counts });
  } catch (e) {
    console.error("Leads GET error:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const body = await req.json();

    const lead = await Lead.create({ ...body, institute_id: authUser.institute_id });
    return NextResponse.json({ success: true, lead }, { status: 201 });
  } catch (e) {
    console.error("Leads POST error:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
