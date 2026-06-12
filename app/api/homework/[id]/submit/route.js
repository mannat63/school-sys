import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser, requireRole } from "@/lib/auth";
import HomeworkSubmission from "@/models/HomeworkSubmission";
import Student from "@/models/Student";
import Homework from "@/models/Homework";

export async function POST(req, { params }) {
    try {
        await dbConnect();
        const authUser = await getAuthUser();
        const { id } = await params;
        const body = await req.json();

        // 1. STUDENT Submitting Homework
        if (authUser.role === "STUDENT") {
            const student = await Student.findOne({ user_id: authUser._id });
            if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

            const hw = await Homework.findById(id);
            if (!hw) return NextResponse.json({ error: "Homework not found" }, { status: 404 });

            const { student_comment } = body;

            const existing = await HomeworkSubmission.findOne({ homework_id: id, student_id: student._id });
            if (existing) {
                existing.student_comment = student_comment;
                existing.status = "SUBMITTED";
                await existing.save();
                return NextResponse.json(existing);
            } else {
                const sub = await HomeworkSubmission.create({
                    homework_id: id,
                    student_id: student._id,
                    student_comment,
                    status: "SUBMITTED",
                    institute_id: authUser.institute_id
                });
                return NextResponse.json(sub);
            }
        }

        // 2. TEACHER Grading Homework
        if (authUser.role === "TEACHER") {
            const { student_id, grade, teacher_feedback } = body;
            
            let resultSub;
            const existing = await HomeworkSubmission.findOne({ homework_id: id, student_id });
            if (existing) {
                existing.grade = grade !== undefined ? grade : existing.grade;
                existing.teacher_feedback = teacher_feedback !== undefined ? teacher_feedback : existing.teacher_feedback;
                existing.status = "GRADED";
                await existing.save();
                resultSub = existing;
            } else {
                // If the student never submitted it, but teacher is grading it directly.
                resultSub = await HomeworkSubmission.create({
                    homework_id: id,
                    student_id,
                    grade,
                    teacher_feedback,
                    status: "GRADED",
                    institute_id: authUser.institute_id
                });
            }

            // Create notification alert for student
            const { default: Notification } = await import("@/models/Notification");
            const hw = await Homework.findById(id).lean();
            const st = await Student.findById(student_id).populate("user_id").lean();
            if (hw && st) {
                await Notification.create({
                    institute_id: authUser.institute_id,
                    student_id: st._id,
                    type: "HOMEWORK_ALERT",
                    recipient_name: st.parent_name || st.user_id?.name || "Student",
                    recipient_phone: st.user_id?.phoneOrEmail || "N/A",
                    message: `Assignment Graded: Your homework "${hw.title}" has been evaluated. Grade: ${grade || "N/A"}. Feedback: ${teacher_feedback || "No feedback provided."}`
                });
            }

            return NextResponse.json(resultSub);
        }

        return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
