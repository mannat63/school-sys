import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { fetchAdminReportData } from "@/lib/reports";

export async function GET(req) {
  try {
    const authUser = await requireRole(["ADMIN"]);
    
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const sectionId = searchParams.get("sectionId");
    const studentId = searchParams.get("studentId");

    if (!dateFrom || !dateTo) {
        return NextResponse.json({ error: "dateFrom and dateTo are required" }, { status: 400 });
    }

    const { overview, students } = await fetchAdminReportData({
        institute_id: authUser.institute_id,
        dateFrom,
        dateTo,
        sectionId,
        studentId
    });

    return NextResponse.json({ overview, students });
  } catch (error) {
    console.error("Admin Report Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

