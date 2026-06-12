import dbConnect from "@/lib/db/mongodb";
import Student from "@/models/Student";
import Attendance from "@/models/Attendance";
import Fee from "@/models/Fee";
import Payment from "@/models/Payment";
import Test from "@/models/Test";
import Result from "@/models/Result";

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

export async function fetchAdminReportData({ institute_id, dateFrom, dateTo, sectionId, studentId }) {
    await dbConnect();

    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    end.setUTCHours(23, 59, 59, 999);

    let studentQuery = { institute_id };
    if (sectionId) studentQuery.section_id = sectionId;
    if (studentId) studentQuery._id = studentId;

    const students = await Student.find(studentQuery)
      .populate("user_id", "name phoneOrEmail")
      .populate({ path: "section_id", populate: { path: "class_id", select: "name" } })
      .lean();

    if (students.length === 0) return { overview: null, students: [] };

    const studentIds = students.map(s => s._id);

    // FETCHING DATA FOR THIS PERIOD
    const [attendances, fees, payments, tests] = await Promise.all([
      Attendance.find({ student_id: { $in: studentIds }, date: { $gte: start, $lte: end } }).lean(),
      Fee.find({ student_id: { $in: studentIds } }).lean(),
      Payment.find({ 
        student_id: { $in: studentIds }, 
        status: "CONFIRMED", 
        createdAt: { $gte: start, $lte: end } 
      }).lean(),
      Test.find({ institute_id, date: { $gte: start, $lte: end }, ...(sectionId ? { section_id: sectionId } : {}) }).lean()
    ]);

    const testIds = tests.map(t => t._id);
    const results = await Result.find({ test_id: { $in: testIds }, student_id: { $in: studentIds } }).lean();

    const reportData = students.map(student => {
        const sId = student._id?.toString();
        if (!sId) return null;
        
        const studentAtt = attendances.filter(a => a.student_id?.toString() === sId);
        const presentCount = studentAtt.filter(a => a.status === "PRESENT").length;
        const absentCount = studentAtt.filter(a => a.status === "ABSENT").length;
        const totalDays = presentCount + absentCount;
        const attendancePercentage = totalDays > 0 ? ((presentCount / totalDays) * 100).toFixed(1) : 0;

        const studentFeesAll = fees.filter(f => f.student_id?.toString() === sId);
        const studentPayments = payments.filter(p => p.student_id?.toString() === sId);
        
        const periodRevenue = studentPayments.length > 0 
            ? studentPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
            : studentFeesAll.reduce((sum, f) => sum + (f.paid_amount || 0), 0);

        const periodPending = studentFeesAll.filter(f => {
            const dueDate = new Date(f.due_date);
            return f.status !== "PAID" && dueDate <= end;
        }).reduce((sum, f) => sum + (f.due_amount || 0), 0);

        const totalFeeObj = {
            total: studentFeesAll.reduce((sum, f) => sum + (f.total_amount || 0), 0),
            paid: periodRevenue, 
            due: periodPending   
        };

        let marksScored = 0;
        let marksTotal = 0;
        const studentResults = results.filter(r => r.student_id?.toString() === sId);
        
        const testDetails = studentResults.map(r => {
            const testObj = tests.find(t => t._id?.toString() === r.test_id?.toString());
            const scored = getResultMarks(r);
            const maxMarks = testObj ? getTestMaxMarks(testObj) : 0;
            
            if (testObj) {
                marksScored += scored;
                marksTotal += maxMarks;
            }
            return {
                test_name: testObj?.name || "Unknown",
                date: testObj?.date,
                marks: scored,
                total_marks: maxMarks,
                percentage: maxMarks > 0 ? ((scored / maxMarks) * 100).toFixed(1) : 0
            };
        });

        const testPercentage = marksTotal > 0 ? ((marksScored / marksTotal) * 100).toFixed(1) : 0;

        return {
            student: {
                id: sId,
                name: student.user_id?.name || student.parent_name || "Unknown",
                parent_phone: student.parent_phone,
                section: student.section_id ? `${student.section_id.class_id?.name || ""} - ${student.section_id.name}`.replace(/^ - /, '') : "Unknown Course",
                raw_section_name: student.section_id?.name || "Unknown Course"
            },
            attendance: { total_days: totalDays, present: presentCount, absent: absentCount, percentage: parseFloat(attendancePercentage) },
            fees: totalFeeObj,
            tests: { taken: studentResults.length, marks_scored: marksScored, marks_total: marksTotal, percentage: parseFloat(testPercentage), details: testDetails }
        };
    }).filter(Boolean);

    // Ranking Logic
    reportData.sort((a, b) => b.tests.percentage - a.tests.percentage);
    reportData.forEach((sd, index) => { sd.tests.rank = sd.tests.taken > 0 ? index + 1 : "N/A"; });

    // Identify Overall Top Performer
    const topPerformer = reportData.find(s => s.tests.taken > 0);

    // Identify Section toppers
    const sectionToppers = {}; 
    reportData.forEach(s => {
        if (s.tests.taken > 0) {
            const b = s.student.section;
            if (!sectionToppers[b] || s.tests.percentage > sectionToppers[b].score) {
                sectionToppers[b] = { name: s.student.name, score: s.tests.percentage };
            }
        }
    });

    reportData.sort((a, b) => a.student.name.localeCompare(b.student.name));

    const overview = {
        total_students: reportData.length,
        total_revenue_collected: reportData.reduce((sum, s) => sum + s.fees.paid, 0),
        pending_fees: reportData.reduce((sum, s) => sum + s.fees.due, 0),
        avg_attendance: reportData.length > 0 ? (reportData.reduce((sum, s) => sum + s.attendance.percentage, 0) / (reportData.filter(s => s.attendance.total_days > 0).length || 1)).toFixed(1) : 0,
        tests_conducted: tests.length,
        top_performer: topPerformer ? { name: topPerformer.student.name, score: topPerformer.tests.percentage } : null,
        section_toppers: Object.entries(sectionToppers).map(([section, info]) => ({ section, ...info }))
    };

    return { overview, students: reportData };
}
