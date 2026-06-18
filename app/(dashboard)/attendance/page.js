"use client";

import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, CalendarCheck, Save, AlertCircle, Users, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Download } from "lucide-react";
import toast from "react-hot-toast";
import { createPdf, addTable, addSectionTitle, downloadPdf } from "@/lib/exportPdf";

const PAGE_SIZE = 15;

export default function AttendancePage() {
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedSlotStr, setSelectedSlotStr] = useState("");
  const [dailyTimetable, setDailyTimetable] = useState([]);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [date, setDate] = useState(todayStr);

  // Student specific state
  const [studentRecords, setStudentRecords] = useState([]);
  const [studentTimetable, setStudentTimetable] = useState([]);
  const [studentSearchDate, setStudentSearchDate] = useState(todayStr); // Defaults to today

  const PAGE_SIZE = 30;
  const [attendancePage, setAttendancePage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [existingRecords, setExistingRecords] = useState([]);
  const [role, setRole] = useState("");
  const [classes, setClasses] = useState([]);
  const [filterClass, setFilterClass] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/sections", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/me", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/classes", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/subjects", { cache: "no-store" }).then((r) => r.json()),
    ]).then(async ([b, m, c, sbj]) => {
      if (b.error) {
        setSections([]);
      } else {
        setSections(Array.isArray(b) ? b : []);
      }
      setClasses(Array.isArray(c) ? c : []);
      setRole(m.role || "STUDENT");
      const userRole = m.role || "STUDENT";

      if (userRole === "STUDENT") {
        try {
          const aRes = await fetch("/api/attendance", { cache: "no-store" }).then((r) => r.json());
          const sorted = (Array.isArray(aRes) ? aRes : []).sort(
            (x, y) => new Date(y.date) - new Date(x.date)
          );
          setStudentRecords(sorted);
          
          const tRes = await fetch("/api/timetable", { cache: "no-store" }).then((r) => r.json());
          setStudentTimetable(Array.isArray(tRes) ? tRes : []);
        } catch (e) {
          console.error(e);
        }
      }
    })
      .catch((err) => console.error("Error in initial load:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSection || !date) {
      setDailyTimetable([]);
      return;
    }
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const [y, m, d] = date.split("-");
    const dayStr = dayNames[new Date(y, m - 1, d).getDay()];
    fetch(`/api/timetable?section_id=${selectedSection}&day=${dayStr}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((res) => {
        setDailyTimetable(Array.isArray(res) ? res : []);
      });
  }, [selectedSection, date]);

  useEffect(() => {
    if (!selectedSection || !selectedSlotStr) return;
    const [subId, periodNo] = selectedSlotStr.split("_");
    Promise.all([
      fetch(`/api/students?section_id=${selectedSection}&limit=200`).then((r) => r.json()),
      fetch(`/api/attendance?section_id=${selectedSection}&date=${date}&subject_id=${subId}&period_no=${periodNo}`).then((r) => r.json()),
    ]).then(([s, a]) => {
      setStudents(Array.isArray(s) ? s : (s?.students || []));
      setExistingRecords(Array.isArray(a) ? a : []);
      const map = {};
      if (Array.isArray(a)) {
        a.forEach((rec) => { map[rec.student_id?._id || rec.student_id] = rec.status; });
      }
      if (Array.isArray(s)) {
        s.forEach((st) => { if (!map[st._id]) map[st._id] = "NOT_TAKEN"; });
      }
      setAttendance(map);
      setAttendancePage(1);
    });
  }, [selectedSection, date, selectedSlotStr]);

  const attendancePages = Math.max(1, Math.ceil(students.length / PAGE_SIZE));
  const paginatedStudents = students.slice((attendancePage - 1) * PAGE_SIZE, attendancePage * PAGE_SIZE);

  function toggle(studentId) {
    setAttendance((prev) => {
      const current = prev[studentId] || "NOT_TAKEN";
      let nextStatus = "NOT_TAKEN";
      if (current === "NOT_TAKEN") nextStatus = "PRESENT";
      else if (current === "PRESENT") nextStatus = "ABSENT";
      else nextStatus = "PRESENT";
      return { ...prev, [studentId]: nextStatus };
    });
  }

  async function markAll() {
    if (!selectedSection) return toast.error("Select a batch!");
    if (!selectedSlotStr) return toast.error("❌ Mandatory: You must select the specific lecture slot!");
    
    setSaving(true);
    try {
      const [subId, periodNo] = selectedSlotStr.split("_");
      const records = students
        .map((student) => ({
          student_id: student._id,
          section_id: selectedSection,
          subject_id: subId,
          period_no: Number(periodNo),
          date,
          status: attendance[student._id] || "NOT_TAKEN",
        }))
        .filter((r) => r.status !== "NOT_TAKEN");

      if (records.length === 0) {
        toast.error("No attendance marked. Click to toggle attendance.");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });

      if (res.ok) {
        toast.success("Attendance saved!");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save attendance");
      }
    } catch {
      toast.error("Network error saving attendance");
    }
    setSaving(false);
  }

  async function notifyAbsentees() {
    setNotifying(true);
    try {
      const [subId, periodNo] = selectedSlotStr.split("_");
      const res = await fetch("/api/attendance/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section_id: selectedSection, subject_id: subId, period_no: Number(periodNo), date }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Notifications sent!");
      } else {
        toast.error(data.error || "Failed to notify.");
      }
    } catch {
      toast.error("Network error.");
    }
    setNotifying(false);
  }

  async function notifyAbsenteesBulk() {
    if (!confirm("Are you sure you want to send absent notifications to ALL parents of ALL batches for this date?")) return;
    setNotifying(true);
    try {
      const res = await fetch("/api/attendance/notify/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Master notifications sent!");
      } else {
        toast.error(data.error || "Failed to notify.");
      }
    } catch {
      toast.error("Network error.");
    }
    setNotifying(false);
  }

  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    fetch('/api/subjects').then(r=>r.json()).then(d=>setSubjects(Array.isArray(d)?d:[]));
  },[]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="h-9 w-56 animate-shimmer rounded-lg" />
        <div className="h-28 animate-shimmer rounded-xl" />
        <div className="h-72 animate-shimmer rounded-xl" />
      </div>
    );
  }

  /* ───────────────── STUDENT VIEW ───────────────── */
  if (role === "STUDENT") {
    const totalDays = studentRecords.length;
    const presentDays = studentRecords.filter((r) => r.status === "PRESENT").length;
    const absentDays = studentRecords.filter((r) => r.status === "ABSENT").length;
    const pct = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : "100.0";
    const isGood = parseFloat(pct) >= 75;

    // Determine the Day of the Week for the selected date
    const targetDateObj = new Date(studentSearchDate);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const targetDayName = dayNames[targetDateObj.getDay()];

    // Get timetable for the selected day, ordered by period_no
    const dayTimetable = studentTimetable.filter(t => t.day === targetDayName).sort((a,b) => a.period_no - b.period_no);

    // Get attendance records for this specific DATE exactly
    // Date from DB usually looks like "2026-04-15T00:00:00.000Z"
    const todayRecords = studentRecords.filter((r) => r.date.startsWith(studentSearchDate));

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ── Page header ── */}
        <div>
          <h1 className="page-title">My Attendance</h1>
          <p className="page-subtitle">Your complete attendance record from admission to today.</p>
        </div>

        {/* ── Stat strip ── */}
        <div className="grid grid-cols-3 gap-3">
          {/* Overall % */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Overall</span>
            <div className={`text-3xl font-black mt-2 ${isGood ? "text-emerald-600" : "text-red-500"}`}>
              {pct}%
            </div>
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${isGood ? "bg-emerald-500" : "bg-red-400"}`}
                style={{ width: `${Math.min(100, parseFloat(pct))}%` }}
              />
            </div>
            <span className={`text-[10px] font-semibold mt-1 ${isGood ? "text-emerald-600" : "text-red-500"}`}>
              {isGood ? "Good standing" : "Needs attention"}
            </span>
          </div>

          {/* Present */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Present</span>
            <div className="text-3xl font-black text-emerald-700 mt-2">{presentDays}</div>
            <span className="text-xs font-medium text-emerald-600 mt-1">lectures attended</span>
          </div>

          {/* Absent */}
          <div className="bg-red-50 border border-red-100 rounded-2xl p-5 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Absent</span>
            <div className="text-3xl font-black text-red-600 mt-2">{absentDays}</div>
            <span className="text-xs font-medium text-red-500 mt-1">out of {totalDays} lectures</span>
          </div>
        </div>

        {/* ── Table card ── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {/* Card header with search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50/60">
            <div>
              <h2 className="text-sm font-bold text-gray-800 tracking-tight">Today's Schedule & Attendance</h2>
              <p className="text-xs text-gray-400 mt-0.5">{targetDayName}</p>
            </div>
            <div className="relative">
              <CalendarIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={studentSearchDate}
                onChange={(e) => setStudentSearchDate(e.target.value)}
                className="pl-8 pr-3 py-2 text-sm border border-gray-100 rounded-2xl bg-white text-gray-700 outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 transition-all w-full sm:w-auto"
              />
            </div>
          </div>

          <div className="p-5">
            {dayTimetable.length === 0 ? (
               <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 mt-2">
                 <CalendarIcon size={28} className="mx-auto mb-3 text-gray-200" />
                 <p className="text-sm font-semibold">
                   No classes scheduled for {targetDayName}.
                 </p>
               </div>
            ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                 {dayTimetable.map(period => {
                    // Try to find if attendance exists for this subject specifically
                    // It's possible the attendance doesn't have subject_id (marked as All Subjects)
                    // Try to find if attendance exists for exactly this subject and period
                    const exactAtt = todayRecords.find(r => r.subject_id?._id === period.subject_id?._id && r.period_no === period.period_no);
                    const allSubjectAtt = todayRecords.find(r => !r.subject_id);
                    
                    const attRecord = exactAtt || allSubjectAtt;
                    const status = attRecord ? attRecord.status : "NOT_MARKED";

                    return (
                        <div key={period._id} className="relative overflow-hidden group border border-gray-100 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
                            <div className={`h-1.5 w-full absolute top-0 left-0 ${status === 'PRESENT' ? 'bg-emerald-400' : status === 'ABSENT' ? 'bg-red-500' : 'bg-gray-200'}`}></div>
                            <div className="p-4 pt-5">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                                        Period {period.period_no}
                                    </span>
                                    {status === 'PRESENT' ? (
                                        <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                            <CheckCircle2 size={10} /> Present
                                        </span>
                                    ) : status === 'ABSENT' ? (
                                        <span className="bg-red-50 text-red-600 border border-red-100 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                            <XCircle size={10} /> Absent
                                        </span>
                                    ) : (
                                        <span className="bg-gray-50 text-gray-400 border border-gray-100 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                            Awaiting
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-sm font-bold text-gray-800 line-clamp-1">{period.subject_id?.name || "Subject"}</h3>
                                <p className="text-xs font-semibold text-gray-500 mt-1 truncate">{period.teacher_id?.user_id?.name || "Teacher"}</p>
                            </div>
                        </div>
                    )
                 })}
               </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ───────────────── ADMIN / TEACHER VIEW ───────────────── */
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">{role === "ADMIN" ? "Attendance Management" : "Daily Attendance"}</h1>
          <p className="page-subtitle">
            {role === "ADMIN" 
              ? "Monitor and verify student presence across all sections." 
              : "Mark presence for your assigned section and notify absentees."}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-4 md:mt-0">
          {selectedSection && selectedSlotStr && students.length > 0 && (
            <button
              onClick={async () => {
                const sectionObj = sections.find(s => s._id === selectedSection);
                const sectionLabel = sectionObj ? `${sectionObj.class_id?.name || "Class"} - Sec ${sectionObj.name}` : "Section";
                const { doc, startY, addFooter } = await createPdf({ title: "Attendance Register", subtitle: `${sectionLabel} · ${new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}` });
                const present = students.filter(s => attendance[s._id] === "PRESENT").length;
                const absent = students.filter(s => attendance[s._id] === "ABSENT").length;
                let y = addSectionTitle(doc, "Summary", startY);
                y = addTable(doc, { startY: y, head: ["Total Students", "Present", "Absent", "Not Marked"], body: [[String(students.length), String(present), String(absent), String(students.length - present - absent)]] });
                y += 6;
                y = addSectionTitle(doc, "Student Attendance", y);
                addTable(doc, { startY: y, head: ["#", "Student Name", "Status"], body: students.map((s, i) => [String(i + 1), s.user_id?.name || s.parent_name, attendance[s._id] === "PRESENT" ? "Present" : attendance[s._id] === "ABSENT" ? "Absent" : "Not Marked"]) });
                downloadPdf(doc, `Attendance_${date}.pdf`, addFooter);
              }}
              className="btn-secondary text-sm"
            >
              <Download size={15} /> PDF
            </button>
          )}
          {role === "ADMIN" && (
            <button
              onClick={notifyAbsenteesBulk}
              disabled={notifying}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-lg hover:shadow-red-500/30 transition-all border border-red-500"
            >
              <AlertCircle size={16} />
              {notifying ? "Notifying..." : "Master Notify (All Batches)"}
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-4 items-end">
          {role === "ADMIN" && (
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">1. Select Class</label>
              <select value={filterClass} onChange={(e) => { setFilterClass(e.target.value); setSelectedSection(""); }} className="input-field text-sm">
                <option value="">All Classes</option>
                {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex-1 min-w-[200px]">
             <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">2. Select Section</label>
             <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} className="input-field text-sm" disabled={role === "ADMIN" && !filterClass}>
               <option value="">— Choose a Section —</option>
               {sections.filter(b => role !== "ADMIN" || !filterClass || (b.class_id?._id || b.class_id) === filterClass).map((b) => (
                 <option key={b._id} value={b._id}>{b.class_id?.name || "Class"} - Sec {b.name}</option>
               ))}
             </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">3. Select Timetable Slot</label>
            <select value={selectedSlotStr} onChange={(e) => setSelectedSlotStr(e.target.value)} className="input-field text-sm" disabled={!selectedSection || dailyTimetable.length === 0}>
              <option value="">{dailyTimetable.length === 0 ? "— No lectures today —" : "— Select Lecture Slot —"}</option>
              {dailyTimetable.map((slot) => (
                <option key={slot._id} value={`${slot.subject_id?._id}_${slot.period_no}`}>
                  Period {slot.period_no}: {slot.subject_id?.name || "Subject"}
                </option>
               ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field text-sm" />
          </div>
        </div>
      </div>

      {(!selectedSection || !selectedSlotStr) && (
        <div className="card py-16 text-center border-dashed border-gray-200 relative overflow-hidden">
          <div className="w-14 h-14 mx-auto bg-gray-100 rounded-lg flex items-center justify-center text-gray-300 mb-3">
            <CalendarCheck size={32} />
          </div>
          <h3 className="text-base font-bold text-gray-700">Lecture Configuration Incomplete</h3>
          <p className="text-sm text-gray-500 mt-1">Please explicitly select a Section and the specific Subject lecture to load the marking register.</p>
        </div>
      )}

      {selectedSection && selectedSlotStr && students.length > 0 && (
        <div className="card !p-0">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((s) => (
                  <tr key={s._id}>
                    <td className="font-semibold text-gray-800">{s.user_id?.name || s.parent_name}</td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                        attendance[s._id] === "PRESENT" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        attendance[s._id] === "ABSENT" ? "bg-red-50 text-red-600 border-red-200" :
                        "bg-gray-100 text-gray-500 border-gray-200"
                      }`}>
                        {attendance[s._id] === "PRESENT" ? <CheckCircle2 size={11}/> : attendance[s._id] === "ABSENT" ? <XCircle size={11}/> : null}
                        {attendance[s._id] === "NOT_TAKEN" ? "Not Marked" : attendance[s._id] || "Not Marked"}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => toggle(s._id)}
                        className="text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors bg-slate-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-slate-200 hover:bg-slate-100"
                      >
                        {attendance[s._id] === "NOT_TAKEN" ? "Mark" : attendance[s._id] === "PRESENT" ? "Mark Absent" : "Mark Present"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {attendancePages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 p-4 bg-white">
              <span className="text-xs text-gray-500 font-medium">
                Showing {(attendancePage - 1) * PAGE_SIZE + 1} to {Math.min(attendancePage * PAGE_SIZE, students.length)} of {students.length} students
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAttendancePage(p => Math.max(1, p - 1))}
                  disabled={attendancePage === 1}
                  className="p-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setAttendancePage(p => Math.min(attendancePages, p + 1))}
                  disabled={attendancePage === attendancePages}
                  className="p-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-end items-center gap-3">
            {(role === "ADMIN" || role === "TEACHER") && (
              <button onClick={notifyAbsentees} disabled={notifying || existingRecords.length === 0} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 w-full sm:w-auto">
                <AlertCircle size={15} />
                {notifying ? "Notifying..." : "Notify Absentees"}
              </button>
            )}
            <button onClick={markAll} disabled={saving} className="btn-primary w-full sm:w-auto">
              {saving ? "Saving..." : <><Save size={15} /> Save Attendance</>}
            </button>
          </div>
        </div>
      )}

      {selectedSection && students.length === 0 && (
        <div className="card py-16 text-center border-dashed border-gray-200">
          <div className="w-14 h-14 mx-auto bg-gray-100 rounded-lg flex items-center justify-center text-gray-300 mb-3">
            <Users size={32} />
          </div>
          <h3 className="text-base font-bold text-gray-700">No students found</h3>
          <p className="text-sm text-gray-500 mt-1">No students enrolled in this section yet.</p>
        </div>
      )}
    </div>
  );
}
