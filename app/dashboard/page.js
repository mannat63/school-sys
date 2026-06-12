"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { LayoutDashboard, Users, UserPlus, FileText, Calendar, Wallet, Bell, Target, TrendingUp, AlertTriangle, ArrowUpRight, ChevronRight, Activity, BookOpen } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, LineChart, Line, Legend } from 'recharts';

const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
const BAR_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState(null);
  const [graphs, setGraphs] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testClassFilter, setTestClassFilter] = useState("All");

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

  const testTimelineFormatted = useMemo(() => {
    if (!graphs?.testTimeline) return [];
    const grouped = {};
    const sections = new Set();
    
    // Group by date
    graphs.testTimeline.forEach(t => {
      const date = t.dateFormatted;
      if (!grouped[date]) grouped[date] = { date, fullDate: t.date };
      
      const secName = t.sectionName;
      if (testClassFilter === "All" || t.className === testClassFilter) {
        grouped[date][secName] = t.avgScore;
        sections.add(secName);
      }
    });
    
    return {
      data: Object.values(grouped).sort((a,b) => a.fullDate.localeCompare(b.fullDate)),
      sections: Array.from(sections).sort()
    };
  }, [graphs, testClassFilter]);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const baseData = await fetch("/api/dashboard").then((r) => r.json()).catch(() => ({}));
      
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
        attRiskPromise,
        feeRiskPromise,
        perfRiskPromise,
        graphPromise,
        extraDataPromise
      ]);

      if (baseData?.role === "STUDENT") {
        setStats(baseData);
        setNotifications(Array.isArray(extraData) ? extraData : []);
      } else {
        setStats({ ...baseData, ...(extraData || {}) });
      }

      
      const mappedInsights = {};
      // ... (rest of logic remains same, but filtered by role in JSX)
      if (feeRisk?.success && feeRisk.count > 0) {
         mappedInsights.feeAlert = {
           count: feeRisk.count,
           data: feeRisk.data,
           total_amount: feeRisk.data.reduce((acc, curr) => acc + curr.pendingAmount, 0),
           top_name: feeRisk.data[0].name,
           top_amount: feeRisk.data[0].pendingAmount
         };
      }
      if (attRisk?.success && attRisk.count > 0) {
         mappedInsights.attendanceAlert = attRisk;
      }
      if (perfRisk?.success && perfRisk.count > 0) {
         mappedInsights.testAlert = [{
           section_name: perfRisk.data[0].name + " & others underperforming",
           drop_percentage: perfRisk.data[0].avgMarks
         }];
      }
      if (baseData?.topPerformers) {
        mappedInsights.topPerformers = baseData.topPerformers;
      }
      setInsights(mappedInsights);

      if (baseData?.role === "ADMIN" && graphData && !graphData.error) setGraphs(graphData);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="h-8 w-56 animate-shimmer rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 animate-shimmer rounded-lg" />)}
        </div>
        <div className="h-80 animate-shimmer rounded-lg" />
      </div>
    );
  }

  const cardStyles = {
    "Total Students": { bg: "bg-white", border: "border-gray-200", text: "text-gray-900", label: "text-gray-500", iconBg: "bg-slate-100", iconColor: "text-slate-600" },
    "Fees Collected": { bg: "bg-white", border: "border-gray-200", text: "text-gray-900", label: "text-gray-500", iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
    "Unpaid Dues": { bg: "bg-white", border: "border-gray-200", text: "text-red-600", label: "text-gray-500", iconBg: "bg-red-50", iconColor: "text-red-500" },
    "Present Today": { bg: "bg-white", border: "border-gray-200", text: "text-gray-900", label: "text-gray-500", iconBg: "bg-blue-50", iconColor: "text-blue-600" },
    "Absent Today": { bg: "bg-white", border: "border-gray-200", text: "text-gray-900", label: "text-gray-500", iconBg: "bg-amber-50", iconColor: "text-amber-600" },
    "My Sections": { bg: "bg-white", border: "border-gray-200", text: "text-gray-900", label: "text-gray-500", iconBg: "bg-slate-100", iconColor: "text-slate-600" },
    "My Students": { bg: "bg-white", border: "border-gray-200", text: "text-gray-900", label: "text-gray-500", iconBg: "bg-slate-100", iconColor: "text-slate-600" },
    "Days Present": { bg: "bg-white", border: "border-gray-200", text: "text-gray-900", label: "text-gray-500", iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
    "Total Classes": { bg: "bg-white", border: "border-gray-200", text: "text-gray-900", label: "text-gray-500", iconBg: "bg-gray-100", iconColor: "text-gray-600" },
    "My Subjects": { bg: "bg-white", border: "border-gray-200", text: "text-gray-900", label: "text-gray-500", iconBg: "bg-indigo-50", iconColor: "text-indigo-600" },
  };

  const isAdmin = stats?.role === "ADMIN";
  const isTeacher = stats?.role === "TEACHER";
  const isStudent = stats?.role === "STUDENT";

  const cards = stats ? [
    // ADMIN ONLY stats
    isAdmin && stats.totalStudents !== undefined && { label: "Total Students", value: stats.totalStudents, icon: Users },
    isAdmin && stats.collectedFees !== undefined && { label: "Fees Collected", value: `₹${(stats.collectedFees || 0).toLocaleString()}`, icon: Wallet },
    isAdmin && stats.pendingFees !== undefined && { label: "Unpaid Dues", value: `₹${(stats.pendingFees || 0).toLocaleString()}`, icon: FileText },
    isAdmin && stats.presentToday !== undefined && { label: "Present Today", value: stats.presentToday || 0, icon: Calendar },
    isAdmin && stats.absentToday !== undefined && { label: "Absent Today", value: stats.absentToday || 0, icon: Users },

    // TEACHER ONLY stats
    isTeacher && stats.sectionsCount !== undefined && { label: "My Sections", value: stats.sectionsCount, icon: LayoutDashboard },
    isTeacher && stats.studentCount !== undefined && { label: "My Students", value: stats.studentCount, icon: Users },
    isTeacher && stats.subjectNames !== undefined && { label: "My Subjects", value: stats.subjectNames, icon: BookOpen },

    // STUDENT ONLY stats
    isStudent && stats.pendingFees !== undefined && { label: "Unpaid Dues", value: `₹${(stats.pendingFees || 0).toLocaleString()}`, icon: FileText },
    isStudent && stats.presentCount !== undefined && { label: "Days Present", value: stats.presentCount, icon: Calendar },
    isStudent && stats.totalAttendanceDays !== undefined && { label: "Total Classes", value: stats.totalAttendanceDays, icon: FileText },
  ].filter(Boolean) : [];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">
              {stats?.role === "ADMIN" ? "Management Dashboard" : 
               stats?.role === "TEACHER" ? "Faculty Portal" : 
               "Student Dashboard"}
            </h1>
            {isStudent && stats?.className && (
              <span className="px-3 py-1 bg-slate-800 text-white text-xs font-black uppercase tracking-widest rounded-md shadow-sm">
                {stats.className} - Section {stats.sectionName}
              </span>
            )}
          </div>
          <p className="page-subtitle mt-1">
            {stats?.role === "ADMIN" ? "Comprehensive institutional metrics and operational status." :
             stats?.role === "TEACHER" ? "Track your sections, attendance, and student performance." :
             "Overview of your academic progress and upcoming schedules."}
          </p>
        </div>
        {stats?.role === "ADMIN" && (
          <Link href="/reports" className="btn-primary whitespace-nowrap text-sm">
            <FileText size={15} /> Generate Report
          </Link>
        )}
      </div>

      {/* ─── KPI CARDS ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, idx) => {
          const Icon = c.icon;
          const style = cardStyles[c.label] || cardStyles["Total Classes"];
          return (
            <div key={idx} className={`stat-card ${style.bg} ${style.border} border`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${style.label}`}>{c.label}</div>
                  <div className={`text-2xl font-bold tracking-tight ${style.text}`}>{c.value}</div>
                </div>
                <div className={`p-2 ${style.iconBg} rounded-md`}>
                  <Icon size={18} className={style.iconColor} strokeWidth={1.8} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── ACTION REQUIRED ─── */}
      {insights && stats?.role === "ADMIN" && (insights.feeAlert?.count > 0 || insights.attendanceAlert?.count > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-5">
           <h2 className="text-sm font-semibold text-red-800 flex items-center gap-2 tracking-wide mb-4 uppercase">
             <AlertTriangle size={15} className="text-red-500"/> Action Required
           </h2>
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
             {insights.feeAlert?.count > 0 && (
               <div className="bg-white border border-red-100 p-4 rounded-lg flex flex-col justify-between gap-3 shadow-sm hover:shadow-md transition">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">Overdue Fees Critical Risk ({insights.feeAlert.count})</h3>
                    <div className="mt-2 space-y-1">
                       {insights.feeAlert.data.slice(0, 3).map((student, i) => (
                         <div key={i} className="flex justify-between items-center text-xs">
                           <span className="font-medium text-gray-700">{student.name}</span>
                           <span className="text-red-600 font-bold">₹{student.pendingAmount.toLocaleString()}</span>
                         </div>
                       ))}
                       {insights.feeAlert.count > 3 && (
                         <div className="text-xs text-gray-500 italic">...and {insights.feeAlert.count - 3} more</div>
                       )}
                    </div>
                  </div>
                  <div className="flex justify-end mt-2">
                    <Link href="/students?risk=fees" className="btn-primary !bg-red-600 hover:!bg-red-700 whitespace-nowrap text-xs flex items-center gap-1.5 shadow-sm">
                      <ArrowUpRight size={13}/> View Students
                    </Link>
                  </div>
               </div>
             )}
             {insights.attendanceAlert?.count > 0 && (
               <div className="bg-white border border-red-100 p-4 rounded-lg flex flex-col justify-between gap-3 shadow-sm hover:shadow-md transition">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">Attendance Blacklist ({insights.attendanceAlert.count} &lt; 50%)</h3>
                    <div className="mt-2 space-y-1">
                       {insights.attendanceAlert.data.slice(0, 3).map((student, i) => (
                         <div key={i} className="flex justify-between items-center text-xs">
                           <span className="font-medium text-gray-700">{student.name}</span>
                           <span className="text-red-600 font-bold">{student.percentage}%</span>
                         </div>
                       ))}
                       {insights.attendanceAlert.count > 3 && (
                         <div className="text-xs text-gray-500 italic">...and {insights.attendanceAlert.count - 3} more</div>
                       )}
                    </div>
                  </div>
                  <div className="flex justify-end mt-2">
                    <Link href="/students?risk=attendance" className="btn-primary !bg-red-600 hover:!bg-red-700 whitespace-nowrap text-xs flex items-center gap-1.5 shadow-sm">
                      <ArrowUpRight size={13}/> View Students
                    </Link>
                  </div>
               </div>
             )}
           </div>
        </div>
      )}

      {/* ─── GRAPHS ─── */}
      {graphs && stats?.role === "ADMIN" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Management Profile */}
          <div className="card flex flex-col h-full min-h-[400px] border-slate-200">
            <h3 className="section-heading mb-6 text-slate-800 font-bold border-b border-slate-50 pb-4">
               <Activity size={14} className="text-slate-400" />
               Management Intelligence
            </h3>
            
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              {insights?.feeAlert ? (
                <div className="p-4 border border-red-100 bg-red-50/30 rounded-xl flex items-start gap-3">
                  <div className="mt-0.5 p-2 bg-red-100 text-red-600 rounded-lg shrink-0 shadow-sm">
                    <AlertTriangle size={15} />
                  </div>
                  <div className="text-sm">
                    <p className="font-bold text-slate-900 mb-1 tracking-tight">Revenue Alert</p>
                    <p className="text-slate-600 leading-relaxed">
                      <span className="text-red-700 font-bold underline decoration-red-200 underline-offset-2">{insights.feeAlert.top_name}</span> has an outstanding balance of ₹{insights.feeAlert.top_amount.toLocaleString()}.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-emerald-100 bg-emerald-50/30 rounded-xl flex items-start gap-3">
                  <div className="mt-0.5 p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0 shadow-sm">
                    <Wallet size={15} />
                  </div>
                  <div className="text-sm">
                    <p className="font-bold text-slate-900 mb-1 tracking-tight">Operational Stability</p>
                    <p className="text-slate-600 leading-relaxed">Financial inflows are currently stable. No immediate high-priority defaulters detected.</p>
                  </div>
                </div>
              )}
              
              {graphs?.attendance?.length >= 10 ? (
                (() => {
                  const recent = graphs.attendance.slice(-3);
                  const previous = graphs.attendance.slice(-6, -3);
                  const recentAvg = recent.reduce((a, b) => a + b.presentPct, 0) / recent.length;
                  const previousAvg = previous.reduce((a, b) => a + b.presentPct, 0) / previous.length;
                  
                  if (recentAvg < previousAvg - 5) {
                    return (
                      <div className="p-4 border border-amber-100 bg-amber-50/30 rounded-xl flex items-start gap-3">
                        <div className="mt-0.5 p-2 bg-amber-100 text-amber-700 rounded-lg shrink-0 shadow-sm">
                          <TrendingUp size={15} className="rotate-180" />
                        </div>
                        <div className="text-sm">
                          <p className="font-bold text-slate-900 mb-1 tracking-tight">Attendance Variance</p>
                          <p className="text-slate-600 leading-relaxed">
                            Detected a <span className="text-amber-800 font-bold">{(previousAvg - recentAvg).toFixed(1)}% reduction</span> in student engagement compared to previous reporting window.
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="p-4 border border-blue-100 bg-blue-50/30 rounded-xl flex items-start gap-3">
                      <div className="mt-0.5 p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0 shadow-sm">
                        <TrendingUp size={15} />
                      </div>
                      <div className="text-sm">
                        <p className="font-bold text-slate-900 mb-1 tracking-tight">Engagement Metric</p>
                        <p className="text-slate-600 leading-relaxed">Student attendance trends indicate consistent institutional engagement growth.</p>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-xl flex items-start gap-3">
                  <div className="mt-0.5 p-2 bg-white border border-slate-200 text-slate-400 rounded-lg shrink-0 shadow-sm">
                    <Calendar size={15} />
                  </div>
                  <div className="text-sm">
                    <p className="font-bold text-slate-900 mb-1 tracking-tight">Data Accumulation</p>
                    <p className="text-slate-500 leading-relaxed">Insufficient attendance data for trending. Continuing historical record-keeping.</p>
                  </div>
                </div>
              )}
              
              {insights?.testAlert ? (
                <div className="p-4 border border-slate-200 bg-white rounded-xl flex items-start gap-3 shadow-sm">
                  <div className="mt-0.5 p-2 bg-slate-800 text-white rounded-lg shrink-0 shadow-sm">
                    <Target size={15} />
                  </div>
                  <div className="text-sm">
                    <p className="font-bold text-slate-900 mb-1 tracking-tight">Academic Performance</p>
                    <p className="text-slate-600 leading-relaxed">
                      Performance deviation in <span className="font-bold text-slate-800">{insights.testAlert[0].section_name}</span>. Average scores declined by {insights.testAlert[0].drop_percentage}%.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-slate-200 bg-white rounded-xl flex items-start gap-3 shadow-sm">
                  <div className="mt-0.5 p-2 bg-slate-100 text-slate-600 rounded-lg shrink-0 border border-slate-200">
                    <Target size={15} />
                  </div>
                  <div className="text-sm">
                    <p className="font-bold text-slate-900 mb-1 tracking-tight">Academic Baseline</p>
                    <p className="text-slate-500 leading-relaxed">Performance scores across all sections remain within expected statistical deviations.</p>
                  </div>
                </div>
              )}

              {/* Top Performers Section */}
              {insights?.topPerformers && (
                <div className="p-5 bg-slate-900 text-white rounded-2xl shadow-xl mt-4">
                   <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
                      <TrendingUp size={16} className="text-emerald-400" />
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Institutional Excellence</h4>
                   </div>
                   <div className="space-y-4">
                      {insights.topPerformers.map((tp, i) => (
                        <div key={i} className="flex justify-between items-center group">
                           <div className="min-w-0">
                              <p className="text-[13px] font-bold truncate group-hover:text-emerald-400 transition-colors tracking-tight">{tp.student_name}</p>
                              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-0.5">{tp.section_name}</p>
                           </div>
                           <div className="text-right shrink-0">
                              <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[11px] font-black rounded-full border border-emerald-500/20 shadow-sm italic">
                                 {tp.score}%
                              </div>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              )}
            </div>
          </div>

          {/* Attendance Chart */}
          <div className="card p-6 border-slate-200">
            <h3 className="section-heading mb-6 text-slate-800 font-bold pb-4 border-b border-slate-50">
              <Users size={14} className="text-slate-400"/>
              Longitudinal Attendance Trend
            </h3>
            <div className="h-64 w-full relative min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={graphs.attendance || []}>
                  <defs>
                    <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1e293b" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#1e293b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} tickMargin={15} tick={{ fill: '#94a3b8', fontWeight: 500 }} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} domain={[0, 100]} tick={{ fill: '#94a3b8', fontWeight: 500 }} width={40} />
                  <Tooltip cursor={{ stroke: '#e2e8f0', strokeWidth: 1, strokeDasharray: '4 4' }} contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: '700', padding: '12px' }} />
                  <Area type="monotone" dataKey="presentPct" stroke="#1e293b" strokeWidth={3} fillOpacity={1} fill="url(#colorAttendance)" dot={{ r: 4, fill: '#1e293b', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#1e293b', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Fee Breakdown */}
          <div className="card p-6 border-slate-200 flex flex-col">
            <h3 className="section-heading mb-6 text-slate-800 font-bold pb-4 border-b border-slate-50">
              <Wallet size={14} className="text-slate-400"/>
              Revenue Distribution
            </h3>
            <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-8 min-h-[240px]">
              <div className="h-[220px] w-full max-w-[220px] shrink-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', padding: '10px', fontSize: '11px', fontWeight: '700' }} 
                      formatter={(value) => `₹${value.toLocaleString()}`} 
                    />
                    <Pie
                      data={graphs.feesObj || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={6}
                    >
                      {(graphs.feesObj || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-1 gap-3 w-full sm:w-auto">
                {(graphs.feesObj || []).map((entry, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-50/50 border border-slate-100 min-w-[160px] flex items-center justify-between group hover:bg-white hover:shadow-sm transition-all duration-200">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: entry.fill }} />
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none block mb-1">{entry.name}</span>
                        <div className="text-sm font-black text-slate-900 tracking-tight leading-none italic">
                          ₹{(entry.value || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Academic Performance Over Time */}
          <div className="card p-6 border-slate-200 col-span-1 lg:col-span-2 mt-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 pb-4 border-b border-slate-50 gap-4">
              <h3 className="section-heading text-slate-800 font-bold m-0 w-auto">
                <Target size={14} className="text-slate-400 inline-block mr-2" style={{ verticalAlign: 'middle' }}/>
                Interactive Performance Analysis
              </h3>
              <div className="flex items-center gap-2 relative z-20">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Filter Class:</label>
                <select 
                  className="input-field !py-1.5 !px-3 !min-h-0 !text-sm !w-auto bg-slate-50 border-slate-200 font-semibold text-slate-700 shadow-sm cursor-pointer"
                  value={testClassFilter}
                  onChange={(e) => setTestClassFilter(e.target.value)}
                >
                  {testClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="w-full">
              {/* By Section Bar Chart */}
              <div>
                <div style={{ height: Math.max(280, (filteredTests.length || 5) * 40) }} className="w-full relative mt-4">
                  {filteredTests.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={filteredTests} layout="vertical" margin={{ left: -10, right: 35, top: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" horizontal={false} vertical={true} />
                        <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(val) => `${val}%`} tick={{ fill: '#cbd5e1', fontWeight: 600 }} />
                        <YAxis type="category" dataKey="name" fontSize={10} tickLine={false} axisLine={false} tickMargin={8} width={110} tick={{ fill: '#475569', fontWeight: 600 }} formatter={(v) => testClassFilter !== 'All' ? v.split(' - ')[1] : v} />
                        <Tooltip
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: '10px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: '600' }}
                          formatter={(v) => [`${v}%`, 'Avg Score']}
                        />
                        <Bar dataKey="avgScore" radius={[0, 5, 5, 0]} maxBarSize={20}>
                          {filteredTests.map((entry, index) => (
                            <Cell key={`bar-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} fillOpacity={0.85} />
                          ))}
                          <LabelList dataKey="avgScore" position="right" formatter={(v) => `${v}%`} style={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200 h-[280px]">
                      <p className="text-sm font-medium text-slate-400">No data available for {testClassFilter !== 'All' ? `Class ${testClassFilter}` : 'any class'}.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ─── STUDENT NOTIFICATIONS ─── */}
      {isStudent && (
        <div className="card p-6 border-slate-200 mt-6">
          <h3 className="section-heading mb-6 text-slate-800 font-bold pb-4 border-b border-slate-50 flex items-center gap-2">
            <Bell size={16} className="text-slate-400" />
            Recent Alerts & Notifications
          </h3>
          <div className="space-y-4">
            {notifications.length > 0 ? (
              notifications.map((notif, index) => {
                const isFee = notif.type === "FEE_REMINDER";
                const isTest = notif.type === "TEST_RESULT_ALERT";
                const isAttendance = notif.type === "ATTENDANCE_ALERT";
                const isReport = notif.type === "REPORT_CARD";
                const showPayNow = isFee;
                const showReportIssue = isTest || isAttendance || isReport;
                
                const iconColorMap = {
                  "FEE_REMINDER": "bg-amber-100 text-amber-600",
                  "TEST_RESULT_ALERT": "bg-purple-100 text-purple-600",
                  "ATTENDANCE_ALERT": "bg-red-100 text-red-600",
                  "REPORT_CARD": "bg-blue-100 text-blue-600",
                };
                const borderMap = {
                  "FEE_REMINDER": "border-amber-100 bg-amber-50/20",
                  "TEST_RESULT_ALERT": "border-purple-100 bg-purple-50/20",
                  "ATTENDANCE_ALERT": "border-red-100 bg-red-50/20",
                  "REPORT_CARD": "border-blue-100 bg-blue-50/20",
                };

                return (
                  <div key={index} className={`p-4 border rounded-xl shadow-sm transition hover:shadow-md ${borderMap[notif.type] || "border-slate-100 bg-slate-50/20"}`}>
                    <div className="flex items-start gap-4">
                      <div className={`mt-0.5 p-2 rounded-lg shrink-0 ${iconColorMap[notif.type] || "bg-slate-100 text-slate-600"}`}>
                        <Bell size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 text-sm mb-1">{notif.type.replace(/_/g, " ")}</h4>
                        <p className="text-slate-600 text-sm leading-relaxed">{notif.message}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">{new Date(notif.created_at || new Date()).toLocaleString()}</p>
                      </div>
                    </div>
                    {/* CTA Buttons */}
                    {(showPayNow || showReportIssue) && (
                      <div className="mt-3 pt-3 border-t border-black/5 flex items-center justify-end gap-2">
                        {showPayNow && (
                          <a 
                            href={notif.action_link || "/fees"}
                            target={notif.action_link ? "_blank" : "_self"}
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider rounded-md transition-colors shadow-sm"
                          >
                            Pay Now
                          </a>
                        )}
                        {showReportIssue && (
                          <a 
                            href="https://wa.me/919509728788?text=I%20want%20to%20report%20an%20issue%20with%20my%20records"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 bg-white text-slate-600 text-[11px] font-bold uppercase tracking-wider rounded-md hover:bg-slate-50 hover:border-slate-300 transition-all"
                          >
                            Report Issue
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 text-slate-400 font-medium text-sm border-2 border-dashed border-slate-100 rounded-xl">
                No recent notifications found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
