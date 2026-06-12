import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import Institute from "@/models/Institute";
import Notification from "@/models/Notification";
import { sendEventToN8N } from "@/services/n8n";
import { GET as getAdminReport } from "../admin/route";

export async function POST(req) {
  try {
    const authUser = await requireRole(["ADMIN"]);
    const body = await req.json();
    const { dateFrom, dateTo, sectionId } = body;

    const url = new URL("http://localhost/api/reports/admin");
    if (dateFrom) url.searchParams.set("dateFrom", dateFrom);
    if (dateTo) url.searchParams.set("dateTo", dateTo);
    if (sectionId) url.searchParams.set("sectionId", sectionId);
    
    // Simulate Request to reuse Admin Aggregation Logic perfectly
    const mockReq = { url: url.toString() }; 
    const adminRes = await getAdminReport(mockReq);
    if (!adminRes.ok) return adminRes;
    
    const data = await adminRes.json();
    const students = data.students || [];
    
    const inst = await Institute.findById(authUser.institute_id);

    let sentCount = 0;
    const errors = [];

    for (const s of students) {
        if (!s.student.parent_phone || s.student.parent_phone === "—") {
             errors.push(`Skipped ${s.student.name}: No valid phone number.`);
             continue;
        }
        
        try {
            await sendEventToN8N({
                event_type: "monthly_report",
                timestamp: new Date().toISOString(),
                institute: {
                    id: inst._id.toString(),
                    name: inst.name
                },
                student: {
                    id: s.student.id,
                    name: s.student.name,
                    parent_phone: s.student.parent_phone,
                    section_name: s.student.section
                },
                data: {
                    period: `${dateFrom} to ${dateTo}`,
                    attendance: s.attendance,
                    fees: s.fees,
                    tests: s.tests
                }
            });

            await Notification.create({
              institute_id: inst._id,
              student_id: s.student.id,
              type: "REPORT_CARD",
              recipient_name: s.student.name,
              recipient_phone: s.student.parent_phone,
              message: `Official Report for ${s.student.name} (${dateFrom} to ${dateTo}) from ${inst.name}. Tests: ${s.tests?.percentage}%, Attendance: ${s.attendance?.percentage}%, Outstanding: ₹${s.fees?.due}.`,
              status: "SENT"
            });

            sentCount++;
        } catch (err) {
            errors.push(`Failed to send to ${s.student.name}: ${err.message}`);
        }
    }

    return NextResponse.json({ success: true, sent: sentCount, errors });
  } catch (error) {
    console.error("Report Notify Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
