import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import Payment from "@/models/Payment";
import Attendance from "@/models/Attendance";
import Fee from "@/models/Fee";
import Test from "@/models/Test";
import Result from "@/models/Result";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const iid = authUser.institute_id;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [paymentAgg, attendanceAgg, feeAgg, testPerfAgg, testTrendAgg] = await Promise.all([

      // 1. Revenue per day (last 30 days)
      Payment.aggregate([
        { $match: { institute_id: iid, createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            amount: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // 2. Attendance % per day
      Attendance.aggregate([
        { $match: { institute_id: iid, date: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } },
          },
        },
        {
          $project: {
            presentPct: {
              $cond: [
                { $gt: ["$total", 0] },
                { $round: [{ $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 0] },
                0,
              ],
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // 3. Fee totals
      Fee.aggregate([
        { $match: { institute_id: iid } },
        {
          $group: {
            _id: null,
            collected: { $sum: "$paid_amount" },
            pending: {
              $sum: {
                $cond: [{ $lt: ["$due_date", todayStart] }, "$due_amount", 0],
              },
            },
          },
        },
      ]),

      // 4. Academic performance grouped by CLASS + SECTION
      //    - aggregates avg score across ALL tests per section
      //    - sorts by class number ASC, section name ASC
      Test.aggregate([
        { $match: { institute_id: iid } },
        // Join results for each test
        {
          $lookup: {
            from: "results",
            localField: "_id",
            foreignField: "test_id",
            as: "results",
          },
        },
        // Compute per-test total marks earned and total marks possible
        {
          $project: {
            section_id: 1,
            resultCount: { $size: "$results" },
            maxPossible: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ["$subjects", []] } }, 0] },
                { $sum: "$subjects.max_marks" },
                { $ifNull: ["$total_marks", 100] },
              ],
            },
            sumMarks: {
              $sum: {
                $map: {
                  input: "$results",
                  as: "r",
                  in: {
                    $cond: [
                      { $gt: [{ $ifNull: ["$$r.marks", 0] }, 0] },
                      "$$r.marks",
                      {
                        $reduce: {
                          input: { $ifNull: ["$$r.subject_marks", []] },
                          initialValue: 0,
                          in: { $add: ["$$value", { $ifNull: ["$$this.marks", 0] }] },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        // Only include tests that have results
        { $match: { resultCount: { $gt: 0 } } },
        // Group by section — sum marks + possible across all tests in that section
        {
          $group: {
            _id: "$section_id",
            totalSum: { $sum: "$sumMarks" },
            totalPossible: { $sum: { $multiply: ["$resultCount", "$maxPossible"] } },
          },
        },
        { $match: { totalPossible: { $gt: 0 } } },
        // Join section details
        {
          $lookup: {
            from: "sections",
            localField: "_id",
            foreignField: "_id",
            as: "section",
          },
        },
        { $unwind: "$section" },
        // Join class details
        {
          $lookup: {
            from: "classes",
            localField: "section.class_id",
            foreignField: "_id",
            as: "class",
          },
        },
        { $unwind: "$class" },
        // Build final fields including sortable class number
        {
          $addFields: {
            avgScore: {
              $round: [
                { $multiply: [{ $divide: ["$totalSum", "$totalPossible"] }, 100] },
                0,
              ],
            },
            classNum: {
              $convert: {
                input: {
                  $reduce: {
                    input: {
                      $regexFindAll: { input: "$class.name", regex: "\\d+" },
                    },
                    initialValue: "0",
                    in: "$$this.match",
                  },
                },
                to: "int",
                onError: 0,
                onNull: 0,
              },
            },
          },
        },
        // Sort: class number ASC, then section name ASC
        { $sort: { classNum: 1, "section.name": 1 } },
        {
          $project: {
            _id: 0,
            name: {
              $concat: ["$class.name", " - Sec ", "$section.name"],
            },
            avgScore: 1,
            classNum: 1,
          },
        },
      ]),
      
      // 5. Test trend overtime (grouped by date and section)
      Test.aggregate([
        { $match: { institute_id: iid } },
        {
          $lookup: {
            from: "results",
            localField: "_id",
            foreignField: "test_id",
            as: "results",
          },
        },
        {
          $project: {
            date: 1,
            section_id: 1,
            name: 1,
            resultCount: { $size: "$results" },
            maxPossible: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ["$subjects", []] } }, 0] },
                { $sum: "$subjects.max_marks" },
                { $ifNull: ["$total_marks", 100] },
              ],
            },
            sumMarks: {
              $sum: {
                $map: {
                  input: "$results",
                  as: "r",
                  in: {
                    $cond: [
                      { $gt: [{ $ifNull: ["$$r.marks", 0] }, 0] },
                      "$$r.marks",
                      {
                        $reduce: {
                          input: { $ifNull: ["$$r.subject_marks", []] },
                          initialValue: 0,
                          in: { $add: ["$$value", { $ifNull: ["$$this.marks", 0] }] },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        { $match: { resultCount: { $gt: 0 }, maxPossible: { $gt: 0 } } },
        {
          $addFields: {
            avgScore: {
              $round: [
                { $multiply: [{ $divide: ["$sumMarks", { $multiply: ["$resultCount", "$maxPossible"] }] }, 100] },
                0
              ]
            }
          }
        },
        {
          $lookup: {
            from: "sections",
            localField: "section_id",
            foreignField: "_id",
            as: "section",
          },
        },
        { $unwind: "$section" },
        {
          $lookup: {
            from: "classes",
            localField: "section.class_id",
            foreignField: "_id",
            as: "class",
          },
        },
        { $unwind: "$class" },
        { $sort: { date: 1 } },
        {
          $project: {
            _id: 0,
            date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            testName: "$name",
            sectionName: { $concat: ["$class.name", " - Sec ", "$section.name"] },
            className: "$class.name",
            avgScore: 1
          }
        }
      ]),
    ]);

    // ── Revenue map ──
    const revMap = {};
    for (let i = 0; i <= 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      revMap[d.toISOString().split("T")[0]] = 0;
    }
    paymentAgg.forEach((p) => {
      if (revMap[p._id] !== undefined) revMap[p._id] = p.amount;
    });
    const revenueData = Object.keys(revMap)
      .sort()
      .map((d) => ({
        date: new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        amount: revMap[d],
      }));

    // ── Attendance trend ──
    const attendanceData = attendanceAgg.map((a) => ({
      date: new Date(a._id).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      presentPct: a.presentPct,
    }));

    // ── Fee status ──
    const fees = feeAgg[0] || { collected: 0, pending: 0 };
    const feeData = [
      { name: "Collected", value: fees.collected, fill: "#10b981" },
      { name: "Pending", value: fees.pending, fill: "#f43f5e" },
    ];

    // ── Test performance by section ──
    const testData = testPerfAgg.map((t) => ({ name: t.name, avgScore: t.avgScore }));

    const testTimeline = testTrendAgg.map(t => ({
      ...t,
      dateFormatted: new Date(t.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    }));

    return NextResponse.json({
      revenue: revenueData,
      attendance: attendanceData,
      feesObj: feeData,
      tests: testData,
      testTimeline: testTimeline
    });
  } catch (error) {
    console.error("Graphs API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
