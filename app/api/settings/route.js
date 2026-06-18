import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import Settings from "@/models/Settings";

export async function GET() {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN", "TEACHER"]);
    let settings = await Settings.findOne({ institute_id: authUser.institute_id });
    if (!settings) {
      settings = await Settings.create({ institute_id: authUser.institute_id });
    }
    // Teachers only get Drive settings, not full admin config
    if (authUser.role === "TEACHER") {
      return NextResponse.json({
        google_drive_link: settings.google_drive_link || "",
        google_drive_instructions: settings.google_drive_instructions || ""
      });
    }
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const body = await req.json();

    let settings = await Settings.findOne({ institute_id: authUser.institute_id });
    if (!settings) {
      settings = await Settings.create({ institute_id: authUser.institute_id, ...body });
    } else {
      if (body.feeReminders !== undefined) settings.feeReminders = body.feeReminders;
      if (body.attendanceAlerts !== undefined) settings.attendanceAlerts = body.attendanceAlerts;
      if (body.razorpay_link !== undefined) settings.razorpay_link = body.razorpay_link;
      if (body.google_drive_link !== undefined) settings.google_drive_link = body.google_drive_link;
      if (body.google_drive_instructions !== undefined) settings.google_drive_instructions = body.google_drive_instructions;
      if (body.timetable_config !== undefined) settings.timetable_config = body.timetable_config;
      await settings.save();
    }

    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
