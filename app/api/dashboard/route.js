import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser } from "@/lib/auth";
import Student from "@/models/Student";
import Teacher from "@/models/Teacher";
import Section from "@/models/Section";
import Fee from "@/models/Fee";
import Attendance from "@/models/Attendance";
import Class from "@/models/Class";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbConnect();
    const authUser = await getAuthUser();
    const iid = authUser.institute_id;

    if (authUser.role === "ADMIN") {
      // IST midnight for today's attendance lookup
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const todayUTC = new Date(now.getTime() + istOffset);
      todayUTC.setUTCHours(0, 0, 0, 0);

      // Run all aggregations in parallel — no in-memory reduce on whole collection
      const [
        totalStudents,
        feeAgg,
        attendanceAgg,
      ] = await Promise.all([
        Student.countDocuments({ institute_id: iid }),

        // Single aggregation for all fee metrics
        Fee.aggregate([
          { $match: { institute_id: iid } },
          {
            $group: {
              _id: null,
              totalFees: { $sum: "$total_amount" },
              collectedFees: { $sum: "$paid_amount" },
              pendingFees: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ["$status", "PAID"] },
                        { $lte: ["$due_date", now] },
                      ],
                    },
                    "$due_amount",
                    0,
                  ],
                },
              },
            },
          },
        ]),

        // Single aggregation for today's attendance — count present/absent
        Attendance.aggregate([
          { $match: { institute_id: iid, date: todayUTC } },
          {
            $group: {
              _id: "$student_id",
              // take latest record if duplicates exist
              status: { $last: "$status" },
            },
          },
          {
            $group: {
              _id: null,
              presentToday: {
                $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] },
              },
              absentToday: {
                $sum: { $cond: [{ $eq: ["$status", "ABSENT"] }, 1, 0] },
              },
            },
          },
        ]),
      ]);

      const fees = feeAgg[0] || { totalFees: 0, collectedFees: 0, pendingFees: 0 };
      const att = attendanceAgg[0] || { presentToday: 0, absentToday: 0 };

      return NextResponse.json({
        totalStudents,
        totalFees: fees.totalFees,
        collectedFees: fees.collectedFees,
        pendingFees: fees.pendingFees,
        presentToday: att.presentToday,
        absentToday: att.absentToday,
        role: "ADMIN",
      });
    }

    if (authUser.role === "TEACHER") {
      const teacher = await Teacher.findOne(
        { user_id: authUser._id },
        { _id: 1, subjects: 1 }
      ).lean();
      if (!teacher)
        return NextResponse.json({ sectionsCount: 0, studentCount: 0, subjectsCount: 0, role: "TEACHER" });

      const { default: TimetableEntry } = await import("@/models/TimetableEntry");
      const { default: Subject } = await import("@/models/Subject");
      const { default: Test } = await import("@/models/Test");
      const { default: Result } = await import("@/models/Result");

      const timetables = await TimetableEntry.find({ teacher_id: teacher._id }, { section_id: 1 }).lean();
      const sectionIds = [...new Set(timetables.map(t => t.section_id?.toString() || ""))].filter(Boolean);
      const sectionOIds = sectionIds.map(s => new mongoose.Types.ObjectId(s));

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [studentCount, subjects, sections, attStats, testsPending, batchPerf, studentList] = await Promise.all([
        Student.countDocuments({ section_id: { $in: sectionIds } }),
        Subject.find({ _id: { $in: teacher.subjects } }, { name: 1 }).lean(),
        Section.find({ _id: { $in: sectionIds } }).populate("class_id", "name").lean(),
        // attendance stats for teacher's students
        Attendance.aggregate([
          { $match: { section_id: { $in: sectionOIds }, date: { $gte: thirtyDaysAgo }, status: { $ne: "NOT_MARKED" } } },
          { $group: { _id: "$student_id", total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } } } },
          { $project: { pct: { $cond: [{ $gt: ["$total", 0] }, { $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 0] } } },
        ]),
        // tests pending evaluation (tests in teacher's sections without results)
        Test.countDocuments({
          section_id: { $in: sectionIds },
          institute_id: iid,
        }),
        // batch performance per section
        Result.aggregate([
          { $lookup: { from: "tests", localField: "test_id", foreignField: "_id", as: "test" } },
          { $unwind: "$test" },
          { $match: { "test.section_id": { $in: sectionOIds } } },
          { $project: { section_id: "$test.section_id", earned: { $sum: "$subject_marks.marks" }, total: { $sum: "$test.subjects.max_marks" } } },
          { $group: { _id: "$section_id", avgPct: { $avg: { $cond: [{ $gt: ["$total", 0] }, { $multiply: [{ $divide: ["$earned", "$total"] }, 100] }, 0] } } } },
        ]),
        // students in teacher's sections for the student list
        Student.find({ section_id: { $in: sectionIds } })
          .populate("user_id", "name phoneOrEmail")
          .populate({ path: "section_id", select: "name class_id", populate: { path: "class_id", select: "name" } })
          .lean(),
      ]);

      // Count students below 75% attendance
      const lowAttCount = attStats.filter(a => a.pct < 75).length;

      // Build batch performance map
      const batchPerfMap = {};
      batchPerf.forEach(b => { batchPerfMap[b._id.toString()] = Math.round(b.avgPct); });

      const sectionData = sections.map(s => ({
        _id: s._id,
        name: s.name,
        className: s.class_id?.name || "",
        studentCount: studentList.filter(st => st.section_id?._id?.toString() === s._id.toString()).length,
        avgPerformance: batchPerfMap[s._id.toString()] || null,
      }));

      // Per-student performance for the student list
      const studentIds = studentList.map(s => s._id);
      const [studentPerf, studentAtt] = await Promise.all([
        Result.aggregate([
          { $match: { student_id: { $in: studentIds } } },
          { $lookup: { from: "tests", localField: "test_id", foreignField: "_id", as: "test" } },
          { $unwind: "$test" },
          { $project: { student_id: 1, earned: { $sum: "$subject_marks.marks" }, total: { $sum: "$test.subjects.max_marks" } } },
          { $group: { _id: "$student_id", avgPct: { $avg: { $cond: [{ $gt: ["$total", 0] }, { $multiply: [{ $divide: ["$earned", "$total"] }, 100] }, 0] } } } },
        ]),
        Attendance.aggregate([
          { $match: { student_id: { $in: studentIds }, date: { $gte: thirtyDaysAgo }, status: { $ne: "NOT_MARKED" } } },
          { $group: { _id: "$student_id", total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } } } },
          { $project: { pct: { $cond: [{ $gt: ["$total", 0] }, { $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 0] } } },
        ]),
      ]);

      const perfMap = Object.fromEntries(studentPerf.map(p => [p._id.toString(), Math.round(p.avgPct * 10) / 10]));
      const attMap = Object.fromEntries(studentAtt.map(a => [a._id.toString(), Math.round(a.pct * 10) / 10]));

      const students = studentList.map(s => ({
        _id: s._id,
        name: s.user_id?.name || "—",
        phone: s.user_id?.phoneOrEmail || "—",
        sectionName: s.section_id?.name || "—",
        className: s.section_id?.class_id?.name || "—",
        avgScore: perfMap[s._id.toString()] ?? null,
        attendancePct: attMap[s._id.toString()] ?? null,
      }));

      return NextResponse.json({
        sectionsCount: sectionIds.length,
        studentCount,
        subjectsCount: teacher.subjects?.length || 0,
        subjectNames: subjects.map(s => s.name).join(", ") || "None",
        lowAttendanceCount: lowAttCount,
        testsCount: testsPending,
        sections: sectionData,
        students,
        role: "TEACHER",
      });
    }

    if (authUser.role === "STUDENT") {
      const { default: Test } = await import("@/models/Test");
      const { default: Result } = await import("@/models/Result");

      const student = await Student.findOne(
        { user_id: authUser._id }
      )
        .populate({
          path: "section_id",
          select: "name class_id",
          populate: { path: "class_id", select: "name" },
        })
        .lean();

      if (!student)
        return NextResponse.json({
          pendingFees: 0,
          presentCount: 0,
          totalAttendanceDays: 0,
          role: "STUDENT",
          className: "Unassigned",
          sectionName: "Unassigned",
        });

      const [feeAgg, attAgg, results, allSectionResults, upcomingTests] = await Promise.all([
        Fee.aggregate([
          { $match: { student_id: student._id } },
          { $group: { _id: null, pending: { $sum: "$due_amount" } } },
        ]),
        Attendance.aggregate([
          { $match: { student_id: student._id } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              present: {
                $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] },
              },
            },
          },
        ]),
        // Student's test results with subject breakdown
        Result.find({ student_id: student._id })
          .populate({ path: "test_id", select: "name date subjects section_id" })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
        // All results in student's section for ranking
        Result.aggregate([
          { $lookup: { from: "tests", localField: "test_id", foreignField: "_id", as: "test" } },
          { $unwind: "$test" },
          { $match: { "test.section_id": student.section_id?._id } },
          { $project: { student_id: 1, earned: { $sum: "$subject_marks.marks" }, total: { $sum: "$test.subjects.max_marks" } } },
          { $group: { _id: "$student_id", avgPct: { $avg: { $cond: [{ $gt: ["$total", 0] }, { $multiply: [{ $divide: ["$earned", "$total"] }, 100] }, 0] } } } },
          { $sort: { avgPct: -1 } },
        ]),
        // Upcoming tests
        Test.find({ section_id: student.section_id?._id, date: { $gte: new Date() } })
          .sort({ date: 1 }).limit(5).lean(),
      ]);

      // Compute average marks
      const testResults = results.filter(r => r.test_id).map(r => {
        const test = r.test_id;
        const earned = (r.subject_marks || []).reduce((s, sm) => s + sm.marks, 0);
        const max = (test?.subjects || []).reduce((s, sub) => s + sub.max_marks, 0);
        return { earned, max, pct: max > 0 ? Math.round((earned / max) * 1000) / 10 : 0, subjects: r.subject_marks || [] };
      });

      const avgMarks = testResults.length
        ? Math.round(testResults.reduce((s, r) => s + r.pct, 0) / testResults.length * 10) / 10
        : null;

      // Rank in section
      const rankList = allSectionResults.map(r => r._id.toString());
      const rank = rankList.indexOf(student._id.toString()) + 1;
      const totalInSection = rankList.length;

      // Subject-wise performance (weak & strong topics)
      const subjectPerf = {};
      for (const r of results) {
        if (!r.test_id) continue;
        for (const sm of (r.subject_marks || [])) {
          const subInfo = (r.test_id.subjects || []).find(s => s.name === sm.subject);
          if (!subInfo) continue;
          if (!subjectPerf[sm.subject]) subjectPerf[sm.subject] = { earned: 0, max: 0, count: 0 };
          subjectPerf[sm.subject].earned += sm.marks;
          subjectPerf[sm.subject].max += subInfo.max_marks;
          subjectPerf[sm.subject].count++;
        }
      }
      const subjectList = Object.entries(subjectPerf)
        .map(([name, d]) => ({ name, avgPct: d.max > 0 ? Math.round((d.earned / d.max) * 1000) / 10 : 0, tests: d.count }))
        .sort((a, b) => b.avgPct - a.avgPct);

      const strongTopics = subjectList.filter(s => s.avgPct >= 70).slice(0, 5);
      const weakTopics = subjectList.filter(s => s.avgPct < 70).sort((a, b) => a.avgPct - b.avgPct).slice(0, 5);

      return NextResponse.json({
        pendingFees: feeAgg[0]?.pending || 0,
        presentCount: attAgg[0]?.present || 0,
        totalAttendanceDays: attAgg[0]?.total || 0,
        attendancePct: attAgg[0]?.total > 0 ? Math.round((attAgg[0].present / attAgg[0].total) * 1000) / 10 : null,
        avgMarks,
        rank: rank || null,
        totalInSection,
        strongTopics,
        weakTopics,
        upcomingTests: upcomingTests.map(t => ({
          _id: t._id,
          name: t.name,
          date: t.date,
          subjectCount: t.subjects?.length || 0,
        })),
        role: "STUDENT",
        className: student.section_id?.class_id?.name || "Unassigned",
        sectionName: student.section_id?.name || "Unassigned",
      });
    }

    return NextResponse.json({ role: "UNKNOWN" });
  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
