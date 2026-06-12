import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser, requireRole } from "@/lib/auth";
import Student from "@/models/Student";
import Fee from "@/models/Fee";
import Attendance from "@/models/Attendance";
import Test from "@/models/Test";
import Result from "@/models/Result";
import Section from "@/models/Section";

export async function GET(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const instituteId = authUser.institute_id;

    // 1. Fee Alerts
    // Find all overdue/unpaid fees
    const pendingFees = await Fee.find({ 
      status: { $in: ["DUE", "PARTIAL", "UNPAID"] }, // Support various non-paid statuses
      institute_id: instituteId,
      due_amount: { $gt: 0 }
    }).populate({
      path: "student_id",
      select: "user_id parent_name",
      populate: {
        path: "user_id",
        select: "name"
      }
    }).lean();

    let totalPendingAmount = 0;
    const defaultersMap = {};

    pendingFees.forEach(fee => {
      totalPendingAmount += fee.due_amount;
      const sId = fee.student_id?._id?.toString();
      if (sId) {
        if (!defaultersMap[sId]) {
          // Attempt to find name safely
          // Search for Student User's name FIRST, then fallback to Parent.
          const name = fee.student_id?.user_id?.name || fee.student_id?.parent_name || "Unknown";
          defaultersMap[sId] = { name, amount: 0 };
        }
        defaultersMap[sId].amount += fee.due_amount;
      }
    });

    const defaultersList = Object.values(defaultersMap).sort((a, b) => b.amount - a.amount);
    const topDefaulter = defaultersList[0];

    const feeAlert = defaultersList.length > 0 ? {
      total_amount: totalPendingAmount,
      count: defaultersList.length,
      top_name: topDefaulter?.name,
      top_amount: topDefaulter?.amount
    } : null;


    // 2. Attendance Alerts (last 7 days < 50%)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const attendances = await Attendance.find({
      institute_id: instituteId,
      date: { $gte: sevenDaysAgo }
    }).lean();

    const attMap = {}; // { student_id: { present: X, total: Y } }
    attendances.forEach(a => {
      const sId = a.student_id?.toString();
      if (!sId) return;
      if (!attMap[sId]) attMap[sId] = { present: 0, total: 0 };
      attMap[sId].total += 1;
      if (a.status === "PRESENT") attMap[sId].present += 1;
    });

    let below50Count = 0;
    Object.values(attMap).forEach(stats => {
      if (stats.total > 0 && (stats.present / stats.total) < 0.5) {
        below50Count++;
      }
    });

    const attendanceAlert = below50Count > 0 ? { count: below50Count } : null;

    // 3. Test Performance Alerts
    // Compare last 2 tests per section
    const allTests = await Test.find({ institute_id: instituteId }).sort({ date: -1 }).lean();
    const testsBySection = {};
    allTests.forEach(t => {
      const bId = t.section_id?.toString();
      if (!bId) return;
      if (!testsBySection[bId]) testsBySection[bId] = [];
      testsBySection[bId].push(t);
    });

    const testDrops = [];
    const sections = await Section.find({ institute_id: instituteId }).lean();
    const sectionNameMap = {};
    sections.forEach(b => { sectionNameMap[b._id.toString()] = b.name; });

    for (const bId in testsBySection) {
      const sectionTests = testsBySection[bId];
      if (sectionTests.length >= 2) {
        const latestTest = sectionTests[0];
        const previousTest = sectionTests[1];

        const [latestResults, prevResults] = await Promise.all([
          Result.find({ test_id: latestTest._id }).lean(),
          Result.find({ test_id: previousTest._id }).lean()
        ]);

        const calcAvg = (results, totalMarks) => {
          if (!results.length || !totalMarks) return 0;
          const sum = results.reduce((acc, r) => acc + (r.marks || 0), 0);
          return (sum / (results.length * totalMarks)) * 100;
        };

        const latestAvg = calcAvg(latestResults, latestTest.total_marks);
        const prevAvg = calcAvg(prevResults, previousTest.total_marks);

        if (prevAvg > 0) {
          const drop = ((prevAvg - latestAvg) / prevAvg) * 100;
          if (drop > 15) { // Drop > 15%
            testDrops.push({
              section_name: sectionNameMap[bId] || "Unknown",
              drop_percentage: drop.toFixed(1)
            });
          }
        }
      }
    }

    const testAlert = testDrops.length > 0 ? testDrops : null;

    // 4. Top Performer of Each Section
    const topPerformers = [];
    for (const bId in testsBySection) {
      if (testsBySection[bId].length > 0) {
        const sectionResults = await Result.aggregate([
          { $match: { student_id: { $in: await Student.find({ section_id: bId }).distinct("_id") } } },
          { $lookup: { from: "tests", localField: "test_id", foreignField: "_id", as: "testInfo" } },
          { $unwind: "$testInfo" },
          { $project: { student_id: 1, percentage: { $multiply: [{ $divide: ["$marks", "$testInfo.total_marks"] }, 100] } } },
          { $group: { _id: "$student_id", avg: { $avg: "$percentage" } } },
          { $sort: { avg: -1 } },
          { $limit: 1 }
        ]);

        if (sectionResults.length > 0) {
          const topOne = await Student.findById(sectionResults[0]._id).populate("user_id", "name").lean();
          topPerformers.push({
            section_name: sectionNameMap[bId],
            student_name: topOne?.user_id?.name || "Unknown",
            score: sectionResults[0].avg.toFixed(1)
          });
        }
      }
    }

    return NextResponse.json({
      feeAlert,
      attendanceAlert,
      testAlert,
      topPerformers: topPerformers.length > 0 ? topPerformers : null
    });

  } catch (error) {
    console.error("Insights API Error:", error);
    return NextResponse.json({ error: "Failed to fetch insights" }, { status: 500 });
  }
}
