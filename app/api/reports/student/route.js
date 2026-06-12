import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser } from "@/lib/auth";
import Student from "@/models/Student";
import Attendance from "@/models/Attendance";
import Fee from "@/models/Fee";
import Test from "@/models/Test";
import Result from "@/models/Result";
import Section from "@/models/Section";
import Class from "@/models/Class";
import Institute from "@/models/Institute";

/**
 * Compute total marks from a result document.
 * Supports both new subject_marks array and legacy flat marks field.
 */
function getResultMarks(result) {
    if (result.subject_marks && result.subject_marks.length > 0) {
        return result.subject_marks.reduce((sum, sm) => sum + (sm.marks || 0), 0);
    }
    return result.marks || 0;
}

/**
 * Compute max possible marks from a test document.
 * Supports both new subjects array and legacy total_marks field.
 */
function getTestMaxMarks(test) {
    if (test.subjects && test.subjects.length > 0) {
        return test.subjects.reduce((sum, s) => sum + (s.max_marks || 0), 0);
    }
    return test.total_marks || 0;
}

export async function GET(req) {
  try {
    await dbConnect();
    const authUser = await getAuthUser();
    
    // Only allow students to access this
    if (authUser.role !== "STUDENT") {
        return NextResponse.json({ error: "Forbidden: Students only" }, { status: 403 });
    }
    
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    if (!dateFrom || !dateTo) {
        return NextResponse.json({ error: "dateFrom and dateTo are required" }, { status: 400 });
    }

    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    end.setUTCHours(23, 59, 59, 999);

    const student = await Student.findOne({ user_id: authUser._id })
        .populate("user_id", "name phoneOrEmail")
        .populate({
          path: "section_id",
          select: "name class_id",
          populate: { path: "class_id", select: "name" },
        })
        .lean();

    if (!student) {
        return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const sId = student._id;
    const inst = await Institute.findById(student.institute_id).lean();

    // Fetch Aggregated Data for This Student
    const [attendances, fees, tests] = await Promise.all([
      Attendance.find({
        student_id: sId,
        date: { $gte: start, $lte: end }
      }).lean(),
      Fee.find({
        student_id: sId
      }).lean(),
      Test.find({
        section_id: student.section_id?._id,
        date: { $gte: start, $lte: end }
      }).lean()
    ]);

    const testIds = tests.map(t => t._id);
    const [myResults, allResults] = await Promise.all([
        Result.find({ test_id: { $in: testIds }, student_id: sId }).lean(),
        Result.find({ test_id: { $in: testIds } }).lean() // to calculate rank
    ]);

    // Calculate Attendance
    const presentCount = attendances.filter(a => a.status === "PRESENT").length;
    const absentCount = attendances.filter(a => a.status === "ABSENT").length;
    const totalDays = presentCount + absentCount;
    const attendancePercentage = totalDays > 0 ? ((presentCount / totalDays) * 100).toFixed(1) : 0;

    // Calculate Fees
    const totalFeeObj = fees.reduce((acc, curr) => {
        acc.total += (curr.total_amount || 0);
        acc.paid += (curr.paid_amount || 0);
        acc.due += (curr.due_amount || 0);
        return acc;
    }, { total: 0, paid: 0, due: 0 });

    // Calculate Tests and Rank
    let marksScored = 0;
    let marksTotal = 0;
    
    const testDetails = myResults.map(r => {
        const testObj = tests.find(t => t._id.toString() === r.test_id?.toString());
        const scored = getResultMarks(r);
        const maxMarks = testObj ? getTestMaxMarks(testObj) : 0;

        if (testObj) {
            marksScored += scored;
            marksTotal += maxMarks;
        }
        
        // Calculate specific test rank using the same scoring method
        const testOthers = allResults
          .filter(ar => ar.test_id?.toString() === testObj?._id?.toString())
          .map(ar => ({ student_id: ar.student_id, scored: getResultMarks(ar) }));
        
        testOthers.sort((a, b) => b.scored - a.scored);
        const rank = testOthers.findIndex(a => a.student_id?.toString() === sId.toString()) + 1;

        return {
            test_name: testObj?.name || "Unknown",
            date: testObj?.date,
            marks: scored,
            total_marks: maxMarks,
            percentage: maxMarks > 0 ? ((scored / maxMarks) * 100).toFixed(1) : 0,
            rank: rank > 0 ? rank : "N/A"
        };
    });

    const testPercentage = marksTotal > 0 ? ((marksScored / marksTotal) * 100).toFixed(1) : 0;

    return NextResponse.json({
        institute: {
            name: inst?.name || "Institute"
        },
        student: {
            id: sId,
            name: student.user_id?.name || student.parent_name || "Unknown",
            parent_phone: student.parent_phone,
            className: student.section_id?.class_id?.name || "Unassigned",
            sectionName: student.section_id?.name || "Unassigned",
            section: `${student.section_id?.class_id?.name || ""} - ${student.section_id?.name || ""}`.trim() || "Unassigned",
        },
        attendance: {
            total_days: totalDays,
            present: presentCount,
            absent: absentCount,
            percentage: parseFloat(attendancePercentage)
        },
        fees: totalFeeObj,
        tests: {
            taken: myResults.length,
            marks_scored: marksScored,
            marks_total: marksTotal,
            percentage: parseFloat(testPercentage),
            details: testDetails
        }
    });
  } catch (error) {
    console.error("Student Report Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
