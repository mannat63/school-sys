import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser, requireRole } from "@/lib/auth";
import Homework from "@/models/Homework";
import HomeworkSubmission from "@/models/HomeworkSubmission";
import Student from "@/models/Student";
import Teacher from "@/models/Teacher";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();
    const authUser = await getAuthUser();

    if (authUser.role === "TEACHER") {
      const teacher = await Teacher.findOne({ user_id: authUser._id });
      if (!teacher) return NextResponse.json([], { status: 200 });
      
      const homeworks = await Homework.find({ teacher_id: teacher._id })
        .populate({ path: "section_id", populate: { path: "class_id", select: "name" } })
        .sort({ createdAt: -1 })
        .lean();
      
      // Also fetch submission counts
      for (let hw of homeworks) {
        hw.submissions = await HomeworkSubmission.countDocuments({ homework_id: hw._id, status: { $ne: "PENDING" } });
        hw.total_students = await Student.countDocuments({ section_id: hw.section_id });
      }

      return NextResponse.json(homeworks);
    } 
    
    if (authUser.role === "STUDENT") {
      const student = await Student.findOne({ user_id: authUser._id }).lean();
      if (!student) return NextResponse.json([], { status: 200 });

      // Find homeworks for student's section
      const homeworks = await Homework.find({ section_id: student.section_id })
        .populate("teacher_id") // will just fetch id 
        .sort({ due_date: 1 })
        .lean();
        
      // Merge submission statuses
      for (let hw of homeworks) {
        const sub = await HomeworkSubmission.findOne({ homework_id: hw._id, student_id: student._id }).lean();
        if (sub) {
          hw.student_status = sub.status;
          hw.student_comment = sub.student_comment;
          hw.teacher_feedback = sub.teacher_feedback;
          hw.grade = sub.grade;
        } else {
          hw.student_status = "PENDING";
        }
      }

      return NextResponse.json(homeworks);
    }

    if (authUser.role === "ADMIN") {
      const homeworks = await Homework.find({ institute_id: authUser.institute_id })
        .populate({ path: "section_id", populate: { path: "class_id", select: "name" } })
        .populate({ path: "teacher_id", populate: { path: "user_id", select: "name" } })
        .sort({ createdAt: -1 })
        .lean();
        
      // Also fetch submission counts
      for (let hw of homeworks) {
        hw.submissions = await HomeworkSubmission.countDocuments({ homework_id: hw._id, status: { $ne: "PENDING" } });
        hw.total_students = await Student.countDocuments({ section_id: hw.section_id });
      }

      return NextResponse.json(homeworks);
    }

    return NextResponse.json({ error: "Access Denied" }, { status: 403 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["TEACHER"]);
    const teacher = await Teacher.findOne({ user_id: authUser._id }).lean();
    if (!teacher) return NextResponse.json({ error: "Teacher profile required" }, { status: 404 });

    const body = await req.json();
    const { title, description, subject, due_date, section_id, drive_link } = body;

    const hw = await Homework.create({
      title,
      description,
      subject,
      due_date: new Date(due_date),
      section_id,
      teacher_id: teacher._id,
      institute_id: authUser.institute_id,
      drive_link: drive_link || ""
    });

    // Notify all students in this section
    const { default: Notification } = await import("@/models/Notification");
    const { default: User } = await import("@/models/User");
    const students = await Student.find({ section_id }).populate("user_id").lean();
    
    if (students.length > 0) {
       const notifications = students.map(s => ({
         institute_id: authUser.institute_id,
         student_id: s._id,
         type: "HOMEWORK_ALERT",
         recipient_name: s.parent_name || s.user_id?.name || "Student",
         recipient_phone: s.user_id?.phoneOrEmail || "N/A",
         message: `New Assignment (${subject}): ${title}. Due: ${new Date(due_date).toLocaleDateString()}. Please check your dashboard.`
       }));
       await Notification.insertMany(notifications);
    }

    return NextResponse.json(hw, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
