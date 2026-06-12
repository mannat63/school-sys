import { NextResponse } from "next/server";
import { GET as getAdminReport } from "../../admin/route";

export async function GET(req) {
  try {
    const adminRes = await getAdminReport(req);
    if (!adminRes.ok) return adminRes;
    
    const data = await adminRes.json();
    const students = data.students || [];

    const header = "Student Name,Parent Phone,Section,Attendance (%),Total Fees,Paid Fees,Due Fees,Tests Taken,Avg Score (%),Rank\n";
    const rows = students.map(s => {
        return `"${s.student.name}","${s.student.parent_phone}","${s.student.section}","${s.attendance.percentage}","${s.fees.total}","${s.fees.paid}","${s.fees.due}","${s.tests.taken}","${s.tests.percentage}","${s.tests.rank}"`;
    }).join("\n");

    const csvContent = header + rows;

    return new NextResponse(csvContent, {
        status: 200,
        headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="Alpha_Report_${new Date().toISOString().split('T')[0]}.csv"`
        }
    });
  } catch (error) {
    console.error("CSV Export Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
