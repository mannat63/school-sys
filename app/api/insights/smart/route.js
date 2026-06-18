/**
 * GET /api/insights/smart
 * Step 1: Rule-based insights from DB — no AI tokens used
 * Step 2: If ?ai=true, generate 3 strategic recommendations via AI (minimal tokens)
 */
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import Student from "@/models/Student";
import Fee from "@/models/Fee";
import Attendance from "@/models/Attendance";
import Lead from "@/models/Lead";
import Section from "@/models/Section";
import Result from "@/models/Result";
import Teacher from "@/models/Teacher";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const iid  = authUser.institute_id;
    const oid  = new mongoose.Types.ObjectId(iid);
    const { searchParams } = new URL(req.url);
    const wantAI = searchParams.get("ai") === "true";

    const now          = new Date();
    const thirtyDays   = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── Parallel DB queries ───────────────────────────────────────────────────
    const [
      totalStudents,
      feeSummary,
      overdueFees,
      lowAttendance,
      sectionCounts,
      leadThisMonth,
      leadLastMonth,
      lowPerfStudents,
      teacherCount,
    ] = await Promise.all([
      Student.countDocuments({ institute_id: iid }),

      Fee.aggregate([
        { $match: { institute_id: oid } },
        { $group: { _id: null, total: { $sum: "$total_amount" }, collected: { $sum: "$paid_amount" }, due: { $sum: "$due_amount" } } },
      ]),

      // Fees overdue > 30 days
      Fee.aggregate([
        { $match: { institute_id: oid, due_amount: { $gt: 0 }, due_date: { $lt: thirtyDays } } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$due_amount" } } },
      ]),

      // Students with <75% attendance last 30 days
      Attendance.aggregate([
        { $match: { institute_id: oid, date: { $gte: thirtyDays }, status: { $ne: "NOT_MARKED" } } },
        { $group: { _id: "$student_id", total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } } } },
        { $project: { pct: { $cond: [{ $gt: ["$total", 0] }, { $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 0] } } },
        { $match: { pct: { $lt: 75 } } },
        { $count: "count" },
      ]),

      // Section occupancy
      Section.aggregate([
        { $match: { institute_id: oid } },
        { $lookup: { from: "students", localField: "_id", foreignField: "section_id", as: "students" } },
        { $project: { name: 1, class_id: 1, studentCount: { $size: "$students" } } },
      ]),

      Lead.aggregate([
        { $match: { institute_id: oid, createdAt: { $gte: thisMonthStart } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      Lead.aggregate([
        { $match: { institute_id: oid, createdAt: { $gte: prevMonthStart, $lt: thisMonthStart } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Students with avg score < 40%
      Result.aggregate([
        { $match: { institute_id: oid } },
        { $lookup: { from: "tests", localField: "test_id", foreignField: "_id", as: "test" } },
        { $unwind: "$test" },
        { $project: { student_id: 1, earned: { $sum: "$subject_marks.marks" }, total: { $sum: "$test.subjects.max_marks" } } },
        { $group: { _id: "$student_id", avgPct: { $avg: { $cond: [{ $gt: ["$total", 0] }, { $multiply: [{ $divide: ["$earned", "$total"] }, 100] }, 0] } } } },
        { $match: { avgPct: { $lt: 40 } } },
        { $count: "count" },
      ]),

      Teacher.countDocuments({ institute_id: iid }),
    ]);

    // ── Process ────────────────────────────────────────────────────────────────
    const fees        = feeSummary[0] || { total: 0, collected: 0, due: 0 };
    const overdue     = overdueFees[0] || { count: 0, total: 0 };
    const lowAtt      = lowAttendance[0]?.count || 0;
    const lowPerf     = lowPerfStudents[0]?.count || 0;
    const feeRecovery = fees.total > 0 ? Math.round((fees.collected / fees.total) * 100) : 0;

    // Lead conversion helpers
    const convCount = (arr) => arr.find(l => l._id === "CONVERTED")?.count || 0;
    const totalLeads = (arr) => arr.reduce((s, l) => s + l.count, 0);
    const thisConv = convCount(leadThisMonth);
    const thisTotal = totalLeads(leadThisMonth);
    const lastConv = convCount(leadLastMonth);
    const lastTotal = totalLeads(leadLastMonth);
    const thisConvRate = thisTotal > 0 ? Math.round((thisConv / thisTotal) * 100) : 0;
    const lastConvRate = lastTotal > 0 ? Math.round((lastConv / lastTotal) * 100) : 0;
    const convDrop = lastConvRate - thisConvRate;

    // Section occupancy (flag < 50%)
    const lowOccupancy = sectionCounts.filter(s => s.studentCount < 15).map(s => ({ name: s.name, count: s.studentCount }));

    // ── Build insights ─────────────────────────────────────────────────────────
    const insights = [];

    // ADMISSIONS
    if (thisTotal > 0) {
      insights.push({
        category: "Admissions",
        type: thisConv >= lastConv ? "positive" : "warning",
        title: thisConv >= lastConv
          ? `${thisConv} new admissions this month`
          : `Admissions down — only ${thisConv} this month vs ${lastConv} last month`,
        detail: `${thisTotal} leads generated this month. Conversion rate: ${thisConvRate}%.`,
        metric: `${thisConvRate}%`,
        metricLabel: "Conversion",
      });
    }

    // REVENUE
    insights.push({
      category: "Revenue",
      type: feeRecovery >= 80 ? "positive" : feeRecovery >= 60 ? "warning" : "critical",
      title: feeRecovery >= 80
        ? `Strong fee recovery at ${feeRecovery}%`
        : `Fee recovery at only ${feeRecovery}% — action needed`,
      detail: `₹${fees.collected.toLocaleString()} collected of ₹${fees.total.toLocaleString()} total. ₹${fees.due.toLocaleString()} still outstanding.`,
      metric: `₹${(fees.collected / 100000).toFixed(1)}L`,
      metricLabel: "Collected",
    });

    // FEES OVERDUE
    if (overdue.count > 0) {
      insights.push({
        category: "Fees",
        type: overdue.count > 20 ? "critical" : "warning",
        title: `${overdue.count} student${overdue.count !== 1 ? "s" : ""} have fees overdue by 30+ days`,
        detail: `Potential recovery: ₹${overdue.total.toLocaleString()}. Consider sending reminder messages.`,
        metric: `₹${(overdue.total / 100000).toFixed(1)}L`,
        metricLabel: "Overdue",
        action: { label: "View overdue", href: "/students?risk=fees" },
      });
    }

    // ATTENDANCE
    if (lowAtt > 0) {
      insights.push({
        category: "Attendance",
        type: lowAtt > 15 ? "critical" : "warning",
        title: `${lowAtt} student${lowAtt !== 1 ? "s" : ""} below 75% attendance threshold`,
        detail: "These students are at risk of disqualification or poor performance.",
        metric: String(lowAtt),
        metricLabel: "At Risk",
        action: { label: "View list", href: "/students?risk=attendance" },
      });
    } else {
      insights.push({
        category: "Attendance",
        type: "positive",
        title: "All students above 75% attendance",
        detail: "Great work — no students are currently at attendance risk.",
        metric: "✓",
        metricLabel: "On Track",
      });
    }

    // PERFORMANCE
    if (lowPerf > 0) {
      insights.push({
        category: "Performance",
        type: lowPerf > 10 ? "critical" : "warning",
        title: `${lowPerf} student${lowPerf !== 1 ? "s" : ""} scoring below 40% average`,
        detail: "Intervention recommended — consider extra coaching or parent meetings.",
        metric: String(lowPerf),
        metricLabel: "Struggling",
        action: { label: "View list", href: "/students?risk=performance" },
      });
    }

    // LEAD CRM
    if (convDrop > 5) {
      insights.push({
        category: "Lead CRM",
        type: "warning",
        title: `Lead conversion dropped ${convDrop}% vs last month`,
        detail: `This month: ${thisConvRate}%, last month: ${lastConvRate}%. Review follow-up process.`,
        metric: `-${convDrop}%`,
        metricLabel: "Drop",
        action: { label: "Open CRM", href: "/leads" },
      });
    }

    // BATCH OCCUPANCY
    lowOccupancy.forEach(sec => {
      insights.push({
        category: "Admissions",
        type: "warning",
        title: `Section "${sec.name}" has only ${sec.count} students`,
        detail: "Consider targeted outreach to fill this batch.",
        metric: String(sec.count),
        metricLabel: "Enrolled",
      });
    });

    // ── Step 2: AI strategic recommendations (only when requested) ────────────
    let aiRecs = null;
    if (wantAI) {
      try {
        const Groq = (await import("groq-sdk")).default;
        const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const context   = {
          revenue:         `₹${(fees.collected/100000).toFixed(1)}L collected, recovery ${feeRecovery}%`,
          occupancy:       `${totalStudents} students enrolled`,
          leadConversion:  `${thisConvRate}% this month (${convDrop > 0 ? `-${convDrop}%` : "stable"})`,
          feeRecovery:     `${feeRecovery}% (₹${(overdue.total/100000).toFixed(1)}L overdue >30d)`,
          topRisks:        [
            lowAtt > 0 && `${lowAtt} students low attendance`,
            lowPerf > 0 && `${lowPerf} students low performance`,
            overdue.count > 0 && `${overdue.count} overdue fee accounts`,
          ].filter(Boolean),
        };

        const msg = await client.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          max_tokens: 300,
          messages: [{
            role: "user",
            content: `You are a strategic advisor for a coaching institute director. Based on the following data, provide exactly 3 highly actionable and specific recommendations (1 sentence each, numbered 1-3). Focus on immediate operational actions (e.g. "Run a 5% discount campaign for the ₹24L outstanding fees", "Mandate parent-teacher meetings for the 85 low-attendance students"). DO NOT give generic advice like "improve programs". Be precise and act like a CEO.\n\nMetrics: ${JSON.stringify(context)}`,
          }],
        });

        const text = msg.choices[0]?.message?.content || "";
        aiRecs = text.split(/\n/).filter(l => l.trim() && /^\d/.test(l.trim())).slice(0, 3).map(l => l.replace(/^\d+[\.\)]\s*/, "").trim());
        if (!aiRecs.length) aiRecs = [text.trim()];
      } catch (aiErr) {
        console.warn("AI insights unavailable:", aiErr.message);
        aiRecs = null;
      }
    }

    // ── Summary metrics ────────────────────────────────────────────────────────
    const summary = {
      totalStudents,
      totalTeachers: teacherCount,
      feeRecovery,
      feesCollected: fees.collected,
      feesTotal: fees.total,
      feesDue: fees.due,
      overdueCount: overdue.count,
      overdueAmount: overdue.total,
      lowAttendanceCount: lowAtt,
      lowPerfCount: lowPerf,
      leadConversionRate: thisConvRate,
      leadConversionDrop: convDrop,
    };

    return NextResponse.json({ insights, summary, aiRecs });
  } catch (error) {
    console.error("Smart insights error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
