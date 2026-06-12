import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import Payment from "@/models/Payment";

export async function GET() {
  await dbConnect();
  const p = await Payment.find().lean();
  return NextResponse.json({ count: p.length, sample: p[0], all: p });
}
