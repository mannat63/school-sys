import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser, requireRole } from "@/lib/auth";
import Teacher from "@/models/Teacher";
import User from "@/models/User";
import RecycleBin from "@/models/RecycleBin";
import TimetableEntry from "@/models/TimetableEntry";
import Section from "@/models/Section";
import Student from "@/models/Student";
import Homework from "@/models/Homework";
import HomeworkSubmission from "@/models/HomeworkSubmission";
import mongoose from "mongoose";
import { logActivity } from "@/lib/logActivity";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  try {
    await dbConnect();
    const authUser = await getAuthUser();
    const { id } = await params;

    const teacher = await Teacher.findOne({ _id: id, institute_id: authUser.institute_id })
      .populate("user_id", "name phoneOrEmail")
      .populate("subjects", "name")
      .lean();

    if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });

    // Get sections this teacher is assigned to (via timetable)
    const entries = await TimetableEntry.find({ teacher_id: teacher._id, institute_id: authUser.institute_id }, { section_id: 1 }).lean();
    const sectionIds = [...new Set(entries.map(e => e.section_id?.toString()).filter(Boolean))];

    const sections = await Section.find({ _id: { $in: sectionIds } })
      .populate("class_id", "name")
      .lean();

    // Student counts per section
    const sectionCounts = await Student.aggregate([
      { $match: { section_id: { $in: sectionIds.map(s => new mongoose.Types.ObjectId(s)) }, institute_id: new mongoose.Types.ObjectId(authUser.institute_id) } },
      { $group: { _id: "$section_id", count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(sectionCounts.map(s => [s._id.toString(), s.count]));

    const sectionsWithCounts = sections.map(s => ({
      ...s,
      studentCount: countMap[s._id.toString()] || 0,
    }));

    const totalStudents = sectionsWithCounts.reduce((sum, s) => sum + s.studentCount, 0);

    // Fetch homework assigned by this teacher
    const homeworks = await Homework.find({ teacher_id: teacher._id, institute_id: authUser.institute_id })
      .populate({ path: "section_id", populate: { path: "class_id", select: "name" } })
      .sort({ createdAt: -1 })
      .lean();

    for (let hw of homeworks) {
      hw.submissions = await HomeworkSubmission.countDocuments({ homework_id: hw._id, status: { $ne: "PENDING" } });
      hw.total_students = countMap[hw.section_id?._id?.toString()] || 0;
    }

    return NextResponse.json({ teacher, sections: sectionsWithCounts, totalStudents, homeworks });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const { id } = await params;
    const body = await req.json();
    const { name, email, phone, phoneOrEmail, subjects } = body;
    if (phone && !/^\+91 \d{10}$/.test(phone)) {
      return NextResponse.json({ error: "Phone number must be exactly 10 digits prefixed with +91 (e.g., +91 9876543210)" }, { status: 400 });
    }

    const finalContact = email?.trim() ? email.trim() : phone?.trim() ? phone.trim() : phoneOrEmail;

    console.log(`Teacher Update Request: ID=${id}, Institute=${authUser.institute_id}`);

    // First find by ID
    const teacher = await Teacher.findById(id);
    if (!teacher) {
      console.error(`Teacher NOT FOUND by ID: ${id}`);
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    // Then check institute ownership
    if (teacher.institute_id.toString() !== authUser.institute_id.toString()) {
      console.error(`Teacher OWNERSHIP MISMATCH: Teacher Inst=${teacher.institute_id}, Auth Inst=${authUser.institute_id}`);
      return NextResponse.json({ error: "Forbidden: Not your teacher" }, { status: 403 });
    }

    // Now update the linked user
    await User.findByIdAndUpdate(teacher.user_id, { name, phoneOrEmail: finalContact, phone });
    if (subjects) {
      teacher.subjects = subjects;
      await teacher.save();
    }

    const updated = await Teacher.findById(id).populate("user_id", "name phoneOrEmail").populate("subjects", "name");

    logActivity({ institute_id: authUser.institute_id, action: "UPDATED", collection: "Teacher", record_id: id, record_label: name, performed_by: authUser._id, performed_by_name: authUser.name });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const { id } = await params;
    const teacher = await Teacher.findOne({ _id: id, institute_id: authUser.institute_id });
    if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    
    const user = await User.findById(teacher.user_id);
    
    // Save to Recycle Bin
    await RecycleBin.create({
      original_collection: "Teacher",
      original_id: teacher._id,
      institute_id: authUser.institute_id,
      data: {
        teacher: teacher.toObject(),
        user: user ? user.toObject() : null
      },
      deleted_by: authUser._id
    });

    await Teacher.deleteOne({ _id: id });
    if (user) await User.deleteOne({ _id: user._id });

    logActivity({ institute_id: authUser.institute_id, action: "DELETED", collection: "Teacher", record_id: id, record_label: user?.name || "Unknown", performed_by: authUser._id, performed_by_name: authUser.name });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
