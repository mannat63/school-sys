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
    
    const query = { institute_id: authUser.institute_id };

    if (authUser.role === "STUDENT") {
      const studentProfile = await Student.findOne({ user_id: authUser._id }).lean();
      if (!studentProfile) return NextResponse.json([], { status: 200 });

      // Only show alerts created explicitly for this student
      query.student_id = studentProfile._id;
    } else if (authUser.role === "TEACHER") {
      const { default: Teacher } = await import("@/models/Teacher");
      const { default: Section } = await import("@/models/Section");
      const teacher = await Teacher.findOne({ user_id: authUser._id }).lean();
      if (!teacher) return NextResponse.json([], { status: 200 });

      const sections = await Section.find({ teacher_id: teacher._id }).lean();
      const sectionIds = sections.map(s => s._id);

      const students = await Student.find({ section_id: { $in: sectionIds } }).lean();
      const studentIds = students.map(s => s._id);

      query.student_id = { $in: studentIds };
    }

    // Notifications sorted by newest first
    const notifications = await Notification.find(query)
                                            .sort({ created_at: -1 })
                                            .limit(100)
                                            .populate("student_id", "user_id parent_name")
                                            .lean();
    
    // Add Settings Context for Razorpay Link
    const { default: Settings } = await import("@/models/Settings");
    const settings = await Settings.findOne({ institute_id: authUser.institute_id }).lean();
    const razorpay_link = settings?.razorpay_link || "";

    const finalNotifications = notifications.map(n => ({
      ...n,
      action_link: n.type === 'FEE_REMINDER' 
        ? razorpay_link 
        : ((n.type === 'TEST_RESULT_ALERT' || n.type === 'ATTENDANCE_ALERT' || n.type === 'REPORT_CARD') 
            ? "https://wa.me/919509728788?text=I%20want%20to%20report%20an%20issue%20with%20my%20records" 
            : "") 
    }));
                                            
    return NextResponse.json(finalNotifications);
  } catch (error) {
    console.error("Fetch Notifications Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

