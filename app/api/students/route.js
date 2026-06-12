import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser, requireRole } from "@/lib/auth";
import Student from "@/models/Student";
import User from "@/models/User";
import Teacher from "@/models/Teacher";
import Section from "@/models/Section";
import Fee from "@/models/Fee";
import Attendance from "@/models/Attendance";
import Result from "@/models/Result";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();
    const authUser = await getAuthUser();

    const { searchParams } = new URL(req.url);
    const section_id = searchParams.get("section_id");
    const risk = searchParams.get("risk");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(200, parseInt(searchParams.get("limit") || "150"));
    const skip = (page - 1) * limit;

    const query = { institute_id: authUser.institute_id };

    // ── Role-based filtering ──
    if (authUser.role === "TEACHER") {
      const teacher = await Teacher.findOne(
        { user_id: authUser._id },
        { _id: 1 }
      ).lean();
      if (!teacher) return NextResponse.json([]);

      const { default: TimetableEntry } = await import("@/models/TimetableEntry");
      const timetables = await TimetableEntry.find({ teacher_id: teacher._id }, { section_id: 1 }).lean();
      const sectionIds = [...new Set(timetables.map(t => t.section_id?.toString() || ""))].filter(Boolean);

      if (section_id && !sectionIds.includes(section_id)) {
        return NextResponse.json({ error: "Forbidden: Not your section" }, { status: 403 });
      }
      query.section_id = section_id ? section_id : { $in: sectionIds };
    } else if (authUser.role === "STUDENT") {
      query.user_id = authUser._id;
    } else {
      if (section_id) query.section_id = section_id;
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // ── Risk pre-filter: single aggregation per risk type ──
    let riskMap = {};

    if (risk === "fees") {
      const now = new Date();
      const fees = await Fee.find(
        { due_amount: { $gt: 0 }, due_date: { $lt: now }, institute_id: authUser.institute_id },
        { student_id: 1, due_amount: 1 }
      ).lean();
      fees.forEach((f) => {
        riskMap[f.student_id.toString()] = {
          label: "OVERDUE",
          value: `₹${f.due_amount.toLocaleString()}`,
        };
      });
      if (Object.keys(riskMap).length === 0) return NextResponse.json([]);
      query._id = { $in: Object.keys(riskMap) };
    } else if (risk === "attendance") {
      const lowAtt = await Attendance.aggregate([
        { $match: { date: { $gte: thirtyDaysAgo }, institute_id: authUser.institute_id } },
        {
          $group: {
            _id: "$student_id",
            total: { $sum: 1 },
            present: {
              $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            percentage: {
              $cond: [
                { $gt: ["$total", 0] },
                { $multiply: [{ $divide: ["$present", "$total"] }, 100] },
                0,
              ],
            },
          },
        },
        { $match: { percentage: { $lt: 50 } } },
      ]);
      lowAtt.forEach((a) => {
        riskMap[a._id.toString()] = {
          label: "Attendance",
          value: `${a.percentage.toFixed(1)}%`,
        };
      });
      if (Object.keys(riskMap).length === 0) return NextResponse.json([]);
      query._id = { $in: Object.keys(riskMap) };
    } else if (risk === "performance") {
      const lowPerf = await Result.aggregate([
        { $match: { institute_id: authUser.institute_id } },
        { $lookup: { from: "tests", localField: "test_id", foreignField: "_id", as: "t" } },
        { $unwind: "$t" },
        {
          $group: {
            _id: "$student_id",
            avg: {
              $avg: { $multiply: [{ $divide: ["$marks", "$t.total_marks"] }, 100] },
            },
          },
        },
        { $match: { avg: { $lt: 50 } } },
      ]);
      lowPerf.forEach((r) => {
        riskMap[r._id.toString()] = {
          label: "Avg Score",
          value: `${r.avg.toFixed(1)}%`,
        };
      });
      if (Object.keys(riskMap).length === 0) return NextResponse.json([]);
      query._id = { $in: Object.keys(riskMap) };
    }

    // ── Fetch paginated students ──
    const students = await Student.find(query)
      .select("user_id section_id parent_name parent_phone admission_date institute_id")
      .populate("user_id", "name phoneOrEmail")
      .populate({
        path: "section_id",
        select: "name class_id",
        populate: { path: "class_id", select: "name" },
      })
      .sort({ section_id: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    if (students.length === 0) return NextResponse.json([]);

    const studentIds = students.map((s) => s._id);

    // ── Bulk enhancements: run in parallel ──
    const [fees, attendanceStats, performanceStats] = await Promise.all([
      Fee.find({ student_id: { $in: studentIds } }, { student_id: 1, total_amount: 1, due_amount: 1, status: 1 }).lean(),

      Attendance.aggregate([
        { $match: { student_id: { $in: studentIds }, date: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: "$student_id",
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } },
          },
        },
        {
          $project: {
            percentage: {
              $cond: [
                { $gt: ["$total", 0] },
                { $multiply: [{ $divide: ["$present", "$total"] }, 100] },
                0,
              ],
            },
          },
        },
      ]),

      Result.aggregate([
        { $match: { student_id: { $in: studentIds } } },
        { $lookup: { from: "tests", localField: "test_id", foreignField: "_id", as: "t" } },
        { $unwind: "$t" },
        {
          $group: {
            _id: "$student_id",
            avg: {
              $avg: { $multiply: [{ $divide: ["$marks", "$t.total_marks"] }, 100] },
            },
          },
        },
      ]),
    ]);

    // Build lookup maps
    const feeMap = {};
    fees.forEach((f) => {
      feeMap[f.student_id.toString()] = {
        total: f.total_amount,
        due: f.due_amount,
        status: f.status,
      };
    });

    const attMap = {};
    attendanceStats.forEach((a) => {
      attMap[a._id.toString()] = a.percentage;
    });

    const perfMap = {};
    performanceStats.forEach((p) => {
      perfMap[p._id.toString()] = p.avg;
    });

    const enriched = students.map((s) => ({
      ...s,
      total_fee: feeMap[s._id.toString()]?.total || 0,
      due_fee: feeMap[s._id.toString()]?.due || 0,
      fee_status: feeMap[s._id.toString()]?.status || "UNKNOWN",
      risk_info: riskMap[s._id.toString()] || null,
      attendance_percentage: attMap[s._id.toString()] ?? null,
      performance_avg: perfMap[s._id.toString()] ?? null,
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Students Fetch Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);

    const body = await req.json();
    const {
      name,
      phoneOrEmail,
      section_id,
      parent_name,
      parent_phone,
      admission_date,
      total_fee,
      due_date,
    } = body;

    const trimmedPhoneOrEmail = phoneOrEmail.trim();
    // Check if user already exists
    let user = await User.findOne({ phoneOrEmail: new RegExp(`^${trimmedPhoneOrEmail}$`, "i") });
    if (user) {
      if (user.role !== "STUDENT" && user.role !== "ADMIN" && user.role !== "TEACHER") {
        user.role = "STUDENT";
        await user.save();
      }
    } else {
      user = await User.create({
        name,
        phoneOrEmail: trimmedPhoneOrEmail,
        role: "STUDENT",
        institute_id: authUser.institute_id,
      });
    }

    const student = await Student.create({
      user_id: user._id,
      section_id,
      parent_name,
      parent_phone,
      admission_date: admission_date ? new Date(admission_date) : new Date(),
      institute_id: authUser.institute_id,
    });

    if (total_fee !== undefined && total_fee !== "") {
      await Fee.create({
        student_id: student._id,
        total_amount: Number(total_fee) || 0,
        due_amount: Number(total_fee) || 0,
        paid_amount: 0,
        due_date: due_date ? new Date(due_date) : new Date(),
        status: "DUE",
        institute_id: authUser.institute_id,
      });
    }

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    console.error("Students POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
