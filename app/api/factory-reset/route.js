import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import User from "@/models/User";
import Course from "@/models/Course";
import Section from "@/models/Section";
import Student from "@/models/Student";
import Teacher from "@/models/Teacher";
import Fee from "@/models/Fee";
import Attendance from "@/models/Attendance";
import Test from "@/models/Test";
import Result from "@/models/Result";
import Payment from "@/models/Payment";

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const iid = authUser.institute_id;
    
    // WIPEOUT ALL DATA
    await Promise.all([
        Student.deleteMany({ institute_id: iid }),
        Teacher.deleteMany({ institute_id: iid }),
        Course.deleteMany({ institute_id: iid }),
        Section.deleteMany({ institute_id: iid }),
        Fee.deleteMany({ institute_id: iid }),
        Attendance.deleteMany({ institute_id: iid }),
        Test.deleteMany({ institute_id: iid }),
        Result.deleteMany({ institute_id: iid }),
        Payment.deleteMany({ institute_id: iid }),
        // Delete any users that aren't the ADMIN
        User.deleteMany({ institute_id: iid, role: { $ne: "ADMIN" } })
    ]);

    return NextResponse.json({ message: "Factory Reset Successful: All data wiped." }, { status: 200 });
  } catch (error) {
    console.error("Factory Reset error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
