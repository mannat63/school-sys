import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser } from "@/lib/auth";
import Settings from "@/models/Settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbConnect();
    const authUser = await getAuthUser();
    let settings = await Settings.findOne({ institute_id: authUser.institute_id }).lean();
    
    // Return default if not set
    const default_config = [
        { no: 1, label: "9:00–9:45" },
        { no: 2, label: "9:45–10:30" },
        { no: 3, label: "10:45–11:30" },
        { no: 4, label: "11:30–12:15" },
        { no: null, label: "12:15–1:00", isBreak: true, breakTitle: "Lunch Break" },
        { no: 5, label: "1:00–1:45" },
        { no: 6, label: "1:45–2:30" },
        { no: 7, label: "2:45–3:30" },
        { no: 8, label: "3:30–4:15" },
    ];

    return NextResponse.json(settings?.timetable_config || default_config);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await getAuthUser();
    if (authUser.role !== "ADMIN") return NextResponse.json({ error: "Access denied" }, { status: 403 });
    
    const body = await req.json();
    let settings = await Settings.findOne({ institute_id: authUser.institute_id });
    if (!settings) {
      settings = await Settings.create({ institute_id: authUser.institute_id, timetable_config: body });
    } else {
      settings.timetable_config = body;
      await settings.save();
    }
    
    return NextResponse.json(settings.timetable_config);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
