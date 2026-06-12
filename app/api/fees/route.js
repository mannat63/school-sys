import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser, requireRole } from "@/lib/auth";
import Fee from "@/models/Fee";
import Student from "@/models/Student";
import Institute from "@/models/Institute";
import Notification from "@/models/Notification";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();
    const authUser = await getAuthUser();

    const { searchParams } = new URL(req.url);
    const student_id = searchParams.get("student_id");

    const query = { institute_id: authUser.institute_id };

    if (authUser.role === "TEACHER") {
      return NextResponse.json(
        { error: "Forbidden: Teachers do not have fee access" },
        { status: 403 }
      );
    } else if (authUser.role === "STUDENT") {
      const student = await Student.findOne(
        { user_id: authUser._id },
        { _id: 1 }
      ).lean();
      if (!student) return NextResponse.json([], { status: 200 });
      query.student_id = student._id;
    } else {
      if (student_id) query.student_id = student_id;
    }

    // --- AUTO-GENERATE MONTHLY RECURRING FEES ---
    if (authUser.role === "ADMIN" || authUser.role === "TEACHER") {
      const allLatestFees = await Fee.aggregate([
        { $match: { institute_id: authUser.institute_id } },
        { $sort: { due_date: -1 } },
        { $group: { _id: "$student_id", latestFee: { $first: "$$ROOT" } } }
      ]);

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      for (const f of allLatestFees) {
        let lastDueDate = new Date(f.latestFee.due_date);
        lastDueDate.setUTCHours(0, 0, 0, 0);
        let isLatestPaid = f.latestFee.status === "PAID";
        let iter = 0;

        // Generate next billing cycle ONLY if latest is paid OR cycle is already reached/passed
        while ((today >= lastDueDate || isLatestPaid) && iter < 12) {
          lastDueDate.setDate(lastDueDate.getDate() + 30);
          lastDueDate.setUTCHours(0, 0, 0, 0);
          
          try {
            // Check existence one last time before creating
            const exists = await Fee.findOne({
              student_id: f._id,
              institute_id: authUser.institute_id,
              due_date: lastDueDate
            }).lean();

            if (!exists) {
              await Fee.create({
                student_id: f._id,
                total_amount: f.latestFee.total_amount,
                paid_amount: 0,
                due_amount: f.latestFee.total_amount,
                due_date: new Date(lastDueDate),
                status: "DUE",
                institute_id: authUser.institute_id,
              });
            }
          } catch (dupErr) {
            // Expected if concurrent requests hit the unique index
            console.log("Duplicate fee prevented by DB index.");
          }
          
          isLatestPaid = false; 
          iter++;
        }
      }
    }
    // ---------------------------------------------

    const fees = await Fee.find(query)
      .select("student_id total_amount paid_amount due_amount due_date status")
      .populate({
        path: "student_id",
        select: "parent_name parent_phone user_id",
        populate: { path: "user_id", select: "name" },
      })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(fees);
  } catch (error) {
    console.error("Fees GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);

    const body = await req.json();
    const { student_id, total_amount, due_date } = body;

    const fee = await Fee.create({
      student_id,
      total_amount,
      paid_amount: 0,
      due_amount: total_amount,
      due_date,
      status: "DUE",
      institute_id: authUser.institute_id,
    });

    // Notify parent via in-app Notification (same as test notify)
    try {
      const student = await Student.findById(student_id)
        .select("parent_phone parent_name user_id")
        .populate("user_id", "name")
        .lean();

      if (student) {
        const studentName = student.user_id?.name || student.parent_name || "Student";
        const parentPhone = student.parent_phone || "—";
        const dueDateStr = new Date(fee.due_date).toLocaleDateString("en-GB");
        const message = `Fee reminder: ₹${fee.due_amount} is due on ${dueDateStr}. Please make the payment on time.`;

        await Notification.create({
          institute_id: authUser.institute_id,
          student_id: student._id,
          type: "FEE_REMINDER",
          recipient_name: studentName,
          recipient_phone: parentPhone,
          message,
          status: "SENT",
        });
      }
    } catch (e) {
      console.error("Fee notification error:", e.message);
    }

    return NextResponse.json(fee, { status: 201 });
  } catch (error) {
    console.error("Fees POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
