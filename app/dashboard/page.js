"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  LayoutDashboard, Users, UserPlus, FileText, Calendar, Wallet, Bell, Target,
  TrendingUp, TrendingDown, AlertTriangle, ArrowUpRight, ChevronRight, Activity,
  BookOpen, Search, GraduationCap, CalendarCheck, BarChart3, Award, Zap,
  ShieldAlert, Eye
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, LabelList, LineChart, Line, Legend
} from "recharts";
import DirectorDashboard from "@/components/DirectorDashboard";

const COLORS = ["#10b981","#ef4444","#3b82f6","#f59e0b","#8b5cf6","#ec4899","#06b6d4"];
const BAR_COLORS = ["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4","#ec4899"];
const AVATAR_COLORS = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#06b6d4","#3b82f6","#ef4444"];

function PctRing({ pct, size = 48, stroke = 4, color }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * Math.min(pct || 0, 100)) / 100;
  const c = color || (pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444");
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        className="text-[10px] font-bold" fill={c}>
        {pct != null ? `${Math.round(pct)}%` : "—"}
      </text>
    </svg>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState(null);
  const [graphs, setGraphs] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testClassFilter, setTestClassFilter] = useState("All");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teacherSectionFilter, setTeacherSectionFilter] = useState("ALL");

  const testClasses = useMemo(() => {
    if (!graphs?.tests) return [];
    const classes = new Set();
    graphs.tests.forEach(t => {
      const cname = t.name.split(" - ")[0];
      if (cname) classes.add(cname);
    });
    return ["All", ...Array.from(classes).sort()];
  }, [graphs]);

  const filteredTests = useMemo(() => {
    if (!graphs?.tests) return [];
    if (testClassFilter === "All") return graphs.tests;
    return graphs.tests.filter(t => t.name.startsWith(testClassFilter + " -"));
  }, [graphs, testClassFilter]);

  // Teacher-specific memos — must be at top level (Rules of Hooks)
  const filteredStudents = useMemo(() => {
    let list = stats?.students || [];
    if (teacherSectionFilter !== "ALL") {
      list = list.filter(s => s.sectionName === teacherSectionFilter);
    }
    if (teacherSearch.trim()) {
      const q = teacherSearch.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q));
    }
    return list;
  }, [stats, teacherSearch, teacherSectionFilter]);

  const sectionNames = useMemo(() => {
    if (!stats?.students) return [];
    return [...new Set(stats.students.map(s => `${s.className} - ${s.sectionName}`))].sort();
  }, [stats]);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    try {
      const baseData = await fetch("/api/dashboard").then(r => r.json()).catch(() => ({}));

      let extraDataPromise = Promise.resolve(null);
      let graphPromise = Promise.resolve(null);
      let attRiskPromise = Promise.resolve(null);
      let feeRiskPromise = Promise.resolve(null);
      let perfRiskPromise = Promise.resolve(null);

      if (baseData?.role === "ADMIN") {
        extraDataPromise = fetch("/api/dashboard/summary").then(r => r.ok ? r.json() : {});
        graphPromise = fetch("/api/dashboard/graphs").then(r => r.ok ? r.json() : null).catch(() => null);
        attRiskPromise = fetch("/api/insights/attendance-risk").then(r => r.ok ? r.json() : null).catch(() => null);
        feeRiskPromise = fetch("/api/insights/fee-defaulters").then(r => r.ok ? r.json() : null).catch(() => null);
        perfRiskPromise = fetch("/api/insights/performance-risk").then(r => r.ok ? r.json() : null).catch(() => null);
      } else if (baseData?.role === "STUDENT") {
        extraDataPromise = fetch("/api/notifications").then(r => r.ok ? r.json() : []);
      }

      const [attRisk, feeRisk, perfRisk, graphData, extraData] = await Promise.all([
        attRiskPromise, feeRiskPromise, perfRiskPromise, graphPromise, extraDataPromise
      ]);

      if (baseData?.role === "STUDENT") {
        setStats(baseData);
        setNotifications(Array.isArray(extraData) ? extraData : []);
      } else {
        setStats({ ...baseData, ...(extraData || {}) });
      }

      const mappedInsights = {};
      if (feeRisk?.success && feeRisk.count > 0) {
        mappedInsights.feeAlert = {
          count: feeRisk.count, data: feeRisk.data,
          total_amount: feeRisk.data.reduce((acc, curr) => acc + curr.pendingAmount, 0),
          top_name: feeRisk.data[0].name, top_amount: feeRisk.data[0].pendingAmount
        };
      }
      if (attRisk?.success && attRisk.count > 0) mappedInsights.attendanceAlert = attRisk;
      if (perfRisk?.success && perfRisk.count > 0) {
        mappedInsights.testAlert = [{ section_name: perfRisk.data[0].name + " & others underperforming", drop_percentage: perfRisk.data[0].avgMarks }];
      }
      if (baseData?.topPerformers) mappedInsights.topPerformers = baseData.topPerformers;
      setInsights(mappedInsights);

      if (baseData?.role === "ADMIN" && graphData && !graphData.error) setGraphs(graphData);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-0">
        <div className="h-8 w-56 animate-shimmer rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 animate-shimmer rounded-2xl" />)}
        </div>
        <div className="h-80 animate-shimmer rounded-2xl" />
      </div>
    );
  }

  if (stats?.role === "ADMIN") return <DirectorDashboard />;

  const isTeacher = stats?.role === "TEACHER";
  const isStudent = stats?.role === "STUDENT";

  // ─── TEACHER DASHBOARD ───────────────────────────────────────────────
  if (isTeacher) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 pb-2 px-4 sm:px-0">
        {/* Header Removed - Now in global layout */}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "My Sections", value: stats.sectionsCount || 0, Icon: LayoutDashboard },
            { label: "My Students", value: stats.studentCount || 0, Icon: Users },
            { label: "Low Attendance", value: stats.lowAttendanceCount || 0, Icon: AlertTriangle },
            { label: "Tests", value: stats.testsCount || 0, Icon: FileText },
          ].map((c, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-[24px] p-5 flex flex-col justify-between transition-all duration-300 hover:translate-y-[-2px] text-gray-800" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
                  <c.Icon size={16} strokeWidth={2} />
                </div>
                <span className="text-[12px] font-bold text-gray-500 tracking-wide">{c.label}</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-bold tracking-tight text-slate-900">{c.value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Batch Performance */}
        {stats.sections?.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.03)' }}>
            <div className="px-4 sm:px-6 py-4 border-b border-gray-50 flex items-center gap-3">
              <div className="icon-badge-sm icon-badge-indigo">
                <BarChart3 size={15} strokeWidth={2} />
              </div>
              <h2 className="text-[14px] font-bold text-gray-900">Batch Performance</h2>
            </div>
            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {stats.sections.map((sec, i) => (
                <div key={i} className="border border-gray-100 rounded-2xl p-4 flex items-center justify-between hover:bg-amber-50/20 transition-all">
                  <div>
                    <div className="text-sm font-bold text-gray-900">{sec.className} - {sec.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{sec.studentCount} students</div>
                  </div>
                  <PctRing pct={sec.avgPerformance} size={44} stroke={3} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Student List with Scores */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.03)' }}>
          <div className="px-4 sm:px-6 py-4 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="icon-badge-sm icon-badge-blue">
                <Users size={15} strokeWidth={2} />
              </div>
              <h2 className="text-[14px] font-bold text-gray-900">Student Details</h2>
              <span className="text-[11px] text-gray-400 font-semibold">{filteredStudents.length}</span>
            </div>
            <div className="flex gap-2 sm:ml-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={teacherSearch}
                  onChange={e => setTeacherSearch(e.target.value)}
                  className="w-full sm:w-48 pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-amber-400/50 outline-none"
                  placeholder="Search student..."
                />
              </div>
              <select
                value={teacherSectionFilter}
                onChange={e => setTeacherSectionFilter(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-600 focus:ring-1 focus:ring-amber-400/50 outline-none"
              >
                <option value="ALL">All Sections</option>
                {sectionNames.map(sn => <option key={sn} value={sn.split(" - ")[1]}>{sn}</option>)}
              </select>
            </div>
          </div>

          {/* Mobile: Card view */}
          <div className="sm:hidden p-3 space-y-2">
            {filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-400">No students found.</div>
            ) : filteredStudents.map((s, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ backgroundColor: AVATAR_COLORS[s.name.charCodeAt(0) % AVATAR_COLORS.length] }}>
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900 truncate">{s.name}</div>
                  <div className="text-[10px] text-gray-400">{s.className} - {s.sectionName}</div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <div className="text-center">
                    <div className={`text-xs font-bold ${s.avgScore != null ? (s.avgScore >= 60 ? "text-emerald-600" : "text-red-600") : "text-gray-300"}`}>
                      {s.avgScore != null ? `${s.avgScore}%` : "—"}
                    </div>
                    <div className="text-[8px] text-gray-400 uppercase">Score</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-xs font-bold ${s.attendancePct != null ? (s.attendancePct >= 75 ? "text-emerald-600" : "text-red-600") : "text-gray-300"}`}>
                      {s.attendancePct != null ? `${s.attendancePct}%` : "—"}
                    </div>
                    <div className="text-[8px] text-gray-400 uppercase">Att.</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Table view */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider px-6 py-3">Student</th>
                  <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 py-3">Section</th>
                  <th className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 py-3">Avg Score</th>
                  <th className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 py-3">Attendance</th>
                  <th className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-sm text-gray-400">No students found.</td></tr>
                ) : filteredStudents.map((s, i) => {
                  const risk = (s.avgScore != null && s.avgScore < 50) || (s.attendancePct != null && s.attendancePct < 75);
                  return (
                    <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${risk ? "bg-red-50/20" : ""}`}>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ backgroundColor: AVATAR_COLORS[s.name.charCodeAt(0) % AVATAR_COLORS.length] }}>
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-[12px] font-bold text-gray-900">{s.name}</div>
                            <div className="text-[10px] text-gray-400">{s.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-gray-600 font-medium">{s.className} - {s.sectionName}</td>
                      <td className="px-4 py-3 text-center">
                        {s.avgScore != null ? (
                          <span className={`text-[12px] font-bold ${s.avgScore >= 70 ? "text-emerald-600" : s.avgScore >= 50 ? "text-amber-600" : "text-red-600"}`}>{s.avgScore}%</span>
                        ) : <span className="text-[11px] text-gray-300">No tests</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.attendancePct != null ? (
                          <span className={`text-[12px] font-bold ${s.attendancePct >= 75 ? "text-emerald-600" : s.attendancePct >= 50 ? "text-amber-600" : "text-red-600"}`}>{s.attendancePct}%</span>
                        ) : <span className="text-[11px] text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {risk ? (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full border border-red-200">AT RISK</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Risk Alert */}
        {(stats.lowAttendanceCount || 0) > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
            <div className="icon-badge-sm icon-badge-red flex-shrink-0">
              <ShieldAlert size={15} />
            </div>
            <div className="text-sm">
              <p className="font-bold text-red-800">{stats.lowAttendanceCount} students below 75% attendance</p>
              <p className="text-red-600 text-xs mt-0.5">Consider reaching out to these students or their parents.</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── STUDENT DASHBOARD ───────────────────────────────────────────────
  if (isStudent) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 pb-2 px-4 sm:px-0">
        {/* Header - H1 removed, kept section info */}
        <div className="flex justify-end mb-2">
          <span className="px-3.5 py-1.5 bg-gray-900 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-sm">
            {stats?.className} - {stats?.sectionName}
          </span>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Attendance", value: stats.attendancePct != null ? `${stats.attendancePct}%` : `${stats.presentCount}/${stats.totalAttendanceDays}`, Icon: CalendarCheck },
            { label: "Avg Marks", value: stats.avgMarks != null ? `${stats.avgMarks}%` : "—", Icon: BarChart3 },
            { label: "Section Rank", value: stats.rank ? `#${stats.rank}` : "—", Icon: Award, sub: stats.totalInSection ? `of ${stats.totalInSection}` : null },
            { label: "Pending Fees", value: `₹${(stats.pendingFees || 0).toLocaleString()}`, Icon: Wallet },
          ].map((c, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-[24px] p-5 flex flex-col justify-between transition-all duration-300 hover:translate-y-[-2px] text-gray-800" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
                  <c.Icon size={16} strokeWidth={2} />
                </div>
                <span className="text-[12px] font-bold text-gray-500 tracking-wide">{c.label}</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-bold tracking-tight text-slate-900">{c.value}</span>
              </div>
              {c.sub && <div className="text-[10px] text-slate-400 font-semibold mt-1">{c.sub}</div>}
            </div>
          ))}
        </div>

        {/* Strong & Weak Topics + Upcoming Tests */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Strong Topics */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden flex flex-col h-full" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.03)' }}>
            <div className="px-4 sm:px-5 py-3.5 border-b border-gray-50 flex items-center gap-2.5">
              <div className="icon-badge-sm icon-badge-green">
                <TrendingUp size={14} />
              </div>
              <h2 className="text-[13px] font-bold text-gray-900">Strong Topics</h2>
            </div>
            <div className="p-4 space-y-2 flex-1 flex flex-col justify-center">
              {stats.strongTopics?.length > 0 ? stats.strongTopics.map((t, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <span className="text-sm font-medium text-gray-800">{t.name}</span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">{t.avgPct}%</span>
                </div>
              )) : <div className="text-sm text-gray-400 text-center py-4">Take tests to see your strong subjects</div>}
            </div>
          </div>

          {/* Weak Topics */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden flex flex-col h-full" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.03)' }}>
            <div className="px-4 sm:px-5 py-3.5 border-b border-gray-50 flex items-center gap-2.5">
              <div className="icon-badge-sm icon-badge-red">
                <TrendingDown size={14} />
              </div>
              <h2 className="text-[13px] font-bold text-gray-900">Needs Improvement</h2>
            </div>
            <div className="p-4 space-y-2 flex-1 flex flex-col justify-center">
              {stats.weakTopics?.length > 0 ? stats.weakTopics.map((t, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <span className="text-sm font-medium text-gray-800">{t.name}</span>
                  <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full">{t.avgPct}%</span>
                </div>
              )) : <div className="text-sm text-gray-400 text-center py-4">No weak areas detected</div>}
            </div>
          </div>

          {/* Upcoming Tests */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden flex flex-col h-full" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.03)' }}>
            <div className="px-4 sm:px-5 py-3.5 border-b border-gray-50 flex items-center gap-2.5">
              <div className="icon-badge-sm icon-badge-indigo">
                <Calendar size={14} />
              </div>
              <h2 className="text-[13px] font-bold text-gray-900">Upcoming Tests</h2>
            </div>
            <div className="p-4 space-y-2 flex-1 flex flex-col justify-center">
              {stats.upcomingTests?.length > 0 ? stats.upcomingTests.map((t, i) => {
                const d = new Date(t.date);
                const diff = Math.ceil((d - new Date()) / 86400000);
                return (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div>
                      <div className="text-sm font-bold text-gray-900">{t.name}</div>
                      <div className="text-[10px] text-gray-400">{t.subjectCount} subject{t.subjectCount !== 1 ? "s" : ""}</div>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${diff <= 1 ? "bg-red-100 text-red-700" : diff <= 3 ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                      {diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : `${diff} days`}
                    </span>
                  </div>
                );
              }) : <div className="text-sm text-gray-400 text-center py-4">No upcoming tests</div>}
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.03)' }}>
          <div className="px-4 sm:px-6 py-4 border-b border-gray-50 flex items-center gap-2.5">
            <div className="icon-badge-sm icon-badge-amber">
              <Bell size={14} />
            </div>
            <h2 className="text-[14px] font-bold text-gray-900">Notifications</h2>
          </div>
          <div className="p-4 sm:p-6 space-y-3">
            {notifications.length > 0 ? (
              notifications.slice(0, 5).map((notif, i) => {
                const isFee = notif.type === "FEE_REMINDER";
                const borderMap = {
                  FEE_REMINDER: "border-amber-100 bg-amber-50/20",
                  TEST_RESULT_ALERT: "border-purple-100 bg-purple-50/20",
                  ATTENDANCE_ALERT: "border-red-100 bg-red-50/20",
                  REPORT_CARD: "border-blue-100 bg-blue-50/20",
                };
                return (
                  <div key={i} className={`p-3 sm:p-4 border rounded-2xl ${borderMap[notif.type] || "border-gray-100"}`}>
                    <div className="flex items-start gap-3">
                      <Bell size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 text-xs sm:text-sm">{notif.type.replace(/_/g, " ")}</h4>
                        <p className="text-gray-600 text-xs sm:text-sm mt-0.5 leading-relaxed">{notif.message}</p>
                      </div>
                    </div>
                    {isFee && (
                      <div className="mt-2 flex justify-end">
                        <a href={notif.action_link || "/fees"} className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white text-[10px] font-bold rounded-xl">Pay Now</a>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-2xl">No recent notifications</div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Attendance", href: "/attendance", Icon: CalendarCheck, badgeClass: "icon-badge-blue" },
            { label: "Tests", href: "/tests", Icon: FileText, badgeClass: "icon-badge-purple" },
            { label: "Homework", href: "/homework", Icon: BookOpen, badgeClass: "icon-badge-amber" },
            { label: "Report Card", href: "/reports", Icon: Award, badgeClass: "icon-badge-green" },
          ].map((a, i) => (
            <Link key={i} href={a.href} className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-gray-100 hover:translate-y-[-2px] transition-all duration-200" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.03)' }}>
              <div className={`icon-badge-sm ${a.badgeClass}`}>
                <a.Icon size={15} />
              </div>
              <span className="text-xs sm:text-sm font-bold text-gray-800">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // ─── FALLBACK (shouldn't reach here) ──────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 py-12 text-center text-gray-500">
      <p>Loading dashboard...</p>
    </div>
  );
}
