import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser, requireRole } from "@/lib/auth";
import Student from "@/models/Student";
import User from "@/models/User";
import Teacher from "@/models/Teacher";
import Fee from "@/models/Fee";
import Attendance from "@/models/Attendance";
import Result from "@/models/Result";
import mongoose from "mongoose";
import { logActivity } from "@/lib/logActivity";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();
    const authUser = await getAuthUser();

    const { searchParams } = new URL(req.url);
    const section_id = searchParams.get("section_id");
    const risk       = searchParams.get("risk");
    const search     = searchParams.get("search") || "";
    const page       = Math.max(1, parseInt(searchParams.get("page")  || "1"));
    const limit      = Math.min(200, parseInt(searchParams.get("limit") || "30"));
    const skip       = (page - 1) * limit;

    const query = { institute_id: authUser.institute_id };

    // ── Role-based filtering ──────────────────────────────────────────
    if (authUser.role === "TEACHER") {
      const teacher = await Teacher.findOne({ user_id: authUser._id }, { _id: 1 }).lean();
      if (!teacher) return NextResponse.json({ students: [], total: 0, page, pages: 0 });

      const { default: TimetableEntry } = await import("@/models/TimetableEntry");
      const timetables = await TimetableEntry.find({ teacher_id: teacher._id }, { section_id: 1 }).lean();
      const sectionIds = [...new Set(timetables.map(t => t.section_id?.toString()).filter(Boolean))];

      if (section_id && !sectionIds.includes(section_id))
        return NextResponse.json({ error: "Forbidden: Not your section" }, { status: 403 });

      query.section_id = section_id ? section_id : { $in: sectionIds };
    } else if (authUser.role === "STUDENT") {
      query.user_id = authUser._id;
    } else {
      if (section_id) query.section_id = section_id;
    }

    // ── Search: by student name ────────────────────────────────────────
    if (search) {
      const matchingUsers = await User.find(
        { name: { $regex: search, $options: "i" }, institute_id: authUser.institute_id },
        { _id: 1 }
      ).lean();
      const userIds = matchingUsers.map(u => u._id);
      query.user_id = query.user_id
        ? { $in: [query.user_id, ...userIds].filter(id => userIds.some(uid => uid.toString() === id.toString())) }
        : { $in: userIds };
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // ── Risk pre-filter ────────────────────────────────────────────────
    let riskMap = {};

    if (risk === "fees") {
      const fees = await Fee.find(
        { due_amount: { $gt: 0 }, due_date: { $lt: new Date() }, institute_id: authUser.institute_id },
        { student_id: 1, due_amount: 1 }
      ).lean();
      fees.forEach(f => { riskMap[f.student_id.toString()] = { label: "OVERDUE", value: `₹${f.due_amount.toLocaleString()}` }; });
      if (!Object.keys(riskMap).length) return NextResponse.json({ students: [], total: 0, page, pages: 0 });
      query._id = { $in: Object.keys(riskMap) };

    } else if (risk === "attendance") {
      const lowAtt = await Attendance.aggregate([
        { $match: { date: { $gte: thirtyDaysAgo }, institute_id: new mongoose.Types.ObjectId(authUser.institute_id) } },
        { $group: { _id: "$student_id", total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } } } },
        { $project: { pct: { $cond: [{ $gt: ["$total", 0] }, { $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 0] } } },
        { $match: { pct: { $lt: 50 } } },
      ]);
      lowAtt.forEach(a => { riskMap[a._id.toString()] = { label: "Attendance", value: `${a.pct.toFixed(1)}%` }; });
      if (!Object.keys(riskMap).length) return NextResponse.json({ students: [], total: 0, page, pages: 0 });
      query._id = { $in: Object.keys(riskMap) };

    } else if (risk === "performance") {
      const lowPerf = await Result.aggregate([
        { $match: { institute_id: new mongoose.Types.ObjectId(authUser.institute_id) } },
        { $lookup: { from: "tests", localField: "test_id", foreignField: "_id", as: "test" } },
        { $unwind: "$test" },
        {
          $project: {
            student_id: 1,
            earned: { $sum: "$subject_marks.marks" },
            total:  { $sum: "$test.subjects.max_marks" },
          },
        },
        {
          $group: {
            _id: "$student_id",
            avgPct: { $avg: { $cond: [{ $gt: ["$total", 0] }, { $multiply: [{ $divide: ["$earned", "$total"] }, 100] }, 0] } },
          },
        },
        { $match: { avgPct: { $lt: 50 } } },
      ]);
      lowPerf.forEach(r => { riskMap[r._id.toString()] = { label: "Avg Score", value: `${r.avgPct.toFixed(1)}%` }; });
      if (!Object.keys(riskMap).length) return NextResponse.json({ students: [], total: 0, page, pages: 0 });
      query._id = { $in: Object.keys(riskMap) };
    }

    // ── Count + paginated fetch ─────────────────────────────────────────
    const [total, students] = await Promise.all([
      Student.countDocuments(query),
      Student.find(query)
        .select("user_id section_id parent_name parent_phone admission_date institute_id")
        .populate("user_id", "name phoneOrEmail")
        .populate({ path: "section_id", select: "name class_id", populate: { path: "class_id", select: "name" } })
        .sort({ section_id: 1, "user_id.name": 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    if (!students.length) return NextResponse.json({ students: [], total, page, pages: Math.ceil(total / limit) });

    const studentIds = students.map(s => s._id);

    // ── Bulk enrichment ────────────────────────────────────────────────
    const [fees, attendanceStats, performanceStats] = await Promise.all([
      Fee.find({ student_id: { $in: studentIds } }, { student_id: 1, total_amount: 1, due_amount: 1, paid_amount: 1, status: 1 }).lean(),

      Attendance.aggregate([
        { $match: { student_id: { $in: studentIds }, date: { $gte: thirtyDaysAgo }, status: { $ne: "NOT_MARKED" } } },
        { $group: { _id: "$student_id", total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } } } },
        { $project: { pct: { $cond: [{ $gt: ["$total", 0] }, { $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 0] } } },
      ]),

      Result.aggregate([
        { $match: { student_id: { $in: studentIds } } },
        { $lookup: { from: "tests", localField: "test_id", foreignField: "_id", as: "test" } },
        { $unwind: "$test" },
        {
          $project: {
            student_id: 1,
            earned: { $sum: "$subject_marks.marks" },
            total:  { $sum: "$test.subjects.max_marks" },
          },
        },
        {
          $group: {
            _id: "$student_id",
            avgPct: { $avg: { $cond: [{ $gt: ["$total", 0] }, { $multiply: [{ $divide: ["$earned", "$total"] }, 100] }, 0] } },
          },
        },
      ]),
    ]);

    const feeMap  = Object.fromEntries(fees.map(f => [f.student_id.toString(), f]));
    const attMap  = Object.fromEntries(attendanceStats.map(a => [a._id.toString(), a.pct]));
    const perfMap = Object.fromEntries(performanceStats.map(p => [p._id.toString(), p.avgPct]));

    const enriched = students.map(s => ({
      ...s,
      total_fee:             feeMap[s._id.toString()]?.total_amount  ?? 0,
      paid_fee:              feeMap[s._id.toString()]?.paid_amount   ?? 0,
      due_fee:               feeMap[s._id.toString()]?.due_amount    ?? 0,
      fee_status:            feeMap[s._id.toString()]?.status        ?? "UNKNOWN",
      risk_info:             riskMap[s._id.toString()]               ?? null,
      attendance_percentage: attMap[s._id.toString()]                ?? null,
      performance_avg:       perfMap[s._id.toString()]               ?? null,
    }));

    return NextResponse.json({ students: enriched, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Students GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);

    const { name, phoneOrEmail, section_id, parent_name, parent_phone, admission_date, total_fee, due_date } = await req.json();

    const trimmed = phoneOrEmail.trim();
    let user = await User.findOne({ phoneOrEmail: new RegExp(`^${trimmed}$`, "i") });
    if (!user) {
      user = await User.create({ name, phoneOrEmail: trimmed, role: "STUDENT", institute_id: authUser.institute_id });
    } else if (!["STUDENT", "ADMIN", "TEACHER"].includes(user.role)) {
      user.role = "STUDENT";
      await user.save();
    }

    const student = await Student.create({
      user_id: user._id, section_id, parent_name, parent_phone,
      admission_date: admission_date ? new Date(admission_date) : new Date(),
      institute_id: authUser.institute_id,
    });

    if (total_fee !== undefined && total_fee !== "") {
      await Fee.create({
        student_id: student._id,
        total_amount: Number(total_fee) || 0,
        due_amount:   Number(total_fee) || 0,
        paid_amount:  0,
        due_date:     due_date ? new Date(due_date) : new Date(),
        status: "DUE",
        institute_id: authUser.institute_id,
      });
    }

    await logActivity({
      institute_id: authUser.institute_id,
      action: "CREATED",
      collection: "Student",
      record_id: student._id,
      record_label: name,
      performed_by: authUser._id,
      performed_by_name: authUser.name || authUser.phoneOrEmail,
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    console.error("Students POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
