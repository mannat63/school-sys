import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import Result from "@/models/Result";
import "@/models/Test"; // Ensure model is registered
import mongoose from "mongoose";

export async function GET(req, { params }) {
  try {
    await dbConnect();
    await requireRole(["ADMIN", "TEACHER"]);

    const { id: studentId } = await params;

    // Populate full test details including subjects array for max_marks
    const results = await Result.find({
      student_id: new mongoose.Types.ObjectId(studentId),
    })
      .populate({
        path: "test_id",
        select: "name date subjects total_marks section_id",
        populate: { path: "section_id", select: "name class_id", populate: { path: "class_id", select: "name" } },
      })
      .lean();

    // Sort by date descending
    results.sort((a, b) => {
      const dateA = a.test_id?.date ? new Date(a.test_id.date) : 0;
      const dateB = b.test_id?.date ? new Date(b.test_id.date) : 0;
      return dateB - dateA;
    });

    // Enrich each result with per-subject breakdown and totals
    const enriched = results.map((r) => {
      const test = r.test_id;
      const subjectMarks = r.subject_marks || [];

      // Build per-subject breakdown: { subject, marks, max_marks, pct }
      const subjectBreakdown = subjectMarks.map((sm) => {
        const testSubject = (test?.subjects || []).find(
          (ts) => ts.name === sm.subject
        );
        const max = testSubject?.max_marks ?? 100;
        return {
          subject: sm.subject,
          marks: sm.marks,
          max_marks: max,
          pct: max > 0 ? Math.round((sm.marks / max) * 100) : 0,
        };
      });

      // Compute overall total
      const totalEarned = subjectBreakdown.reduce((s, sb) => s + sb.marks, 0);
      const totalPossible = subjectBreakdown.reduce((s, sb) => s + sb.max_marks, 0);

      // Fallback: if test has old total_marks field
      const fallbackMax = test?.total_marks ?? totalPossible;
      const finalMax = totalPossible > 0 ? totalPossible : fallbackMax;

      return {
        _id: r._id,
        test_id: {
          _id: test?._id,
          name: test?.name,
          date: test?.date,
          total_marks: finalMax,
          section: test?.section_id
            ? `${test.section_id.class_id?.name || ""} - ${test.section_id.name}`
            : "",
        },
        subject_marks: subjectBreakdown,
        total_earned: totalEarned,
        total_marks: finalMax,
        percentage: finalMax > 0 ? Math.round((totalEarned / finalMax) * 100) : 0,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Student Performance API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
