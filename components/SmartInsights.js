"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  IndianRupee, Users, CalendarCheck, Target, BarChart3, Layers,
  UserPlus, RefreshCw, Sparkles, ChevronRight
} from "lucide-react";

const CATEGORY_META = {
  Revenue:    { color: "emerald", Icon: IndianRupee },
  Fees:       { color: "red",     Icon: IndianRupee },
  Attendance: { color: "amber",   Icon: CalendarCheck },
  Performance:{ color: "violet",  Icon: BarChart3 },
  Admissions: { color: "indigo",  Icon: UserPlus },
  "Lead CRM": { color: "blue",    Icon: Target },
  Teacher:    { color: "teal",    Icon: Users },
};

const COLOR_CLASSES = {
  emerald: { bg: "bg-emerald-50",  text: "text-emerald-700",  border: "border-emerald-100",  dot: "bg-emerald-500"  },
  red:     { bg: "bg-red-50",      text: "text-red-700",      border: "border-red-100",      dot: "bg-red-500"      },
  amber:   { bg: "bg-amber-50",    text: "text-amber-700",    border: "border-amber-100",    dot: "bg-amber-500"    },
  violet:  { bg: "bg-violet-50",   text: "text-violet-700",   border: "border-violet-100",   dot: "bg-violet-500"   },
  indigo:  { bg: "bg-indigo-50",   text: "text-indigo-700",   border: "border-indigo-100",   dot: "bg-indigo-500"   },
  blue:    { bg: "bg-blue-50",     text: "text-blue-700",     border: "border-blue-100",     dot: "bg-blue-500"     },
  teal:    { bg: "bg-teal-50",     text: "text-teal-700",     border: "border-teal-100",     dot: "bg-teal-500"     },
};

const TYPE_BADGE = {
  positive: "text-emerald-600 bg-emerald-50 border-emerald-200",
  warning:  "text-amber-700 bg-amber-50 border-amber-200",
  critical: "text-red-700 bg-red-50 border-red-200",
};

function InsightCard({ insight }) {
  const meta    = CATEGORY_META[insight.category] || CATEGORY_META.Revenue;
  const color   = COLOR_CLASSES[meta.color];
  const { Icon } = meta;

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2.5 ${color.border} ${insight.type === "critical" ? "ring-1 ring-red-200" : ""}`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-6 h-6 rounded-md ${color.bg} flex items-center justify-center flex-shrink-0`}>
            <Icon size={12} className={color.text} />
          </div>
          <span className={`text-[10px] uppercase font-bold tracking-wider ${color.text}`}>{insight.category}</span>
        </div>
        {insight.metric && (
          <div className="text-right flex-shrink-0">
            <div className={`text-lg font-black leading-none ${insight.type === "critical" ? "text-red-600" : insight.type === "warning" ? "text-amber-700" : "text-emerald-600"}`}>
              {insight.metric}
            </div>
            <div className="text-[9px] text-gray-400 font-semibold uppercase mt-0.5">{insight.metricLabel}</div>
          </div>
        )}
      </div>

      {/* Title */}
      <p className="text-[13px] font-semibold text-gray-800 leading-snug">{insight.title}</p>

      {/* Detail */}
      <p className="text-[11px] text-gray-500 leading-relaxed">{insight.detail}</p>

      {/* Action link */}
      {insight.action && (
        <Link href={insight.action.href} className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 transition-colors mt-auto">
          {insight.action.label} <ChevronRight size={11} />
        </Link>
      )}
    </div>
  );
}

export default function SmartInsights() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecs, setAiRecs]     = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");

  async function loadInsights() {
    setLoading(true);
    try {
      const res = await fetch("/api/insights/smart");
      const json = await res.json();
      if (!json.error) setData(json);
    } catch {/* silent */ }
    setLoading(false);
  }

  async function loadAI() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/insights/smart?ai=true");
      const json = await res.json();
      if (json.aiRecs) setAiRecs(json.aiRecs);
    } catch {/* silent */ }
    setAiLoading(false);
  }

  useEffect(() => { loadInsights(); }, []);

  const categories = data ? ["All", ...new Set(data.insights.map(i => i.category))] : ["All"];
  const filtered   = data ? (activeCategory === "All" ? data.insights : data.insights.filter(i => i.category === activeCategory)) : [];
  const criticalCount = data?.insights.filter(i => i.type === "critical").length || 0;

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2.5">
          <div className="w-6 h-6 animate-shimmer rounded-lg" />
          <div className="h-4 w-32 animate-shimmer rounded" />
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-28 animate-shimmer rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2.5">
        <div className="p-1.5 bg-slate-100 rounded-lg">
          <Brain size={14} className="text-slate-700" />
        </div>
        <h2 className="text-[13px] font-bold text-gray-900 tracking-tight">Business Insights</h2>
        {criticalCount > 0 && (
          <span className="ml-1 px-2 py-0.5 bg-red-50 border border-red-200 rounded-full text-[10px] font-bold text-red-600">
            {criticalCount} critical
          </span>
        )}
        <button onClick={loadInsights} className="ml-auto p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Refresh">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Category filter */}
      <div className="px-6 pt-4 pb-2 flex gap-2 overflow-x-auto">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${activeCategory === cat ? "bg-slate-800 text-white border-slate-800" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Insight grid */}
      <div className="p-6">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-400" />
            No issues detected in this category.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((insight, i) => <InsightCard key={i} insight={insight} />)}
          </div>
        )}
      </div>

      {/* AI Strategic Recommendations */}
      <div className="px-6 pb-6">
        {aiRecs ? (
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={14} className="text-amber-400" />
              <span className="text-[12px] font-bold text-white">Strategic Recommendations</span>
              <span className="ml-auto text-[9px] font-bold text-slate-500 uppercase tracking-widest">AI · claude-haiku</span>
            </div>
            <div className="space-y-2.5">
              {aiRecs.map((rec, i) => (
                <div key={i} className="flex items-start gap-2.5 bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-[12px] text-gray-300 leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={loadAI}
              disabled={aiLoading}
              className="w-full btn-primary !bg-slate-800 hover:!bg-slate-900 !py-3 !text-sm"
            >
              {aiLoading ? (
                <><RefreshCw size={15} className="animate-spin" /> Generating strategic recommendations…</>
              ) : (
                <>
                  <Sparkles size={15} className="text-amber-400" />
                  Generate AI Recommendations
                  <span className="text-[10px] font-medium bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded-md ml-1">~1 API call</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
