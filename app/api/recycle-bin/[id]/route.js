import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import RecycleBin from "@/models/RecycleBin";
import Student from "@/models/Student";
import User from "@/models/User";
import Teacher from "@/models/Teacher";
import ClassModel from "@/models/Class";
import Section from "@/models/Section";
import Fee from "@/models/Fee";
import Payment from "@/models/Payment";
import { logActivity } from "@/lib/logActivity";

export const dynamic = "force-dynamic";

// Permanently delete one item
export async function DELETE(req, { params }) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const { id } = await params;

    const item = await RecycleBin.findOne({ _id: id, institute_id: authUser.institute_id });
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    await RecycleBin.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Restore one item
export async function POST(req, { params }) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const { id } = await params;

    const item = await RecycleBin.findOne({ _id: id, institute_id: authUser.institute_id });
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    const { original_collection, data } = item;

    if (original_collection === "Student") {
      const { student, user, fees, payments } = data;
      // Restore user first (if not already existing)
      let restoredUser = await User.findById(user?._id);
      if (!restoredUser && user) {
        const { _id, __v, ...userFields } = user;
        restoredUser = await User.create({ _id: user._id, ...userFields });
      }
      // Restore student
      const existing = await Student.findById(student._id);
      if (!existing) {
        const { _id, __v, ...studentFields } = student;
        await Student.create({ _id: student._id, ...studentFields });
      }
      // Restore fees
      if (fees?.length) {
        for (const fee of fees) {
          const existingFee = await Fee.findById(fee._id);
          if (!existingFee) {
            const { _id, __v, ...feeFields } = fee;
            await Fee.create({ _id: fee._id, ...feeFields });
          }
        }
      }
    } else if (original_collection === "Teacher") {
      const { teacher, user } = data;
      let restoredUser = await User.findById(user?._id);
      if (!restoredUser && user) {
        const { _id, __v, ...userFields } = user;
        restoredUser = await User.create({ _id: user._id, ...userFields });
      }
      const existing = await Teacher.findById(teacher._id);
      if (!existing) {
        const { _id, __v, ...teacherFields } = teacher;
        await Teacher.create({ _id: teacher._id, ...teacherFields });
      }
    } else if (original_collection === "Class") {
      const { class: cls, sections } = data;
      const existing = await ClassModel.findById(cls._id);
      if (!existing) {
        const { _id, __v, ...clsFields } = cls;
        await ClassModel.create({ _id: cls._id, ...clsFields });
      }
      if (sections?.length) {
        for (const sec of sections) {
          const existingSec = await Section.findById(sec._id);
          if (!existingSec) {
            const { _id, __v, ...secFields } = sec;
            await Section.create({ _id: sec._id, ...secFields });
          }
        }
      }
    }

    await RecycleBin.findByIdAndDelete(id);

    const label = data?.student?.user_id?.name || data?.teacher?.user_id?.name || data?.user?.name || original_collection;
    logActivity({ institute_id: authUser.institute_id, action: "RESTORED", collection: original_collection, record_id: item.original_id, record_label: label, performed_by: authUser._id, performed_by_name: authUser.name });

    return NextResponse.json({ success: true, collection: original_collection });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
