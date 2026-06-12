import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import Result from "@/models/Result";
import Test from "@/models/Test";
import Student from "@/models/Student";
import Institute from "@/models/Institute";
import Notification from "@/models/Notification";
// import { sendEventToN8N } from "@/services/n8n";

export async function POST(req) {
  try {
    await dbConnect();
    await requireRole(["ADMIN", "TEACHER"]);

    const body = await req.json();
    const { test_id } = body;

    if (!test_id) {
      return NextResponse.json({ error: "test_id is required" }, { status: 400 });
    }

    // Fetch the test
    const test = await Test.findById(test_id).populate("section_id", "name");
    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }
    const inst = await Institute.findById(test.institute_id);

    // Fetch all results for this test
    const results = await Result.find({ test_id })
      .populate({
        path: "student_id",
        populate: { path: "user_id", select: "name phoneOrEmail" }
      });

    if (!results || results.length === 0) {
      return NextResponse.json({ error: "No results found for this test. Please enter marks first." }, { status: 400 });
    }

    let sentCount = 0;
    const errors = [];
    const testDate = new Date(test.date).toLocaleDateString("en-GB");

    // Pre-calculate mapping of subject max marks
    const maxMarksMap = {};
    if (test.subjects) {
      test.subjects.forEach(sub => {
        maxMarksMap[sub.name] = sub.max_marks;
      });
    }

    for (const result of results) {
      const student = result.student_id;
      const studentName = student?.user_id?.name || student?.parent_name || "Student";
      const parentPhone = student?.parent_phone || "—";

      try {
        // Format the score message dynamically based on subjects
        let scoreDetails = "";
        let totalScored = 0;
        let totalMax = 0;
        
        if (result.subject_marks && result.subject_marks.length > 0) {
          scoreDetails = result.subject_marks.map(sm => {
            totalScored += sm.marks;
            const max = maxMarksMap[sm.subject] || 0;
            totalMax += max;
            return `${sm.subject}: ${sm.marks}/${max}`;
          }).join(", ");
        } else {
          // Fallback if somehow there's an old scheme
          scoreDetails = "No subjects recorded";
        }

        const messageText = `Hi, marks for test '${test.name}' are out! Total: ${totalScored}/${totalMax}. Breakdown: [${scoreDetails}].`;

        // Create Individual DB notification so it shows up in Student Dashboard
        await Notification.create({
          institute_id: inst._id,
          student_id: student._id,
          type: "TEST_RESULT_ALERT",
          recipient_name: studentName,
          recipient_phone: parentPhone,
          message: messageText,
          status: "SENT"
        });

        // TEMPORARILY DISABLED n8n webhook
        // await sendEventToN8N({ ... });

        sentCount++;
      } catch (err) {
        errors.push(`Failed to notify ${studentName}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      total: results.length,
      skipped: errors.length,
      errors,
      message: `Successfully generated ${sentCount} test alerts for students inside the dashboard.`
    });

  } catch (error) {
    console.error("Test Notify Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
