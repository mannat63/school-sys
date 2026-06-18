"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  UserPlus, IndianRupee, TrendingUp, TrendingDown, Target, AlertTriangle,
  Users, BarChart3, GraduationCap, ArrowUpRight, ArrowDownRight,
  ChevronRight, Lightbulb, ShieldAlert, BookOpen, Activity,
  Layers, CircleDollarSign, Percent, AlertCircle, CheckCircle2,
  XCircle, Clock, Brain, Eye
} from "lucide-react";
import SmartInsights from "@/components/SmartInsights";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LabelList, LineChart, Line, Legend, RadialBarChart, RadialBar,
} from "recharts";

const BATCH_COLORS = ["#1e1b4b", "#312e81", "#3730a3", "#4338ca", "#4f46e5", "#6366f1", "#818cf8"];

function formatCurrency(amount) {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

function GrowthBadge({ value }) {
  if (value === 0) return <span className="text-[10px] font-bold text-gray-400 ml-1">—</span>;
  const isPositive = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${isPositive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
      {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      {Math.abs(value)}%
    </span>
  );
}

function RiskBadge({ score }) {
  const styles = {
    HIGH: "bg-red-100 text-red-700 border-red-200",
    MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
    LOW: "bg-blue-100 text-blue-700 border-blue-200",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${styles[score] || styles.LOW}`}>
      {score}
    </span>
  );
}

function OccupancyBar({ percentage }) {
  const color = percentage >= 80 ? "bg-emerald-400" : percentage >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ease-out ${color}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, className = "" }) {
  return (
    <div className={`bg-white border border-gray-100 rounded-2xl overflow-hidden ${className}`} style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.03)' }}>
      <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-3">
        <div className="icon-badge-sm icon-badge-slate">
          <Icon size={15} strokeWidth={2} />
        </div>
        <h2 className="text-[16px] font-extrabold text-gray-900 tracking-tight">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export default function DirectorDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [batchSort, setBatchSort] = useState("occupancy");

  useEffect(() => {
    fetch("/api/dashboard/director")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setData(res.data);
        else setError(res.error || "Failed to load");
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  const filteredRiskStudents = useMemo(() => {
    if (!data?.studentRisk?.students) return [];
    if (riskFilter === "ALL") return data.studentRisk.students;
    return data.studentRisk.students.filter((s) => s.riskScore === riskFilter);
  }, [data, riskFilter]);

  const sortedBatches = useMemo(() => {
    if (!data?.batchIntelligence) return [];
    const sorted = [...data.batchIntelligence];
    if (batchSort === "occupancy") sorted.sort((a, b) => b.occupancyPct - a.occupancyPct);
    else if (batchSort === "revenue") sorted.sort((a, b) => b.totalRevenue - a.totalRevenue);
    else if (batchSort === "attendance") sorted.sort((a, b) => b.avgAttendancePct - a.avgAttendancePct);
    else if (batchSort === "performance") sorted.sort((a, b) => b.avgTestPerformancePct - a.avgTestPerformancePct);
    return sorted;
  }, [data, batchSort]);

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-6 pb-12">
        <div className="h-8 w-64 animate-shimmer rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-28 animate-shimmer rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 animate-shimmer rounded-xl" />
          <div className="h-80 animate-shimmer rounded-xl" />
        </div>
        <div className="h-64 animate-shimmer rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1400px] mx-auto flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { kpi, admissionFunnel, revenueAnalytics, batchIntelligence, studentRisk, examAnalytics, leadCRM, directorInsights } = data;

  const kpiCards = [
    {
      label: "Admissions",
      value: kpi.admissions.count,
      growth: kpi.admissions.growthPct,
      icon: UserPlus,
    },
    {
      label: "Revenue",
      value: formatCurrency(kpi.revenue.amount),
      growth: kpi.revenue.growthPct,
      icon: IndianRupee,
    },
    {
      label: "Lead Conversion",
      value: `${kpi.leadConversion.rate}%`,
      icon: Target,
    },
    {
      label: "Occupancy",
      value: `${kpi.batchOccupancy.percentage}%`,
      icon: Layers,
    },
    {
      label: "Pending Fees",
      value: formatCurrency(kpi.outstandingFees.amount),
      icon: CircleDollarSign,
    },
    {
      label: "At Risk",
      value: kpi.studentsAtRisk.count,
      icon: ShieldAlert,
    },
  ];

  // Fee collection donut data
  const feeDonut = [
    { name: "Collected", value: revenueAnalytics.feeCollection.totalCollected, fill: "#10b981" },
    { name: "Outstanding", value: revenueAnalytics.feeCollection.totalOutstanding, fill: "#ef4444" },
  ].filter((d) => d.value > 0);

  const totalFeeExpected = revenueAnalytics.feeCollection.totalExpected;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-4">
      {/* ─── ACTION BAR ─── */}
      <div className="flex justify-end gap-2 mb-4">
        <Link href="/reports" className="btn-secondary whitespace-nowrap text-xs !py-2 !px-3.5">
          <BarChart3 size={13} /> Reports
        </Link>
        <Link href="/students" className="btn-primary whitespace-nowrap text-xs !py-2 !px-3.5">
          <Users size={13} /> Students
        </Link>
      </div>

      {/* ─── KPI ROW ─── */}
      <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
        {kpiCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-white border border-gray-100 rounded-[24px] p-5 flex flex-col justify-between transition-all duration-300 hover:translate-y-[-2px] text-gray-800" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
                  <Icon size={16} strokeWidth={2} />
                </div>
                <span className="text-[12px] font-bold text-gray-500 tracking-wide">{card.label}</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-bold tracking-tight text-slate-900">{card.value}</span>
                {card.growth !== undefined && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${card.growth >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    {card.growth >= 0 ? '↑' : '↓'} {Math.abs(card.growth)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── LEADS CRM OVERVIEW ─── */}
      {leadCRM && (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.03)' }}>
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="icon-badge-sm icon-badge-indigo">
                <UserPlus size={15} strokeWidth={2} />
              </div>
              <h2 className="text-[14px] font-bold text-gray-900 tracking-tight">Leads Pipeline</h2>
              <span className="text-[11px] font-semibold text-gray-400">{leadCRM.total} total</span>
            </div>
            <Link href="/leads" className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              View CRM <ChevronRight size={12} />
            </Link>
          </div>
          <div className="p-6">
            {/* Horizontal Pipeline Funnel */}
            <div className="flex items-stretch gap-1.5 mb-6">
              {leadCRM.pipeline.map((stage, i) => {
                const maxCount = Math.max(...leadCRM.pipeline.map(s => s.count), 1);
                const isActive = stage.count > 0;
                // Monochrome blue-slate palette based on index
                const palette = ["#0f172a", "#1e293b", "#334155", "#475569", "#64748b", "#94a3b8", "#cbd5e1"];
                const color = palette[i % palette.length];
                
                return (
                  <div key={i} className="flex-1 relative flex flex-col group">
                    <div className="h-11 flex items-center justify-center relative z-10 transition-all" style={{
                      backgroundColor: isActive ? color : "#f8fafc",
                      borderRadius: '12px',
                      boxShadow: isActive ? 'inset 0 2px 4px rgba(255,255,255,0.1)' : 'none',
                    }}>
                      <span className={`text-[13px] font-bold ${isActive ? "text-white" : "text-slate-400"}`}>
                        {stage.count}
                      </span>
                    </div>
                    <div className="pt-2 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block truncate px-1">{stage.stage}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Conversion Rate</span>
                  <div className="text-xl font-black text-emerald-600 leading-none mt-1">{leadCRM.conversionRate}%</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Converted</span>
                  <div className="text-xl font-black text-gray-800 leading-none mt-1">{leadCRM.converted}</div>
                </div>
              </div>
              <Link
                href="/leads"
                className="btn-primary text-[12px] !py-2 !px-4"
              >
                <UserPlus size={14} /> Add Lead
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ─── SMART INSIGHTS ─── */}
      <SmartInsights />

      {/* ─── ADMISSION FUNNEL + REVENUE TREND ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Admission Funnel */}
        <SectionCard title="Admission Trend" icon={UserPlus}>
          {admissionFunnel && admissionFunnel.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={admissionFunnel}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontWeight: 600 }} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontWeight: 600 }} width={30} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 40px rgba(0,0,0,0.08)", fontSize: "12px", fontWeight: "600" }}
                    formatter={(v) => [v, "Admissions"]}
                    cursor={{ fill: 'transparent' }}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 8, 8]} maxBarSize={32} background={{ fill: '#f1f5f9', radius: [8, 8, 8, 8] }}>
                    <LabelList dataKey="count" position="top" style={{ fontSize: 10, fontWeight: 700, fill: "#475569" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400">No admission data available</div>
          )}
        </SectionCard>

        {/* Revenue Trend */}
        <SectionCard title="Revenue Trend" icon={TrendingUp}>
          {revenueAnalytics?.trend && revenueAnalytics.trend.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueAnalytics.trend}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                  <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontWeight: 600 }} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(v)} tick={{ fill: "#94a3b8", fontWeight: 600 }} width={55} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 40px rgba(0,0,0,0.08)", fontSize: "12px", fontWeight: "600" }}
                    formatter={(v) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#revGrad)" dot={{ r: 4, fill: "#white", stroke: "#3b82f6", strokeWidth: 2 }} activeDot={{ r: 6, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400">No revenue data available</div>
          )}
        </SectionCard>
      </div>

      {/* ─── FEE COLLECTION + OUTSTANDING BY BATCH ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Fee Collection Overview */}
        <div className="lg:col-span-2">
          <SectionCard title="Fee Collection Forecast" icon={CircleDollarSign} className="h-full">
            <div className="flex flex-col items-center gap-4">
              {/* Donut */}
              <div className="relative h-[180px] w-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={feeDonut} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none" cornerRadius={4}>
                      {feeDonut.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "11px", fontWeight: "600" }}
                      formatter={(v) => [`₹${v.toLocaleString("en-IN")}`, ""]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Total</span>
                  <span className="text-sm font-bold text-gray-900">{formatCurrency(totalFeeExpected)}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="w-full space-y-2.5">
                <div className="flex items-center justify-between p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold text-gray-600">Collected</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-700">{formatCurrency(revenueAnalytics.feeCollection.totalCollected)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-red-50/50 border border-red-100 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-xs font-semibold text-gray-600">Outstanding</span>
                  </div>
                  <span className="text-xs font-bold text-red-600">{formatCurrency(revenueAnalytics.feeCollection.totalOutstanding)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Collection Rate</span>
                  <span className="text-xs font-bold text-gray-800">
                    {totalFeeExpected ? Math.round((revenueAnalytics.feeCollection.totalCollected / totalFeeExpected) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Outstanding by Batch */}
        <div className="lg:col-span-3">
          <SectionCard title="Outstanding Fees by Batch" icon={AlertTriangle} className="h-full">
            {revenueAnalytics?.outstandingByBatch?.filter((b) => b.outstanding > 0).length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={revenueAnalytics.outstandingByBatch.filter((b) => b.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding)}
                    layout="vertical"
                    margin={{ left: 0, right: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(v)} tick={{ fill: "#94a3b8", fontWeight: 600 }} />
                    <YAxis type="category" dataKey="className" fontSize={10} tickLine={false} axisLine={false} width={80} tick={{ fill: "#475569", fontWeight: 600 }} tickFormatter={(v, i) => {
                      const item = revenueAnalytics.outstandingByBatch.filter((b) => b.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding)[i];
                      return item ? `${item.className} ${item.sectionName}` : v;
                    }} />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 40px rgba(0,0,0,0.08)", fontSize: "11px", fontWeight: "600" }}
                      formatter={(v) => [`₹${v.toLocaleString("en-IN")}`, "Outstanding"]}
                      cursor={{ fill: 'transparent' }}
                    />
                    <Bar dataKey="outstanding" fill="#f43f5e" radius={[8, 8, 8, 8]} maxBarSize={16} background={{ fill: '#f1f5f9', radius: [8, 8, 8, 8] }}>
                      <LabelList dataKey="outstanding" position="right" formatter={(v) => formatCurrency(v)} style={{ fontSize: 10, fontWeight: 700, fill: "#475569" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 font-medium">No outstanding fees</p>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* ─── BATCH INTELLIGENCE ─── */}
      <SectionCard title="Batch Intelligence" icon={Layers}>
        <div className="flex items-center gap-2 mb-5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sort by:</span>
          {[
            { key: "occupancy", label: "Occupancy" },
            { key: "revenue", label: "Revenue" },
            { key: "attendance", label: "Attendance" },
            { key: "performance", label: "Performance" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setBatchSort(s.key)}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                batchSort === s.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Batch</th>
                <th className="pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Students</th>
                <th className="pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-40">Occupancy</th>
                <th className="pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Revenue</th>
                <th className="pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Attendance</th>
                <th className="pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Performance</th>
              </tr>
            </thead>
            <tbody>
              {sortedBatches.map((batch, i) => {
                const occColor = batch.occupancyPct >= 80 ? "text-emerald-600" : batch.occupancyPct >= 50 ? "text-amber-600" : "text-red-600";
                const attColor = batch.avgAttendancePct >= 75 ? "text-emerald-600" : batch.avgAttendancePct >= 50 ? "text-amber-600" : "text-red-600";
                const perfColor = batch.avgTestPerformancePct >= 60 ? "text-emerald-600" : batch.avgTestPerformancePct >= 40 ? "text-amber-600" : "text-red-600";
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3.5">
                      <div>
                        <span className="text-[12px] font-bold text-gray-900">{batch.className}</span>
                        <span className="text-[11px] text-gray-400 ml-1.5">Sec {batch.sectionName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 text-center">
                      <span className="text-[12px] font-bold text-gray-800">{batch.studentCount}</span>
                      <span className="text-[10px] text-gray-400">/{batch.capacity}</span>
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-2.5">
                        <OccupancyBar percentage={batch.occupancyPct} />
                        <span className={`text-[11px] font-bold ${occColor} w-10 text-right`}>{batch.occupancyPct}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 text-right">
                      <div>
                        <span className="text-[12px] font-bold text-gray-800">{formatCurrency(batch.collectedRevenue)}</span>
                        <span className="text-[10px] text-gray-400 block">of {formatCurrency(batch.totalRevenue)}</span>
                      </div>
                    </td>
                    <td className="py-3.5 text-center">
                      <span className={`text-[12px] font-bold ${attColor}`}>{batch.avgAttendancePct}%</span>
                    </td>
                    <td className="py-3.5 text-center">
                      <span className={`text-[12px] font-bold ${perfColor}`}>{batch.avgTestPerformancePct}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sortedBatches.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-400">No batches found</div>
          )}
        </div>
      </SectionCard>

      {/* ─── STUDENT RISK ENGINE ─── */}
      <SectionCard title="Student Risk Engine" icon={ShieldAlert}>
        <div className="flex items-center gap-2 mb-5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Filter:</span>
          {["ALL", "HIGH", "MEDIUM", "LOW"].map((f) => (
            <button
              key={f}
              onClick={() => setRiskFilter(f)}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                riskFilter === f ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {f} {f !== "ALL" && `(${data.studentRisk.students.filter((s) => s.riskScore === f).length})`}
            </button>
          ))}
        </div>

        {filteredRiskStudents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
            {filteredRiskStudents.map((student, i) => (
              <div key={i} className="flex flex-col gap-3 p-4 border border-gray-100 rounded-xl hover:border-gray-200 hover:bg-gray-50/30 transition-all bg-white">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-bold text-gray-900 truncate">{student.name}</span>
                    <RiskBadge score={student.riskScore} />
                  </div>
                  <span className="text-[11px] text-gray-400 font-medium">{student.section}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {student.riskFactors.map((rf, j) => {
                    const icons = {
                      LOW_ATTENDANCE: <Clock size={10} />,
                      OVERDUE_FEES: <CircleDollarSign size={10} />,
                      DECLINING_PERFORMANCE: <TrendingDown size={10} />,
                    };
                    const colors = {
                      LOW_ATTENDANCE: "bg-slate-50 text-slate-600 border-slate-200",
                      OVERDUE_FEES: "bg-slate-50 text-slate-600 border-slate-200",
                      DECLINING_PERFORMANCE: "bg-slate-50 text-slate-600 border-slate-200",
                    };
                    return (
                      <span key={j} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${colors[rf.type] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                        {icons[rf.type]}
                        {rf.detail}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center">
            <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500 font-medium">
              {riskFilter === "ALL" ? "No students at risk" : `No ${riskFilter} risk students`}
            </p>
          </div>
        )}

        {studentRisk?.totalAtRisk > 0 && (
          <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Lightbulb size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <div className="text-[11px] text-amber-800">
                <span className="font-bold">Action Required:</span>{" "}
                Schedule parent-teacher meetings for HIGH risk students. Send fee reminders to students with overdue payments. Arrange remedial sessions for students with declining performance.
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ─── EXAM ANALYTICS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject Performance */}
        <SectionCard title="Subject Performance" icon={BookOpen}>
          {examAnalytics?.subjectWiseAverage?.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={examAnalytics.subjectWiseAverage} layout="vertical" margin={{ left: 0, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "#94a3b8", fontWeight: 600 }} />
                  <YAxis type="category" dataKey="subject" fontSize={10} tickLine={false} axisLine={false} width={70} tick={{ fill: "#475569", fontWeight: 600 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "11px", fontWeight: "600" }}
                    formatter={(v) => [`${v}%`, "Average"]}
                  />
                  <Bar dataKey="avgPercentage" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {examAnalytics.subjectWiseAverage.map((entry, i) => (
                      <Cell key={i} fill={BATCH_COLORS[i % BATCH_COLORS.length]} fillOpacity={0.85} />
                    ))}
                    <LabelList dataKey="avgPercentage" position="right" formatter={(v) => `${v}%`} style={{ fontSize: 10, fontWeight: 700, fill: "#475569" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400">No exam data available</div>
          )}
        </SectionCard>

        {/* Batch Comparison */}
        <SectionCard title="Batch Comparison" icon={BarChart3}>
          {examAnalytics?.sectionComparison?.filter((s) => s.avgPercentage > 0).length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={examAnalytics.sectionComparison.filter((s) => s.avgPercentage > 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="sectionName" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontWeight: 600 }} tickFormatter={(v, i) => {
                    const item = examAnalytics.sectionComparison.filter((s) => s.avgPercentage > 0)[i];
                    return item ? `${item.className} ${item.sectionName}` : v;
                  }} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "#94a3b8", fontWeight: 600 }} width={35} />
                  <Tooltip
                    contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "11px", fontWeight: "600" }}
                    formatter={(v) => [`${v}%`, "Avg Score"]}
                  />
                  <Bar dataKey="avgPercentage" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {examAnalytics.sectionComparison.filter((s) => s.avgPercentage > 0).map((_, i) => (
                      <Cell key={i} fill={BATCH_COLORS[i % BATCH_COLORS.length]} fillOpacity={0.85} />
                    ))}
                    <LabelList dataKey="avgPercentage" position="top" formatter={(v) => `${v}%`} style={{ fontSize: 10, fontWeight: 700, fill: "#475569" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400">No comparison data available</div>
          )}
        </SectionCard>
      </div>

      {/* ─── TOP STUDENTS + SUBJECT TRENDS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Top Students */}
        <div className="lg:col-span-2">
          <SectionCard title="Top Performers" icon={GraduationCap} className="h-full">
            {examAnalytics?.topStudents?.length > 0 ? (
              <div className="space-y-2.5">
                {examAnalytics.topStudents.map((student, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50/50 border border-gray-100 rounded-lg">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                      i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-gray-200 text-gray-600" : i === 2 ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500"
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[12px] font-bold text-gray-900 block truncate">{student.name}</span>
                      <span className="text-[10px] text-gray-400 font-medium">{student.section}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[13px] font-bold text-emerald-600">{student.avgPercentage}%</span>
                      <span className="text-[9px] text-gray-400 block">{student.testsAttempted} tests</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-gray-400">No performance data</div>
            )}
          </SectionCard>
        </div>

        {/* Subject Trends */}
        <div className="lg:col-span-3">
          <SectionCard title="Subject Performance Trends" icon={Activity} className="h-full">
            {examAnalytics?.subjectTrends && Object.keys(examAnalytics.subjectTrends).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(examAnalytics.subjectTrends).slice(0, 5).map(([subject, tests], i) => (
                  <div key={i} className="flex items-center gap-4">
                    <span className="text-[11px] font-bold text-gray-700 w-20 shrink-0 truncate">{subject}</span>
                    <div className="flex-1 flex items-center gap-2">
                      {tests.map((t, j) => {
                        const color = t.avgPercentage >= 60 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : t.avgPercentage >= 40 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-red-100 text-red-700 border-red-200";
                        return (
                          <div key={j} className="flex-1">
                            <div className={`text-center p-2 rounded-lg border ${color}`}>
                              <div className="text-[12px] font-bold">{t.avgPercentage}%</div>
                              <div className="text-[8px] font-medium opacity-60 truncate">{t.testName}</div>
                            </div>
                          </div>
                        );
                      })}
                      {tests.length >= 2 && (
                        <div className="shrink-0">
                          {tests[tests.length - 1].avgPercentage >= tests[tests.length - 2].avgPercentage ? (
                            <ArrowUpRight size={14} className="text-emerald-500" />
                          ) : (
                            <ArrowDownRight size={14} className="text-red-500" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-gray-400">No trend data available</div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
