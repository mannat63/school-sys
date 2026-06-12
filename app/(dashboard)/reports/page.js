"use client";

import { useState, useEffect } from "react";
import { FileText, Download, TrendingUp, TrendingDown, Users, Wallet, CheckCircle, Calendar, AlertCircle, X, Send, Award, BookOpen, GraduationCap } from "lucide-react";
import toast from "react-hot-toast";

export default function ReportsPage() {
  const [role, setRole] = useState(null);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [filterClass, setFilterClass] = useState("");
  const [sectionId, setSectionId] = useState("");
  const today = new Date();
  const getLocalDateString = (d) => {
     const year = d.getFullYear();
     const month = String(d.getMonth() + 1).padStart(2, '0');
     const day = String(d.getDate()).padStart(2, '0');
     return `${year}-${month}-${day}`;
  };
  const firstDay = getLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1));
  const lastDay = getLocalDateString(new Date(today.getFullYear(), today.getMonth() + 1, 0));

  const [dateFrom, setDateFrom] = useState(firstDay);
  const [dateTo, setDateTo] = useState(lastDay);
  
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/me").then(r => r.ok ? r.json() : null).then(data => {
      if (!data) return;
      setRole(data.role || "STUDENT");
      if (data.role === "ADMIN") {
        Promise.all([
          fetch("/api/classes").then(r => r.ok ? r.json() : []),
          fetch("/api/sections").then(r => r.ok ? r.json() : []),
        ]).then(([cl, sc]) => {
          const clSorted = (Array.isArray(cl) ? cl : []).sort((a, b) => {
            const na = parseInt(a.name.replace(/\D/g, ""), 10);
            const nb = parseInt(b.name.replace(/\D/g, ""), 10);
            return isNaN(na) || isNaN(nb) ? a.name.localeCompare(b.name) : na - nb;
          });
          setClasses(clSorted);
          setSections(Array.isArray(sc) ? sc : []);
        });
      }
      generateReport(data.role || "STUDENT");
    });
  }, []);

  // Sections filtered by selected class
  const filteredSections = filterClass
    ? sections.filter(s => (s.class_id?._id || s.class_id) === filterClass)
    : sections;

  async function handleSendWhatsApp() {
    if (!report || !report.students) return;
    if (!confirm(`Are you sure you want to send ${report.students.length} report cards via WhatsApp?`)) return;
    
    setSending(true);
    try {
      const res = await fetch("/api/reports/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateFrom, dateTo, sectionId })
      });
      if (res.ok) {
        toast.success("Reports dispatched successfully!");
      } else {
        toast.error("Failed to send reports.");
      }
    } catch (e) {
      toast.error("Error dispatching reports");
    }
    setSending(false);
  }

  async function generateReport(userRole = role) {
    setLoading(true);
    try {
      const endpoint = userRole === "ADMIN" ? "/api/reports/admin" : "/api/reports/student";
      const params = new URLSearchParams({ dateFrom, dateTo });
      if (sectionId && userRole === "ADMIN") params.append("sectionId", sectionId);

      const res = await fetch(`${endpoint}?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
        toast.success("Report generated");
      } else {
        toast.error("Failed to load report");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error generating report");
    }
    setLoading(false);
  }

  function handleDownloadCSV() {
    const params = new URLSearchParams({ dateFrom, dateTo });
    if (sectionId) params.append("sectionId", sectionId);
    window.location.href = `/api/reports/export/csv?${params.toString()}`;
  }

  function handlePrintPDF() {
    window.print();
  }

  if (!role) return <div className="p-8 text-gray-500 font-medium">Loading...</div>;

  const SCHOOL_NAME = "Alpha School";

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* ── Print-only global styles ── */}
      <style jsx global>{`
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden, nav, aside, header { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          @page { margin: 0.6in 0.5in; size: A4 portrait; }
        }
      `}</style>

      <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">{role === "ADMIN" ? "Operational Intelligence" : "Academic Performance Report"}</h1>
          <p className="page-subtitle">
            {role === "ADMIN" 
              ? "Comprehensive analysis of revenue, attendance, and academic trends."
              : "Review your progress, attendance, and scores for the selected period."}
          </p>
        </div>
      </div>
      
      {/* ─── FILTERS ─── */}
      <div className="print:hidden card flex flex-col md:flex-row gap-4 items-end justify-between">
        <div className="flex flex-wrap items-end gap-3 w-full md:w-auto">
          <div className="flex-1 min-w-[130px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field w-full md:max-w-[150px]" />
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field w-full md:max-w-[150px]" />
          </div>
          {role === "ADMIN" && (
            <>
              <div className="flex-1 min-w-[130px]">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Class</label>
                <select
                  value={filterClass}
                  onChange={(e) => { setFilterClass(e.target.value); setSectionId(""); }}
                  className="input-field w-full md:max-w-[160px]"
                >
                  <option value="">All Classes</option>
                  {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Section</label>
                <select
                  value={sectionId}
                  onChange={e => setSectionId(e.target.value)}
                  className="input-field w-full md:max-w-[160px]"
                  disabled={!filterClass}
                >
                  <option value="">All Sections</option>
                  {filteredSections.map(b => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <button onClick={() => generateReport(role)} disabled={loading} className="btn-primary w-full sm:w-auto mb-0.5">
            {loading ? "Generating..." : "Apply Filters"}
          </button>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto mt-4 md:mt-0">
          <button onClick={handlePrintPDF} className="btn-secondary text-sm">
            <Download size={15} /> PDF
          </button>
          {role === "ADMIN" && (
            <>
              <button onClick={handleDownloadCSV} className="btn-secondary text-sm">
                <FileText size={15} /> CSV
              </button>
              <button onClick={handleSendWhatsApp} disabled={sending || !report} className="btn-primary !bg-emerald-700 hover:!bg-emerald-800 text-sm disabled:opacity-50">
                {sending ? "Sending..." : <><Send size={14} /> Send to Parents</>}
              </button>
            </>
          )}
        </div>
      </div>

      {loading && <div className="h-64 animate-shimmer rounded-lg"></div>}

      {/* ─── REPORT CONTENT (print target) ─── */}
      <div id="report-content-to-print" className="space-y-6">

      {/* ─── ADMIN REPORT ─── */}
      {!loading && report && role === "ADMIN" && (
        <div className="space-y-6">

          {/* Print Header */}
          <div className="hidden print:block text-center border-b-2 border-gray-800 pb-4 mb-6">
            <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">{SCHOOL_NAME}</h1>
            <p className="text-sm font-medium text-gray-600 mt-1">Period: {new Date(dateFrom).toLocaleDateString()} to {new Date(dateTo).toLocaleDateString()}</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card bg-white border border-gray-200">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Total Students</div>
              <div className="text-2xl font-bold text-gray-900 mt-2">{report.overview?.total_students || 0}</div>
            </div>
            <div className="stat-card bg-white border border-gray-200">
              <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Revenue Collected</div>
              <div className="text-2xl font-bold text-gray-900 mt-2">₹{(report.overview?.total_revenue_collected || 0).toLocaleString()}</div>
            </div>
            <div className="stat-card bg-white border border-gray-200">
              <div className="text-[10px] font-semibold text-red-600 uppercase tracking-wider">Pending Dues</div>
              <div className="text-2xl font-bold text-red-600 mt-2">₹{(report.overview?.pending_fees || 0).toLocaleString()}</div>
            </div>
            <div className="stat-card bg-white border border-gray-200">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Avg Attendance</div>
              <div className="text-2xl font-bold text-gray-900 mt-2">{report.overview?.avg_attendance}%</div>
            </div>
          </div>

          {/* Insights */}
          <div className="card bg-slate-800 text-white border-0 p-5 relative overflow-hidden">
             <div className="relative z-10">
               <h2 className="text-sm font-semibold tracking-wide flex items-center gap-2 mb-3 text-emerald-400 uppercase">
                 <TrendingUp size={15} /> Performance Summary
               </h2>
               <ul className="space-y-2 font-medium text-sm text-gray-300">
                 <li className="flex items-center gap-2">
                   <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                   Administered <strong className="text-white">{report.overview?.tests_conducted || 0}</strong> tests in this period.
                 </li>
                 {report.overview?.top_performer && (
                   <li className="flex items-center gap-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                     Overall topper: <strong className="text-white">{report.overview.top_performer.name}</strong> ({report.overview.top_performer.score}% avg).
                   </li>
                 )}
                 {report.overview?.section_toppers?.length > 0 && (
                   <li className="flex flex-col gap-1.5 items-start">
                     <div className="flex items-center gap-2 mt-1">
                       <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                       <span className="text-gray-400 text-xs">Section Toppers:</span>
                     </div>
                     <div className="flex flex-wrap gap-2 ml-3.5 mt-1">
                       {Array.isArray(report.overview?.section_toppers) && report.overview.section_toppers.map((tp, i) => (
                         <div key={i} className="px-2 py-0.5 bg-white/10 rounded flex items-center gap-2 border border-white/5 shadow-sm">
                            <span className="text-[10px] text-gray-500 font-bold uppercase">{tp.section}:</span>
                            <span className="text-xs font-bold text-emerald-400">{tp.name} ({tp.score}%)</span>
                         </div>
                       ))}
                     </div>
                   </li>
                 )}
               </ul>
             </div>
          </div>

          {/* Student Table */}
          <div className="card !p-0 overflow-hidden print:overflow-visible print:w-full print:break-inside-[avoid-page]">
            <div className="p-4 border-b border-gray-200 bg-gray-50 print:bg-transparent print:border-b-2 print:border-gray-800">
              <h2 className="font-semibold text-gray-800 text-sm print:text-lg">Detailed Student Aggregation</h2>
            </div>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="data-table !text-sm print:w-full print:table-fixed">
                <thead>
                  <tr>
                    <th className="print:w-1/4">Student Name</th>
                    <th className="print:w-1/4">Section</th>
                    <th className="text-right">Attendance</th>
                    <th className="text-right">Test Avg</th>
                    <th className="text-right">Rank</th>
                    <th className="text-right">Fee Due</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(report?.students) && [...report.students]
                   .sort((a, b) => {
                     const secA = a.student.section || "";
                     const secB = b.student.section || "";
                     const numA = parseInt((secA.match(/\d+/) || ["0"])[0], 10);
                     const numB = parseInt((secB.match(/\d+/) || ["0"])[0], 10);
                     if (numA !== numB) return numA - numB;
                     return secA.localeCompare(secB) || (a.student.name || "").localeCompare(b.student.name || "");
                   })
                   .map((row, idx) => (
                    <tr key={idx}>
                      <td className="font-semibold text-gray-700">{row.student.name}</td>
                      <td className="text-gray-500">{row.student.section}</td>
                      <td className="text-right font-mono font-medium text-gray-600">{row.attendance.percentage}%</td>
                      <td className="text-right font-mono font-medium text-slate-700">{row.tests.percentage}%</td>
                      <td className="text-right font-medium text-gray-400">
                        {row.tests.rank !== "N/A" ? `#${row.tests.rank}` : "-"}
                      </td>
                      <td className={`text-right font-mono font-medium ${row.fees.due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        ₹{row.fees.due.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {report.students.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-400 font-medium">No student data found for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ─── STUDENT REPORT CARD ─── */}
      {!loading && report && role === "STUDENT" && (
        <div className="space-y-0">
          
          {/* ═══════════════════════════════════════════════════════
              OFFICIAL REPORT CARD — Professional Design
              ═══════════════════════════════════════════════════════ */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden print:shadow-none print:border print:border-gray-300 print:rounded-none">

            {/* ── School Header Bar ── */}
            <div className="bg-slate-900 text-white px-6 sm:px-8 py-5 print:bg-white print:text-black print:border-b-2 print:border-black">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center print:bg-gray-100 print:border print:border-gray-300 overflow-hidden">
                    <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold tracking-tight print:text-2xl">{SCHOOL_NAME}</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.25em] mt-0.5 print:text-gray-500">Official Report Card</p>
                  </div>
                </div>
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest print:text-gray-400">Report Period</div>
                  <div className="text-sm font-semibold text-slate-300 mt-0.5 print:text-gray-700">
                    {new Date(dateFrom).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} — {new Date(dateTo).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Student Info Strip ── */}
            <div className="px-6 sm:px-8 py-5 bg-gray-50/80 border-b border-gray-200 print:bg-white">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Student Name</div>
                  <div className="text-base font-bold text-gray-900 mt-1">{report.student?.name}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Class</div>
                  <div className="text-base font-bold text-gray-900 mt-1">{report.student?.className || "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Section</div>
                  <div className="text-base font-bold text-gray-900 mt-1">{report.student?.sectionName || "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Guardian Contact</div>
                  <div className="text-base font-bold text-gray-900 mt-1">{report.student?.parent_phone || "—"}</div>
                </div>
              </div>
            </div>

            {/* ── Summary KPIs ── */}
            <div className="px-6 sm:px-8 py-5 border-b border-gray-200">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* Attendance */}
                <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100 print:bg-white print:border-gray-200">
                  <div className="text-3xl font-black text-blue-700 print:text-gray-900">{report.attendance?.percentage || 0}%</div>
                  <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1 print:text-gray-500">Attendance</div>
                </div>
                {/* Present / Total */}
                <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-100 print:bg-white print:border-gray-200">
                  <div className="text-3xl font-black text-emerald-700 print:text-gray-900">{report.attendance?.present || 0}<span className="text-lg text-emerald-400 print:text-gray-400">/{report.attendance?.total_days || 0}</span></div>
                  <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-1 print:text-gray-500">Days Present</div>
                </div>
                {/* Academic */}
                <div className="text-center p-4 bg-violet-50 rounded-xl border border-violet-100 print:bg-white print:border-gray-200">
                  <div className="text-3xl font-black text-violet-700 print:text-gray-900">{report.tests?.percentage || 0}%</div>
                  <div className="text-[10px] font-bold text-violet-500 uppercase tracking-widest mt-1 print:text-gray-500">Test Average</div>
                </div>
                {/* Fees */}
                <div className={`text-center p-4 rounded-xl border print:bg-white print:border-gray-200 ${report.fees?.due > 0 ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-200"}`}>
                  <div className={`text-3xl font-black ${report.fees?.due > 0 ? "text-red-600" : "text-emerald-700"} print:text-gray-900`}>₹{(report.fees?.due || 0).toLocaleString()}</div>
                  <div className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${report.fees?.due > 0 ? "text-red-400" : "text-gray-400"} print:text-gray-500`}>Outstanding</div>
                </div>
              </div>
            </div>

            {/* ── Attendance & Financial Detail ── */}
            <div className="px-6 sm:px-8 py-5 border-b border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Attendance Detail */}
                <div>
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2 mb-4">
                    <Calendar size={14} className="text-gray-400" /> Attendance Record
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-2.5 px-3 bg-gray-50 rounded-lg border border-gray-100">
                      <span className="text-sm font-medium text-gray-500">Total Class Days</span>
                      <span className="font-mono font-bold text-gray-800">{report.attendance?.total_days || 0}</span>
                    </div>
                    <div className="flex justify-between items-center py-2.5 px-3 bg-emerald-50 rounded-lg border border-emerald-100">
                      <span className="text-sm font-medium text-emerald-700">Present</span>
                      <span className="font-mono font-bold text-emerald-800">{report.attendance?.present || 0}</span>
                    </div>
                    <div className="flex justify-between items-center py-2.5 px-3 bg-red-50 rounded-lg border border-red-100">
                      <span className="text-sm font-medium text-red-600">Absent</span>
                      <span className="font-mono font-bold text-red-700">{report.attendance?.absent || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Financial Detail */}
                <div>
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2 mb-4">
                    <Wallet size={14} className="text-gray-400" /> Financial Summary
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-2.5 px-3 bg-gray-50 rounded-lg border border-gray-100">
                      <span className="text-sm font-medium text-gray-500">Total Fees</span>
                      <span className="font-mono font-bold text-gray-800">₹{(report.fees?.total || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2.5 px-3 bg-emerald-50 rounded-lg border border-emerald-100">
                      <span className="text-sm font-medium text-emerald-700">Amount Paid</span>
                      <span className="font-mono font-bold text-emerald-800">₹{(report.fees?.paid || 0).toLocaleString()}</span>
                    </div>
                    <div className={`flex justify-between items-center py-2.5 px-3 rounded-lg border ${report.fees?.due > 0 ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"}`}>
                      <span className={`text-sm font-medium ${report.fees?.due > 0 ? "text-red-600" : "text-gray-500"}`}>Outstanding Balance</span>
                      <span className={`font-mono font-bold ${report.fees?.due > 0 ? "text-red-700" : "text-gray-500"}`}>₹{(report.fees?.due || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Academic Performance Table ── */}
            <div className="px-6 sm:px-8 py-5">
              <div className="flex justify-between items-end mb-5">
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                  <BookOpen size={14} className="text-gray-400" /> Academic Performance
                </h3>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Overall Average</div>
                  <div className="text-xl font-black text-slate-800">{report.tests?.percentage || 0}%</div>
                </div>
              </div>

              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="py-3 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Test Name</th>
                      <th className="py-3 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Date</th>
                      <th className="py-3 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Marks</th>
                      <th className="py-3 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Percentage</th>
                      <th className="py-3 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Rank</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Array.isArray(report.tests?.details) && report.tests.details.length > 0 ? report.tests.details.map((t, i) => {
                      const pct = parseFloat(t.percentage);
                      const grade = pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B+" : pct >= 60 ? "B" : pct >= 50 ? "C" : pct >= 33 ? "D" : "F";
                      const gradeColor = pct >= 80 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : pct >= 60 ? "text-blue-700 bg-blue-50 border-blue-200" : pct >= 33 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-red-700 bg-red-50 border-red-200";
                      return (
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3.5 px-3 font-semibold text-gray-800 text-sm">{t.test_name}</td>
                          <td className="py-3.5 px-3 text-gray-500 text-sm">{new Date(t.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                          <td className="py-3.5 px-3 text-right">
                            <span className="font-mono font-bold text-gray-800 text-sm">{t.marks}</span>
                            <span className="text-gray-400 text-xs"> / {t.total_marks}</span>
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${gradeColor}`}>
                              {t.percentage}% · {grade}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 text-xs font-black border border-slate-200">
                              {t.rank !== "N/A" ? t.rank : "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan={5} className="py-12 text-center text-gray-400 font-medium text-sm">No tests recorded in this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="px-6 sm:px-8 py-4 bg-gray-50 border-t border-gray-200 print:bg-white print:border-t-2 print:border-gray-400">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Official computer-generated report · {SCHOOL_NAME}
                </p>
                <p className="text-[10px] font-medium text-gray-400">
                  Generated on {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>
            </div>

          </div>
        </div>
      )}

      </div>
    </div>
  );
}
