import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser } from "@/lib/auth";
import Attendance from "@/models/Attendance";

export async function GET(req) {
  try {
    await dbConnect();
    const authUser = await getAuthUser();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const riskiestStudents = await Attendance.aggregate([
      { $match: { institute_id: authUser.institute_id, date: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: "$student_id",
          totalClasses: { $sum: 1 },
          presentCount: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } }
        }
      },
      {
        $project: {
          student_id: "$_id",
          percentage: {
            $cond: [
              { $gt: ["$totalClasses", 0] },
              { $multiply: [{ $divide: ["$presentCount", "$totalClasses"] }, 100] },
              0
            ]
          }
        }
      },
      { $match: { percentage: { $lt: 50 } } },
      { $sort: { percentage: 1 } },
      {
        $lookup: {
          from: "students",
          localField: "student_id",
          foreignField: "_id",
          as: "studentInfo"
        }
      },
      { $unwind: "$studentInfo" },
      {
        $lookup: {
          from: "sections",
          localField: "studentInfo.section_id",
          foreignField: "_id",
          as: "sectionInfo"
        }
      },
      { $unwind: "$sectionInfo" },
      {
        $lookup: {
          from: "users",
          localField: "studentInfo.user_id",
          foreignField: "_id",
          as: "userInfo"
        }
      },
      { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          studentId: "$student_id",
          name: { $ifNull: ["$userInfo.name", "$studentInfo.parent_name"] },
          percentage: { $round: ["$percentage", 1] },
          sectionName: "$sectionInfo.name"
        }
      }
    ]);

    return NextResponse.json({ success: true, count: riskiestStudents.length, data: riskiestStudents });
  } catch (error) {
    console.error("Attendance Risk Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
