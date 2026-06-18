import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import Section from "@/models/Section";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await dbConnect();
    await requireRole(["ADMIN"]);

    // Set capacity=30 on all sections where capacity is null/undefined/missing
    const result = await Section.updateMany(
      { capacity: { $exists: false } },
      { $set: { capacity: 30 } }
    );

    // Also fix any that have null/0
    const result2 = await Section.updateMany(
      { $or: [{ capacity: null }, { capacity: 0 }] },
      { $set: { capacity: 30 } }
    );

    return NextResponse.json({
      success: true,
      message: `Migrated ${result.modifiedCount + result2.modifiedCount} sections to capacity=30`,
      details: {
        missingField: result.modifiedCount,
        nullOrZero: result2.modifiedCount,
      }
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
