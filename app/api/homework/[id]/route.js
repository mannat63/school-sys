import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser, requireRole } from "@/lib/auth";
import Homework from "@/models/Homework";
import HomeworkSubmission from "@/models/HomeworkSubmission";
import Student from "@/models/Student";

export async function GET(req, { params }) {
    try {
        await dbConnect();
        const authUser = await getAuthUser();
        const { id } = await params;

        const hw = await Homework.findById(id).lean();
        if (!hw) return NextResponse.json({ error: "Homework not found" }, { status: 404 });

        // If Teacher, fetch all submissions with student details
        if (authUser.role === "TEACHER") {
            // Get all students in the section
            const students = await Student.find({ section_id: hw.section_id })
                .populate("user_id", "name")
                .lean();
            
            // Get all submissions
            const submissions = await HomeworkSubmission.find({ homework_id: id }).lean();

            // Map submissions back to students (even if pending)
            const results = students.map(st => {
                const sub = submissions.find(s => s.student_id.toString() === st._id.toString());
                return {
                    student_id: st._id,
                    student_name: st.user_id?.name || st.parent_name || "Unknown",
                    status: sub ? sub.status : "PENDING",
                    student_comment: sub ? sub.student_comment : "",
                    teacher_feedback: sub ? sub.teacher_feedback : "",
                    grade: sub ? sub.grade : "",
                    submission_id: sub ? sub._id : null
                };
            });

            return NextResponse.json({ homework: hw, submissions: results });
        }

        return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        await dbConnect();
        await requireRole(["TEACHER"]);
        const { id } = await params;
        await Homework.findByIdAndDelete(id);
        await HomeworkSubmission.deleteMany({ homework_id: id });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
