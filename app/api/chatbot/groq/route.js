import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import mongoose from "mongoose";
import Groq from "groq-sdk";

import Payment from "@/models/Payment";
import Student from "@/models/Student";
import Section from "@/models/Section";
import Fee from "@/models/Fee";
import Attendance from "@/models/Attendance";
import Result from "@/models/Result";
import Test from "@/models/Test";
import User from "@/models/User";
import Teacher from "@/models/Teacher";
import Course from "@/models/Course";
import Institute from "@/models/Institute";
export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);

    const body = await req.json();
    const { message, history } = body;

    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.trim() === "") {
      return NextResponse.json({ 
        answer: "⚠️ **Groq API Key Missing!** Please paste your `GROQ_API_KEY` into the `.env.local` file and completely restart the Next.js server to activate the AI Chatbot." 
      });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const instId = new mongoose.Types.ObjectId(authUser.institute_id);

    // ═══════════════════════════════════════════════════════════════════
    // COMPREHENSIVE RAG: Full Database Retrieval
    // ═══════════════════════════════════════════════════════════════════
    
    // 1. ALL Students with their details
    const allStudents = await Student.find({ institute_id: instId })
      .populate("user_id", "name phoneOrEmail")
      .populate("section_id", "name")
      .lean();

    // 2. ALL Fees with student linkage
    const allFees = await Fee.find({ institute_id: instId })
      .populate({ path: "student_id", populate: { path: "user_id", select: "name" } })
      .lean();

    // Group ALL fees by student_id for accurate multi-record aggregation
    const now = new Date();
    const feesByStudent = {};
    for (const f of allFees) {
      const sid = f.student_id?._id?.toString() || f.student_id?.toString();
      if (!sid) continue;
      if (!feesByStudent[sid]) feesByStudent[sid] = [];
      feesByStudent[sid].push(f);
    }

    const studentsFull = allStudents.map(s => {
      const studentFees = feesByStudent[s._id.toString()] || [];

      // Tally across ALL fee records for this student
      let totalPaid = 0, totalDue = 0, totalFee = 0;
      let overdueCount = 0, overdueAmount = 0;
      let upcomingCount = 0;
      let worstStatus = "NO_RECORD";

      for (const f of studentFees) {
        totalPaid += f.paid_amount || 0;
        totalDue  += f.due_amount  || 0;
        totalFee  += f.total_amount || 0;

        if (f.status === "PAID") continue; // skip settled
        const diffDays = Math.round((new Date(f.due_date) - now) / 86400000);
        if (diffDays < 0) {
          overdueCount++;
          overdueAmount += f.due_amount || 0;
          worstStatus = "OVERDUE";
        } else if (diffDays <= 5) {
          upcomingCount++;
          if (worstStatus !== "OVERDUE") worstStatus = "UPCOMING";
        } else {
          if (worstStatus === "NO_RECORD") worstStatus = "CLEAR";
        }
      }

      if (studentFees.length > 0 && worstStatus === "NO_RECORD") worstStatus = "PAID";

      return {
        name: s.user_id?.name || "Unknown",
        contact: s.user_id?.phoneOrEmail || "",
        section: s.section_id?.name || "Unassigned",
        parent_name: s.parent_name || "",
        parent_phone: s.parent_phone || "",
        admission_date: s.admission_date ? new Date(s.admission_date).toLocaleDateString("en-CA") : "",
        fee_total: totalFee,
        fee_paid: totalPaid,
        fee_due: totalDue,           // total unpaid across ALL records
        fee_outstanding: overdueAmount, // only actually OVERDUE amount
        fee_status: worstStatus,
        overdue_count: overdueCount,
        upcoming_count: upcomingCount,
        total_records: studentFees.length,
      };
    });

    // 3. Sections with student counts
    const allSections = await Section.find({ institute_id: instId })
      .populate("teacher_id", "user_id")
      .lean();
    
    const sectionSummary = allSections.map(b => {
      const studentsInSection = studentsFull.filter(s => s.section === b.name);
      return {
        name: b.name,
        timing: b.timing || "",
        student_count: studentsInSection.length,
        total_fees_due: studentsInSection.reduce((sum, s) => sum + s.fee_due, 0),
        total_fees_collected: studentsInSection.reduce((sum, s) => sum + s.fee_paid, 0)
      };
    });

    // 4. Courses
    const allCourses = await Course.find({ institute_id: instId }).lean();
    const courseList = allCourses.map(c => ({
      name: c.name,
      description: c.description || "",
      base_fee: c.base_fee || 0
    }));

    // 5. Revenue
    const totalRevenue = allFees.reduce((sum, f) => sum + (f.paid_amount || 0), 0);

    // 6. Attendance per section
    const attendanceAgg = await Attendance.aggregate([
      { $match: { institute_id: instId } },
      { $group: { _id: { section_id: "$section_id", status: "$status" }, count: { $sum: 1 } } }
    ]);
    const attendanceLookup = {};
    for (const a of attendanceAgg) {
      const sectionId = a._id.section_id?.toString();
      if (!attendanceLookup[sectionId]) attendanceLookup[sectionId] = { present: 0, absent: 0 };
      if (a._id.status === "PRESENT") attendanceLookup[sectionId].present += a.count;
      if (a._id.status === "ABSENT") attendanceLookup[sectionId].absent += a.count;
    }
    for (const b of sectionSummary) {
      const bDoc = allSections.find(x => x.name === b.name);
      if (bDoc) {
        const att = attendanceLookup[bDoc._id.toString()];
        b.total_present = att?.present || 0;
        b.total_absent = att?.absent || 0;
      }
    }

    // 7. TODAY's attendance — per student
    // Align TODAY to IST
    const istOffset = 5.5 * 60 * 60 * 1000;
    const todayUTC = new Date(now.getTime() + istOffset);
    todayUTC.setUTCHours(0, 0, 0, 0);

    const todayAttendance = await Attendance.find({
      institute_id: instId,
      date: todayUTC
    }).populate({
        path: "student_id",
        select: "user_id section_id",
        populate: [
          { path: "user_id", select: "name" },
          { path: "section_id", select: "name" }
        ]
      })
      .lean();

    const todayAbsent = todayAttendance
      .filter(a => a.status === "ABSENT" && a.student_id != null)
      .map(a => ({
        name: a.student_id?.user_id?.name || "Unknown",
        section: a.student_id?.section_id?.name || "Unknown"
      }));

    const todayPresent = todayAttendance
      .filter(a => a.status === "PRESENT" && a.student_id != null)
      .map(a => ({
        name: a.student_id?.user_id?.name || "Unknown",
        section: a.student_id?.section_id?.name || "Unknown"
      }));

    // 8. Recent test results — single aggregation with $lookup (eliminates N+1)
    const recentTestDetails = await Test.aggregate([
      { $match: { institute_id: instId } },
      { $sort: { date: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "results",
          localField: "_id",
          foreignField: "test_id",
          as: "results",
        },
      },
      {
        $lookup: {
          from: "sections",
          localField: "section_id",
          foreignField: "_id",
          as: "sectionInfo",
        },
      },
      { $unwind: { path: "$sectionInfo", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "students",
          localField: "results.student_id",
          foreignField: "_id",
          as: "studentDocs",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "studentDocs.user_id",
          foreignField: "_id",
          as: "userDocs",
        },
      },
      { $sort: { date: 1 } },
    ]);

    // Map into the expected shape
    const formattedTests = recentTestDetails.map((t) => {
      const userMap = {};
      (t.userDocs || []).forEach((u) => { userMap[u._id.toString()] = u.name; });
      const studentMap = {};
      (t.studentDocs || []).forEach((s) => { studentMap[s._id.toString()] = s.user_id?.toString(); });

      return {
        test_name: t.name,
        section: t.sectionInfo?.name || "Unknown",
        date: new Date(t.date).toISOString().split("T")[0],
        total_marks: t.total_marks,
        scores: (t.results || []).map((r) => {
          const sId = r.student_id?.toString();
          const uId = studentMap[sId];
          return {
            student: (uId && userMap[uId]) || "Unknown",
            marks: r.marks,
            percentage: ((r.marks / t.total_marks) * 100).toFixed(1),
          };
        }),
      };
    });

    // 9. Summary stats
    const totalStudents = studentsFull.length;
    const overdueStudentCount = studentsFull.filter(s => s.fee_status === "OVERDUE").length;
    const upcomingStudentCount = studentsFull.filter(s => s.fee_status === "UPCOMING").length;
    const totalRevenuePaid = allFees.reduce((sum, f) => sum + (f.paid_amount || 0), 0);
    const totalOutstanding = studentsFull.reduce((sum, s) => sum + s.fee_outstanding, 0);
    const totalUnpaidAll = studentsFull.reduce((sum, s) => sum + s.fee_due, 0);

    // ═══════════════════════════════════════════════════════════════════
    // BUILD FULL CONTEXT FOR LLM
    // ═══════════════════════════════════════════════════════════════════

    const snapshot = {
      today: now.toLocaleDateString("en-CA", { timeZone: 'Asia/Kolkata' }),
      summary: {
        total_students: totalStudents,
        total_revenue_collected: totalRevenuePaid,
        overdue_students: overdueStudentCount,
        upcoming_students: upcomingStudentCount,
        total_outstanding_overdue_only: totalOutstanding,
        total_unpaid_all: totalUnpaidAll,
      },
      students: studentsFull,
      sections: sectionSummary,
      courses: courseList,
      todays_attendance: {
        total_present: todayPresent.length,
        total_absent: todayAbsent.length,
        absent_students: todayAbsent,
        present_students: todayPresent
      },
      recent_tests: formattedTests
    };

    const systemPrompt = `You are the Chief Strategy Officer and Data Analyst for a Coaching Institute. You have COMPLETE access to the institute's real-time database snapshot below.

FULL DATABASE SNAPSHOT:
${JSON.stringify(snapshot, null, 2)}

YOUR MISSION:
Provide deep, actionable intelligence. DO NOT just repeat the data back. Act like a strategic advisor.

RULES:
1. Highlight critical risks (e.g., high fee defaulters, low attendance) and propose concrete interventions.
2. Formulate aggressive fee recovery strategies based on the defaulters (OVERDUE students).
3. Evaluate section performance and suggest re-balancing or teacher attention shifts if needed.
4. Highlight top performers and propose reward mechanisms to boost engagement.
5. Answer user queries accurately using the data.
6. Use clear, professional formatting (headers, bold text, bullet points). Format currency as ₹XX,XXX.`;

    // Build conversation messages with history
    const chatMessages = [{ role: "system", content: systemPrompt }];

    // Add conversation history (last 10 exchanges for context window efficiency)
    if (Array.isArray(history)) {
      const recentHistory = history.slice(-10);
      for (const h of recentHistory) {
        chatMessages.push({ role: h.role, content: h.content });
      }
    }

    // Add the current user message
    chatMessages.push({ role: "user", content: message });

    const chatCompletion = await groq.chat.completions.create({
      messages: chatMessages,
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      max_tokens: 500
    });

    return NextResponse.json({ answer: chatCompletion.choices[0]?.message?.content || "No response generated by AI." });

  } catch (error) {
    console.error("Groq AI Error:", error);
    return NextResponse.json({ answer: "Oops! I encountered an error connecting to the AI models." }, { status: 500 });
  }
}
