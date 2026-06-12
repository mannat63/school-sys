import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import Homework from "@/models/Homework";
import HomeworkSubmission from "@/models/HomeworkSubmission";
import Student from "@/models/Student";
import Notification from "@/models/Notification";
import Teacher from "@/models/Teacher";

export async function POST(req, { params }) {
  try {
    await dbConnect();
    const authUser = await requireRole(["TEACHER"]);
    
    // In Next 15, route params must be awaited
    const { id } = await params;
    
    const homework = await Homework.findById(id).lean();
    if (!homework) return NextResponse.json({ error: "Homework not found" }, { status: 404 });

    const teacher = await Teacher.findOne({ user_id: authUser._id }).lean();
    if (!teacher || teacher._id.toString() !== homework.teacher_id.toString()) {
        return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    // Identify students who haven't submitted
    const submissions = await HomeworkSubmission.find({ homework_id: id }).lean();
    const submittedStudentIds = submissions.map(sub => sub.student_id.toString());

    const allStudents = await Student.find({ section_id: homework.section_id }).populate("user_id").lean();
    
    const unsubmittedStudents = allStudents.filter(s => !submittedStudentIds.includes(s._id.toString()));

    if (unsubmittedStudents.length === 0) {
        return NextResponse.json({ message: "All students have submitted!" }, { status: 200 });
    }

    const dueDate = new Date(homework.due_date);
    const now = new Date();
    const isOverdue = now > dueDate;

    let alertMessage = "";
    if (isOverdue) {
        alertMessage = `URGENT: Your assignment "${homework.title}" for ${homework.subject} is OVERDUE. Please submit it immediately.`;
    } else {
        alertMessage = `REMINDER: Your assignment "${homework.title}" for ${homework.subject} is due on ${dueDate.toLocaleDateString()}. Please ensure you submit it on time.`;
    }

    const notifications = unsubmittedStudents.map(s => ({
        institute_id: authUser.institute_id,
        student_id: s._id,
        type: "HOMEWORK_ALERT",
        recipient_name: s.parent_name || s.user_id?.name || "Student",
        recipient_phone: s.user_id?.phoneOrEmail || "N/A",
        message: alertMessage
    }));

    await Notification.insertMany(notifications);

    return NextResponse.json({ success: true, count: unsubmittedStudents.length, message: isOverdue ? "Overdue alerts sent." : "Reminders sent." });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
