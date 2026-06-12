import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser } from "@/lib/auth";
import Notification from "@/models/Notification";
import Student from "@/models/Student";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();
    const authUser = await getAuthUser();
    
    const query = { institute_id: authUser.institute_id, is_read: false };

    if (authUser.role === "STUDENT") {
      const studentProfile = await Student.findOne({ user_id: authUser._id }).lean();
      if (!studentProfile) return NextResponse.json({ unread_count: 0 }, { status: 200 });
      query.student_id = studentProfile._id;
    }

    const unread_count = await Notification.countDocuments(query);
                                            
    return NextResponse.json({ unread_count });
  } catch (error) {
    console.error("Fetch Unread Count Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
