import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import Student from "@/models/Student";
import Fee from "@/models/Fee";
import Payment from "@/models/Payment";
import Attendance from "@/models/Attendance";
import Test from "@/models/Test";
import Result from "@/models/Result";
import Section from "@/models/Section";
import Class from "@/models/Class";
import User from "@/models/User";
import Lead from "@/models/Lead";
import mongoose from "mongoose";
import { withPerf } from "@/lib/perfLogger";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30

/** Return a Date shifted so that UTC midnight equals IST midnight. */
function istNow() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

/** First millisecond of a given month in IST (represented as UTC). */
function istMonthStart(year, month) {
  // month is 0-indexed
  return new Date(Date.UTC(year, month, 1) - IST_OFFSET_MS);
}

/** Last millisecond + 1 of a given month in IST. */
function istMonthEnd(year, month) {
  return istMonthStart(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1);
}

/** Get IST month boundaries for N months back (0 = current month). */
function getMonthRange(monthsBack) {
  const now = istNow();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth() - monthsBack;
  while (m < 0) { m += 12; y -= 1; }
  return { start: istMonthStart(y, m), end: istMonthEnd(y, m), year: y, month: m };
}

/** Label like "Jan 2026" for a 0-indexed month. */
function monthLabel(year, month) {
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[month]} ${year}`;
}

/** Safe percentage: returns 0 when denominator is 0. */
function pct(numerator, denominator, decimals = 1) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100 * 10 ** decimals) / 10 ** decimals;
}

/** Growth % between previous and current values. */
function growthPct(previous, current) {
  if (!previous) return current > 0 ? 100 : 0;
  return pct(current - previous, previous);
}

// ---------------------------------------------------------------------------
// GET /api/dashboard/director
// ---------------------------------------------------------------------------

async function handler() {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const institute_id = authUser.institute_id;

    // ---------------- Date boundaries ----------------
    const now = istNow();
    const thisMonth = getMonthRange(0);
    const prevMonth = getMonthRange(1);

    // Last 30 days for attendance window
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Build 6-month ranges
    const sixMonthRanges = Array.from({ length: 6 }, (_, i) => getMonthRange(5 - i));

    // Earliest date we care about (6 months ago)
    const sixMonthsAgoStart = sixMonthRanges[0].start;

    // ================================================================
    // PHASE 1 – Parallel data fetches
    // ================================================================

    const [
      // Basic counts
      totalStudents,
      allSections,
      allClasses,

      // Students with section info
      allStudents,

      // Admissions this month / prev month
      admissionsThisMonth,
      admissionsPrevMonth,

      // Admissions by month (last 6)
      admissionsByMonth,

      // Revenue this month / prev month (from Payment)
      revenueThisMonth,
      revenuePrevMonth,

      // Revenue by month (last 6)
      revenueByMonth,

      // Fee collection totals
      feeCollectionTotals,

      // Outstanding fees by section
      outstandingBySection,

      // Student counts per section
      studentsBySection,

      // Fees per section (total + paid)
      feesBySection,

      // Attendance last 30 days per student
      attendanceLast30,

      // Attendance last 30 days per section
      attendanceBySection,

      // All tests with results (for exam analytics + risk)
      allTests,

      // Results with test info for analytics
      allResults,

      // Lead status counts
      leadStatusCounts,

      // Overdue fees (due_date passed, status != PAID)
      overdueFees,
    ] = await Promise.all([
      // 0 – total students
      Student.countDocuments({ institute_id }),

      // 1 – all sections
      Section.find({ institute_id }).lean(),

      // 2 – all classes
      Class.find({ institute_id }).lean(),

      // 3 – all students (id, section_id, user_id)
      Student.find({ institute_id }).select("_id section_id user_id admission_date").lean(),

      // 4 – admissions this month
      Student.countDocuments({
        institute_id,
        admission_date: { $gte: thisMonth.start, $lt: thisMonth.end },
      }),

      // 5 – admissions prev month
      Student.countDocuments({
        institute_id,
        admission_date: { $gte: prevMonth.start, $lt: prevMonth.end },
      }),

      // 6 – admissions by month (6 months)
      Student.aggregate([
        {
          $match: {
            institute_id: new mongoose.Types.ObjectId(institute_id),
            admission_date: { $gte: sixMonthsAgoStart },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: { $add: ["$admission_date", IST_OFFSET_MS] } },
              month: { $month: { $add: ["$admission_date", IST_OFFSET_MS] } },
            },
            count: { $sum: 1 },
          },
        },
      ]),

      // 7 – revenue this month
      Payment.aggregate([
        {
          $match: {
            institute_id: new mongoose.Types.ObjectId(institute_id),
            status: "CONFIRMED",
            createdAt: { $gte: thisMonth.start, $lt: thisMonth.end },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      // 8 – revenue prev month
      Payment.aggregate([
        {
          $match: {
            institute_id: new mongoose.Types.ObjectId(institute_id),
            status: "CONFIRMED",
            createdAt: { $gte: prevMonth.start, $lt: prevMonth.end },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      // 9 – revenue by month (6 months)
      Payment.aggregate([
        {
          $match: {
            institute_id: new mongoose.Types.ObjectId(institute_id),
            status: "CONFIRMED",
            createdAt: { $gte: sixMonthsAgoStart },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: { $add: ["$createdAt", IST_OFFSET_MS] } },
              month: { $month: { $add: ["$createdAt", IST_OFFSET_MS] } },
            },
            total: { $sum: "$amount" },
          },
        },
      ]),

      // 10 – fee collection totals
      Fee.aggregate([
        { $match: { institute_id: new mongoose.Types.ObjectId(institute_id) } },
        {
          $group: {
            _id: null,
            totalExpected: { $sum: "$total_amount" },
            totalCollected: { $sum: "$paid_amount" },
            totalOutstanding: { $sum: "$due_amount" },
          },
        },
      ]),

      // 11 – outstanding fees grouped by section
      Fee.aggregate([
        {
          $match: {
            institute_id: new mongoose.Types.ObjectId(institute_id),
            status: { $ne: "PAID" },
          },
        },
        {
          $lookup: {
            from: "students",
            localField: "student_id",
            foreignField: "_id",
            as: "student",
          },
        },
        { $unwind: "$student" },
        {
          $group: {
            _id: "$student.section_id",
            outstanding: { $sum: "$due_amount" },
            count: { $sum: 1 },
          },
        },
      ]),

      // 12 – student count per section
      Student.aggregate([
        { $match: { institute_id: new mongoose.Types.ObjectId(institute_id) } },
        { $group: { _id: "$section_id", count: { $sum: 1 } } },
      ]),

      // 13 – fees per section
      Fee.aggregate([
        { $match: { institute_id: new mongoose.Types.ObjectId(institute_id) } },
        {
          $lookup: {
            from: "students",
            localField: "student_id",
            foreignField: "_id",
            as: "student",
          },
        },
        { $unwind: "$student" },
        {
          $group: {
            _id: "$student.section_id",
            totalRevenue: { $sum: "$total_amount" },
            collectedRevenue: { $sum: "$paid_amount" },
          },
        },
      ]),

      // 14 – attendance last 30 days per student
      Attendance.aggregate([
        {
          $match: {
            institute_id: new mongoose.Types.ObjectId(institute_id),
            date: { $gte: thirtyDaysAgo },
            status: { $ne: "NOT_MARKED" },
          },
        },
        {
          $group: {
            _id: "$student_id",
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } },
          },
        },
      ]),

      // 15 – attendance last 30 days per section
      Attendance.aggregate([
        {
          $match: {
            institute_id: new mongoose.Types.ObjectId(institute_id),
            date: { $gte: thirtyDaysAgo },
            status: { $ne: "NOT_MARKED" },
          },
        },
        {
          $group: {
            _id: "$section_id",
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } },
          },
        },
      ]),

      // 16 – all tests (sorted by date desc) for this institute, capped at 200
      Test.find({ institute_id }).sort({ date: -1 }).limit(200).lean(),

      // 17 – all results for this institute, capped at 15000 (newest first)
      Result.find({ institute_id }).sort({ createdAt: -1 }).limit(15000).lean(),

      // 18 – leads status counts
      Lead.aggregate([
        { $match: { institute_id: new mongoose.Types.ObjectId(institute_id) } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // 19 – overdue fees (due_date passed, not PAID)
      Fee.aggregate([
        {
          $match: {
            institute_id: new mongoose.Types.ObjectId(institute_id),
            status: { $ne: "PAID" },
            due_date: { $lt: new Date() },
          },
        },
        {
          $lookup: {
            from: "students",
            localField: "student_id",
            foreignField: "_id",
            as: "student",
          },
        },
        { $unwind: "$student" },
        {
          $project: {
            student_id: 1,
            due_amount: 1,
            due_date: 1,
            "student.section_id": 1,
            "student.user_id": 1,
          },
        },
      ]),
    ]);

    // ================================================================
    // PHASE 2 – Build lookup maps
    // ================================================================

    const classMap = Object.fromEntries(allClasses.map((c) => [c._id.toString(), c.name]));
    const sectionMap = Object.fromEntries(
      allSections.map((s) => [
        s._id.toString(),
        { name: s.name, class_id: s.class_id.toString(), className: classMap[s.class_id.toString()] || "Unknown" },
      ])
    );

    const studentSectionMap = Object.fromEntries(
      allStudents.map((s) => [s._id.toString(), s.section_id?.toString()])
    );
    const studentUserMap = Object.fromEntries(
      allStudents.map((s) => [s._id.toString(), s.user_id?.toString()])
    );

    // User names – fetch only for students
    const studentUserIds = [...new Set(allStudents.map((s) => s.user_id).filter(Boolean))];
    const userDocs = studentUserIds.length
      ? await User.find({ _id: { $in: studentUserIds } }).select("_id name").lean()
      : [];
    const userNameMap = Object.fromEntries(userDocs.map((u) => [u._id.toString(), u.name]));

    // Attendance map: studentId -> { total, present }
    const attendanceMap = Object.fromEntries(
      attendanceLast30.map((a) => [a._id.toString(), { total: a.total, present: a.present }])
    );

    // Student count map: sectionId -> count
    const sectionStudentCountMap = Object.fromEntries(
      studentsBySection.map((s) => [s._id.toString(), s.count])
    );

    // Fee map per section
    const sectionFeeMap = Object.fromEntries(
      feesBySection.map((f) => [f._id.toString(), { totalRevenue: f.totalRevenue, collectedRevenue: f.collectedRevenue }])
    );

    // Attendance per section
    const sectionAttendanceMap = Object.fromEntries(
      attendanceBySection.map((a) => [a._id.toString(), { total: a.total, present: a.present }])
    );

    // ================================================================
    // SECTION 1 – KPI Cards
    // ================================================================

    const revenueThisMonthVal = revenueThisMonth[0]?.total || 0;
    const revenuePrevMonthVal = revenuePrevMonth[0]?.total || 0;

    const feeTotals = feeCollectionTotals[0] || { totalExpected: 0, totalCollected: 0, totalOutstanding: 0 };

    // Batch occupancy: average across all sections
    const totalCapacity = allSections.reduce((sum, sec) => sum + (sec.capacity || 30), 0);
    const batchOccupancy = pct(totalStudents, totalCapacity);

    // Students at risk – count (detailed list built in Section 5)
    // Quick pass: attendance < 75% OR overdue fees OR marks declining
    const lowAttendanceStudentIds = new Set(
      attendanceLast30
        .filter((a) => a.total > 0 && pct(a.present, a.total) < 50)
        .map((a) => a._id.toString())
    );

    const overdueFeeStudentIds = new Set(
      overdueFees.map((f) => f.student_id.toString())
    );

    // Marks declining: compare last 2 tests per student
    const decliningStudentIds = new Set();
    const testMap = Object.fromEntries(allTests.map((t) => [t._id.toString(), t]));

    // Group results by student
    const resultsByStudent = {};
    for (const r of allResults) {
      const sid = r.student_id.toString();
      if (!resultsByStudent[sid]) resultsByStudent[sid] = [];
      resultsByStudent[sid].push(r);
    }

    // For each student, check if their most recent test score is lower than the previous
    for (const [sid, results] of Object.entries(resultsByStudent)) {
      if (results.length < 2) continue;
      // Sort by test date descending
      const sorted = results
        .map((r) => {
          const test = testMap[r.test_id.toString()];
          const totalMarks = r.subject_marks.reduce((s, sm) => s + sm.marks, 0);
          const maxMarks = test
            ? test.subjects.reduce((s, sub) => s + sub.max_marks, 0)
            : 0;
          return { date: test?.date || new Date(0), totalMarks, maxMarks, pct: pct(totalMarks, maxMarks) };
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      if (sorted[0].pct < 40 || sorted[0].pct < sorted[1].pct - 20) {
        decliningStudentIds.add(sid);
      }
    }

    const allRiskStudentIds = new Set([
      ...lowAttendanceStudentIds,
      ...decliningStudentIds,
    ]);

    const kpi = {
      admissions: {
        count: admissionsThisMonth,
        growthPct: growthPct(admissionsPrevMonth, admissionsThisMonth),
      },
      revenue: {
        amount: revenueThisMonthVal,
        growthPct: growthPct(revenuePrevMonthVal, revenueThisMonthVal),
      },
      leadConversion: {
        rate: pct(admissionsThisMonth, totalStudents),
        description: "Admissions this month as % of total students",
      },
      batchOccupancy: {
        percentage: batchOccupancy,
        totalStudents,
        totalCapacity,
      },
      outstandingFees: {
        amount: feeTotals.totalOutstanding,
      },
      studentsAtRisk: {
        count: allRiskStudentIds.size,
      },
    };

    // ================================================================
    // SECTION 2 – Admission Funnel
    // ================================================================

    const admissionMonthMap = Object.fromEntries(
      admissionsByMonth.map((a) => [`${a._id.year}-${a._id.month}`, a.count])
    );

    const admissionFunnel = sixMonthRanges.map((r) => {
      const key = `${r.year}-${r.month + 1}`; // $month is 1-indexed in aggregation
      return {
        month: monthLabel(r.year, r.month),
        count: admissionMonthMap[key] || 0,
      };
    });

    // ================================================================
    // SECTION 3 – Revenue Analytics
    // ================================================================

    const revenueMonthMap = Object.fromEntries(
      revenueByMonth.map((r) => [`${r._id.year}-${r._id.month}`, r.total])
    );

    const revenueTrend = sixMonthRanges.map((r) => {
      const key = `${r.year}-${r.month + 1}`;
      return {
        month: monthLabel(r.year, r.month),
        revenue: revenueMonthMap[key] || 0,
      };
    });

    const outstandingByBatch = allSections.map((sec) => {
      const secId = sec._id.toString();
      const entry = outstandingBySection.find((o) => o._id?.toString() === secId);
      return {
        sectionId: secId,
        sectionName: sec.name,
        className: classMap[sec.class_id.toString()] || "Unknown",
        outstanding: entry?.outstanding || 0,
        count: entry?.count || 0,
      };
    });

    const revenueAnalytics = {
      trend: revenueTrend,
      feeCollection: {
        totalExpected: feeTotals.totalExpected,
        totalCollected: feeTotals.totalCollected,
        totalOutstanding: feeTotals.totalOutstanding,
      },
      outstandingByBatch,
    };

    // ================================================================
    // SECTION 4 – Batch Intelligence
    // ================================================================

    // Test performance per section: avg percentage
    const sectionTestPerf = {};
    for (const r of allResults) {
      const sid = r.student_id.toString();
      const secId = studentSectionMap[sid];
      if (!secId) continue;
      const test = testMap[r.test_id.toString()];
      if (!test) continue;
      const totalMarks = r.subject_marks.reduce((s, sm) => s + sm.marks, 0);
      const maxMarks = test.subjects.reduce((s, sub) => s + sub.max_marks, 0);
      if (!sectionTestPerf[secId]) sectionTestPerf[secId] = { totalPct: 0, count: 0 };
      sectionTestPerf[secId].totalPct += pct(totalMarks, maxMarks);
      sectionTestPerf[secId].count += 1;
    }

    const batchIntelligence = allSections.map((sec) => {
      const secId = sec._id.toString();
      const studentCount = sectionStudentCountMap[secId] || 0;
      const fees = sectionFeeMap[secId] || { totalRevenue: 0, collectedRevenue: 0 };
      const att = sectionAttendanceMap[secId] || { total: 0, present: 0 };
      const perf = sectionTestPerf[secId] || { totalPct: 0, count: 0 };

      const secCapacity = sec.capacity || 30;

      return {
        sectionId: secId,
        sectionName: sec.name,
        className: classMap[sec.class_id.toString()] || "Unknown",
        studentCount,
        capacity: secCapacity,
        occupancyPct: pct(studentCount, secCapacity),
        totalRevenue: fees.totalRevenue,
        collectedRevenue: fees.collectedRevenue,
        avgAttendancePct: pct(att.present, att.total),
        avgTestPerformancePct: perf.count ? pct(perf.totalPct, perf.count, 1) : 0,
      };
    });

    // ================================================================
    // SECTION 5 – Student Risk Engine
    // ================================================================

    // Overdue fees map: studentId -> total due
    const overdueByStudent = {};
    for (const f of overdueFees) {
      const sid = f.student_id.toString();
      if (!overdueByStudent[sid]) overdueByStudent[sid] = 0;
      overdueByStudent[sid] += f.due_amount;
    }

    const riskStudents = [];
    for (const sid of allRiskStudentIds) {
      const riskFactors = [];

      if (lowAttendanceStudentIds.has(sid)) {
        const att = attendanceMap[sid];
        riskFactors.push({
          type: "LOW_ATTENDANCE",
          detail: `Attendance ${pct(att.present, att.total)}% (last 30 days)`,
        });
      }

      if (overdueFeeStudentIds.has(sid)) {
        riskFactors.push({
          type: "OVERDUE_FEES",
          detail: `Pending fees: ₹${overdueByStudent[sid] || 0}`,
        });
      }

      if (decliningStudentIds.has(sid)) {
        riskFactors.push({
          type: "DECLINING_PERFORMANCE",
          detail: "Test scores declined compared to previous test",
        });
      }

      const riskScore =
        riskFactors.length >= 3 ? "HIGH" : riskFactors.length === 2 ? "MEDIUM" : "LOW";

      const secId = studentSectionMap[sid];
      const userId = studentUserMap[sid];
      const secInfo = secId ? sectionMap[secId] : null;

      riskStudents.push({
        studentId: sid,
        name: userId ? userNameMap[userId] || "Unknown" : "Unknown",
        section: secInfo ? `${secInfo.className} - ${secInfo.name}` : "Unknown",
        riskFactors,
        riskScore,
      });
    }

    // Sort: HIGH first, then MEDIUM, then LOW
    const riskOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    riskStudents.sort((a, b) => riskOrder[a.riskScore] - riskOrder[b.riskScore]);

    // ================================================================
    // SECTION 6 – Exam Analytics
    // ================================================================

    // Subject-wise average marks across all tests
    const subjectTotals = {};
    for (const r of allResults) {
      for (const sm of r.subject_marks) {
        if (!subjectTotals[sm.subject]) subjectTotals[sm.subject] = { totalMarks: 0, count: 0, maxMarks: 0 };
        subjectTotals[sm.subject].totalMarks += sm.marks;
        subjectTotals[sm.subject].count += 1;

        // Find max_marks for this subject from the test
        const test = testMap[r.test_id.toString()];
        if (test) {
          const subInfo = test.subjects.find((s) => s.name === sm.subject);
          if (subInfo) subjectTotals[sm.subject].maxMarks += subInfo.max_marks;
        }
      }
    }

    const subjectWiseAverage = Object.entries(subjectTotals).map(([subject, data]) => ({
      subject,
      avgMarks: data.count ? Math.round((data.totalMarks / data.count) * 10) / 10 : 0,
      avgPercentage: pct(data.totalMarks, data.maxMarks),
      totalStudentsAttempted: data.count,
    }));

    // Per-subject performance trends (last 3 tests per subject)
    // Group tests by subject, then take last 3 by date
    const subjectTestMap = {}; // subject -> [{testId, testName, date, avgMarks, maxMarks}]
    for (const test of allTests) {
      for (const sub of test.subjects) {
        if (!subjectTestMap[sub.name]) subjectTestMap[sub.name] = [];
        subjectTestMap[sub.name].push({
          testId: test._id.toString(),
          testName: test.name,
          date: test.date,
          maxMarks: sub.max_marks,
          marksArr: [],
        });
      }
    }

    // Fill in marks
    for (const r of allResults) {
      for (const sm of r.subject_marks) {
        const entries = subjectTestMap[sm.subject];
        if (!entries) continue;
        const entry = entries.find((e) => e.testId === r.test_id.toString());
        if (entry) entry.marksArr.push(sm.marks);
      }
    }

    const subjectTrends = {};
    for (const [subject, tests] of Object.entries(subjectTestMap)) {
      // Sort by date desc, take last 3
      const sorted = tests.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3).reverse();
      subjectTrends[subject] = sorted.map((t) => ({
        testName: t.testName,
        date: t.date,
        avgMarks: t.marksArr.length
          ? Math.round((t.marksArr.reduce((s, m) => s + m, 0) / t.marksArr.length) * 10) / 10
          : 0,
        maxMarks: t.maxMarks,
        avgPercentage: t.marksArr.length
          ? pct(t.marksArr.reduce((s, m) => s + m, 0) / t.marksArr.length, t.maxMarks)
          : 0,
      }));
    }

    // Top 5 students by average score
    const studentAvgScores = [];
    for (const [sid, results] of Object.entries(resultsByStudent)) {
      let totalPct = 0;
      let count = 0;
      for (const r of results) {
        const test = testMap[r.test_id.toString()];
        if (!test) continue;
        const scored = r.subject_marks.reduce((s, sm) => s + sm.marks, 0);
        const max = test.subjects.reduce((s, sub) => s + sub.max_marks, 0);
        if (max > 0) {
          totalPct += pct(scored, max);
          count++;
        }
      }
      if (count > 0) {
        const userId = studentUserMap[sid];
        const secId = studentSectionMap[sid];
        const secInfo = secId ? sectionMap[secId] : null;
        studentAvgScores.push({
          studentId: sid,
          name: userId ? userNameMap[userId] || "Unknown" : "Unknown",
          section: secInfo ? `${secInfo.className} - ${secInfo.name}` : "Unknown",
          avgPercentage: Math.round((totalPct / count) * 10) / 10,
          testsAttempted: count,
        });
      }
    }
    studentAvgScores.sort((a, b) => b.avgPercentage - a.avgPercentage);
    const topStudents = studentAvgScores.slice(0, 5);

    // Section-wise comparison (avg score per section)
    const sectionScoreAgg = {};
    for (const entry of studentAvgScores) {
      const secId = studentSectionMap[entry.studentId];
      if (!secId) continue;
      if (!sectionScoreAgg[secId]) sectionScoreAgg[secId] = { totalPct: 0, count: 0 };
      sectionScoreAgg[secId].totalPct += entry.avgPercentage;
      sectionScoreAgg[secId].count += 1;
    }

    const sectionComparison = allSections.map((sec) => {
      const secId = sec._id.toString();
      const agg = sectionScoreAgg[secId] || { totalPct: 0, count: 0 };
      return {
        sectionId: secId,
        sectionName: sec.name,
        className: classMap[sec.class_id.toString()] || "Unknown",
        avgPercentage: agg.count ? Math.round((agg.totalPct / agg.count) * 10) / 10 : 0,
        studentsEvaluated: agg.count,
      };
    });

    const examAnalytics = {
      subjectWiseAverage,
      subjectTrends,
      topStudents,
      sectionComparison,
    };

    // ================================================================
    // SECTION 7 – Lead CRM Overview
    // ================================================================

    const leadCounts = {};
    for (const s of leadStatusCounts) leadCounts[s._id] = s.count;

    const totalLeads = Object.values(leadCounts).reduce((a, b) => a + b, 0);
    const convertedLeads = leadCounts["CONVERTED"] || 0;

    const leadCRM = {
      total: totalLeads,
      converted: convertedLeads,
      conversionRate: pct(convertedLeads, totalLeads),
      pipeline: [
        { stage: "New",          count: leadCounts["NEW"] || 0,            color: "#6366f1" },
        { stage: "Contacted",    count: leadCounts["CONTACTED"] || 0,      color: "#8b5cf6" },
        { stage: "Interested",   count: leadCounts["INTERESTED"] || 0,     color: "#3b82f6" },
        { stage: "Demo",         count: leadCounts["DEMO_SCHEDULED"] || 0, color: "#f59e0b" },
        { stage: "Follow-up",    count: leadCounts["FOLLOW_UP"] || 0,      color: "#f97316" },
        { stage: "Converted",    count: convertedLeads,                    color: "#10b981" },
        { stage: "Lost",         count: leadCounts["LOST"] || 0,           color: "#ef4444" },
      ],
    };

    // ================================================================
    // SECTION 8 – AI Director Insights
    // ================================================================

    const insights = [];

    // 1. Outstanding fees > 30 days
    const thirtyDaysAgoDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const longOverdue = overdueFees.filter((f) => new Date(f.due_date) < thirtyDaysAgoDate);
    const longOverdueStudentIds = new Set(longOverdue.map((f) => f.student_id.toString()));
    const longOverdueAmount = longOverdue.reduce((s, f) => s + f.due_amount, 0);

    if (longOverdueStudentIds.size > 0) {
      insights.push({
        issue: `${longOverdueStudentIds.size} student(s) have pending fees above 30 days`,
        impact: `Recovering these dues can generate ₹${longOverdueAmount.toLocaleString("en-IN")}`,
        recommendation:
          "Send automated fee reminders and schedule parent meetings for high-value defaults. Consider offering EMI plans for large outstanding amounts.",
      });
    }

    // 2. Batch occupancy < 50%
    for (const batch of batchIntelligence) {
      if (batch.occupancyPct < 50 && batch.studentCount > 0) {
        insights.push({
          issue: `${batch.className} - ${batch.sectionName} occupancy is only ${batch.occupancyPct}%`,
          impact: `${(batch.capacity || 30) - batch.studentCount} seats unfilled translates to potential revenue loss of ₹${(((batch.capacity || 30) - batch.studentCount) * (batch.totalRevenue / (batch.studentCount || 1))).toLocaleString("en-IN")}`,
          recommendation: `Marketing spend should focus on ${batch.className} - ${batch.sectionName}. Consider targeted campaigns, referral discounts, or batch consolidation.`,
        });
      }
    }

    // 3. Subject avg dropped (compare last 2 data points in trends)
    for (const [subject, trend] of Object.entries(subjectTrends)) {
      if (trend.length >= 2) {
        const latest = trend[trend.length - 1];
        const previous = trend[trend.length - 2];
        if (latest.avgPercentage < previous.avgPercentage) {
          const drop = Math.round((previous.avgPercentage - latest.avgPercentage) * 10) / 10;
          insights.push({
            issue: `${subject} scores dropped ${drop}% in the latest test`,
            impact: `Average fell from ${previous.avgPercentage}% to ${latest.avgPercentage}%, which may affect overall academic results and parent satisfaction.`,
            recommendation: `Schedule remedial classes for ${subject}. Review teaching methodology and consider additional practice tests.`,
          });
        }
      }
    }

    // 4. Admission trend declining
    if (admissionFunnel.length >= 2) {
      const currentMonthAdm = admissionFunnel[admissionFunnel.length - 1].count;
      const prevMonthAdm = admissionFunnel[admissionFunnel.length - 2].count;
      if (prevMonthAdm > 0 && currentMonthAdm < prevMonthAdm) {
        const dropPct = pct(prevMonthAdm - currentMonthAdm, prevMonthAdm);
        insights.push({
          issue: `Admissions dropped ${dropPct}% compared to last month`,
          impact: `${currentMonthAdm} admissions this month vs ${prevMonthAdm} last month. Sustained decline will affect revenue pipeline.`,
          recommendation:
            "Review marketing channels, activate referral programs, and analyse drop-off points in the inquiry process.",
        });
      }
    }

    // 5. Attendance dropping (compare this week vs previous week)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const [thisWeekAtt, prevWeekAtt] = await Promise.all([
      Attendance.aggregate([
        {
          $match: {
            institute_id: new mongoose.Types.ObjectId(institute_id),
            date: { $gte: sevenDaysAgo },
            status: { $ne: "NOT_MARKED" },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } },
          },
        },
      ]),
      Attendance.aggregate([
        {
          $match: {
            institute_id: new mongoose.Types.ObjectId(institute_id),
            date: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo },
            status: { $ne: "NOT_MARKED" },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const thisWeekPct = thisWeekAtt[0] ? pct(thisWeekAtt[0].present, thisWeekAtt[0].total) : 0;
    const prevWeekPct = prevWeekAtt[0] ? pct(prevWeekAtt[0].present, prevWeekAtt[0].total) : 0;

    if (prevWeekPct > 0 && thisWeekPct < prevWeekPct) {
      insights.push({
        issue: `Average attendance dropped from ${prevWeekPct}% to ${thisWeekPct}% this week`,
        impact: `A ${Math.round((prevWeekPct - thisWeekPct) * 10) / 10}% decline in attendance correlates with lower engagement and potential dropouts.`,
        recommendation:
          "Investigate reasons for absenteeism. Send parent notifications and consider implementing attendance incentive programs.",
      });
    }

    // If no insights were generated, provide a positive summary
    if (insights.length === 0) {
      insights.push({
        issue: "All metrics are stable",
        impact: "No critical concerns detected across fees, attendance, performance, or admissions.",
        recommendation: "Continue monitoring. Focus on growth strategies and student engagement programs.",
      });
    }

    // ================================================================
    // RESPONSE
    // ================================================================

    return NextResponse.json({
      success: true,
      data: {
        kpi,
        admissionFunnel,
        revenueAnalytics,
        batchIntelligence,
        studentRisk: {
          totalAtRisk: riskStudents.length,
          students: riskStudents,
        },
        examAnalytics,
        leadCRM,
        directorInsights: insights,
      },
    });
  } catch (error) {
    console.error("Director Dashboard Error:", error);

    if (error.message === "Unauthorized" || error.message === "Forbidden: Invalid Role") {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const GET = withPerf("dashboard/director", handler);
