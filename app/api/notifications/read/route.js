import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser } from "@/lib/auth";
import Notification from "@/models/Notification";
import Student from "@/models/Student";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await getAuthUser();
    
    const query = { institute_id: authUser.institute_id, is_read: false };

    if (authUser.role === "STUDENT") {
      const studentProfile = await Student.findOne({ user_id: authUser._id }).lean();
      if (!studentProfile) return NextResponse.json({ ok: true }, { status: 200 });
      query.student_id = studentProfile._id;
    }

    // Mark all unread notifications for this user/admin as read
    const result = await Notification.updateMany(query, { $set: { is_read: true } });
                                            
    return NextResponse.json({ ok: true, modified: result.modifiedCount });
  } catch (error) {
    console.error("Mark Read Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
