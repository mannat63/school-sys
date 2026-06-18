"use client";

import { useEffect, useState, useMemo } from "react";
import {
  UserPlus, Search, Phone, Mail, Clock, ChevronLeft, ChevronRight,
  TrendingUp, Users, CheckCircle2, XCircle, AlertCircle, Calendar,
  MoreVertical, ArrowUpRight, Loader2, Megaphone, Download
} from "lucide-react";
import { createPdf, addTable, addSectionTitle, downloadPdf } from "@/lib/exportPdf";

const STATUSES = ["ALL","NEW","CONTACTED","INTERESTED","DEMO_SCHEDULED","FOLLOW_UP","CONVERTED","LOST"];
const STATUS_META = {
  NEW:            { label:"New",             color:"bg-gray-100 text-gray-700 border-gray-200",     barColor:"#94a3b8" },
  CONTACTED:      { label:"Contacted",       color:"bg-blue-100 text-blue-700 border-blue-200",     barColor:"#3b82f6" },
  INTERESTED:     { label:"Interested",      color:"bg-indigo-100 text-indigo-700 border-indigo-200", barColor:"#6366f1" },
  DEMO_SCHEDULED: { label:"Demo Scheduled",  color:"bg-violet-100 text-violet-700 border-violet-200", barColor:"#8b5cf6" },
  FOLLOW_UP:      { label:"Follow Up",       color:"bg-amber-100 text-amber-700 border-amber-200",  barColor:"#f59e0b" },
  CONVERTED:      { label:"Converted",       color:"bg-emerald-100 text-emerald-700 border-emerald-200", barColor:"#10b981" },
  LOST:           { label:"Lost",            color:"bg-red-100 text-red-700 border-red-200",        barColor:"#ef4444" },
};
const SOURCES = ["WEBSITE","GOOGLE_SHEET","REFERRAL","WALK_IN","SOCIAL_MEDIA","PHONE","OTHER"];
const PAGE_SIZE = 30;

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.NEW;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${m.color}`}>
      {m.label}
    </span>
  );
}

function LeadRow({ lead, onStatusChange, updating }) {
  const [open, setOpen] = useState(false);
  const nextStatuses = STATUSES.filter(s => s !== "ALL" && s !== lead.status);
  const overdue = lead.follow_up_date && new Date(lead.follow_up_date) < new Date();

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors group">
      <td className="py-3.5 px-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-[11px] font-bold text-indigo-600 shrink-0">
            {lead.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-[12px] font-bold text-gray-900">{lead.name}</div>
            <div className="text-[10px] text-gray-400">{lead.course_interest || "—"}</div>
          </div>
        </div>
      </td>
      <td className="py-3.5 px-5">
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1 text-[11px] text-gray-600"><Phone size={10} /> {lead.phone}</span>
          {lead.email && <span className="flex items-center gap-1 text-[10px] text-gray-400"><Mail size={10} /> {lead.email}</span>}
        </div>
      </td>
      <td className="py-3.5 px-5">
        <StatusBadge status={lead.status} />
      </td>
      <td className="py-3.5 px-5 text-[11px] text-gray-500">{lead.source?.replace(/_/g," ")}</td>
      <td className="py-3.5 px-5">
        {lead.follow_up_date ? (
          <span className={`text-[11px] font-semibold flex items-center gap-1 ${overdue ? "text-red-600" : "text-gray-600"}`}>
            <Clock size={10} />
            {new Date(lead.follow_up_date).toLocaleDateString("en-IN", { day:"numeric", month:"short" })}
            {overdue && <span className="text-[9px] text-red-500 font-bold">OVERDUE</span>}
          </span>
        ) : <span className="text-[10px] text-gray-300">—</span>}
      </td>
      <td className="py-3.5 px-5 text-[10px] text-gray-400">
        {new Date(lead.createdAt).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"2-digit" })}
      </td>
      <td className="py-3.5 px-5">
        <div className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            disabled={!!updating}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            {updating === lead._id ? <Loader2 size={13} className="animate-spin" /> : <MoreVertical size={13} />}
          </button>
          {open && (
            <div className="absolute right-0 top-7 z-20 bg-white border border-gray-100 rounded-2xl shadow-xl w-44 py-1 text-[11px]">
              <div className="px-3 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider">Move to</div>
              {nextStatuses.map(s => (
                <button
                  key={s}
                  onClick={() => { setOpen(false); onStatusChange(lead._id, s); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700 font-medium"
                >
                  {STATUS_META[s]?.label || s}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function AddLeadModal({ onClose, onAdd, courses = [] }) {
  const [form, setForm] = useState({ name:"", phone:"", email:"", course_interest:"", source:"WEBSITE", status:"NEW" });
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setSaving(true);
    const res = await fetch("/api/leads", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(form) });
    const data = await res.json();
    if (data.success) { onAdd(data.lead); onClose(); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:"rgba(15,23,42,0.3)", backdropFilter:"blur(4px)" }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-sm font-bold text-gray-900">Add New Lead</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Name *</label>
              <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="input-field" placeholder="Lead name" required />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Phone *</label>
              <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="input-field" placeholder="+91..." required />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Email</label>
              <input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="input-field" placeholder="email@gmail.com" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Course Interest</label>
              <select value={form.course_interest} onChange={e=>setForm({...form,course_interest:e.target.value})} className="input-field">
                <option value="">Select course</option>
                {courses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Source</label>
              <select value={form.source} onChange={e=>setForm({...form,source:e.target.value})} className="input-field">
                {SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm">
              {saving ? <Loader2 size={13} className="animate-spin"/> : "Add Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const [leads, setLeads]       = useState([]);
  const [counts, setCounts]     = useState({});
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("ALL");
  const [search, setSearch]     = useState("");
  const [updating, setUpdating] = useState(null);
  const [showAdd, setShowAdd]   = useState(false);
  const [courses, setCourses]   = useState([]);
  const [page, setPage]         = useState(1);

  async function load(status = filter) {
    setLoading(true);
    const params = new URLSearchParams({ limit:"500" }); // load all, paginate client-side
    if (status !== "ALL") params.set("status", status);
    const res  = await fetch(`/api/leads?${params}`);
    const data = await res.json();
    if (data.success) {
      setLeads(data.leads);
      setCounts(data.counts || {});
      setTotal(data.total || 0);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    fetch("/api/classes").then(r => r.ok ? r.json() : []).then(cls => {
      if (Array.isArray(cls)) setCourses(cls.map(c => c.name));
    });
  }, []);

  async function onStatusChange(id, newStatus) {
    setUpdating(id);
    const res  = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();
    if (data.success) {
      setLeads(prev => prev.map(l => l._id === id ? data.lead : l));
    }
    setUpdating(null);
    load(filter);
  }

  function onFilterChange(s) {
    setFilter(s);
    setPage(1);
    load(s);
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(l => l.name.toLowerCase().includes(q) || l.phone.includes(q) || (l.email||"").toLowerCase().includes(q));
  }, [leads, search]);

  // Pagination
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalLeads     = Object.values(counts).reduce((a,b) => a+b, 0);
  const totalConverted = counts["CONVERTED"] || 0;
  const totalLost      = counts["LOST"] || 0;
  const convRate       = totalLeads ? Math.round((totalConverted/totalLeads)*100) : 0;
  const followUpToday  = leads.filter(l => {
    if (!l.follow_up_date) return false;
    const d = new Date(l.follow_up_date);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }).length;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Lead CRM</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">Track inquiries from website, Google Sheets, and walk-ins</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (filtered.length === 0) return;
              const { doc, startY, addFooter } = await createPdf({ title: "Lead CRM Report", subtitle: `${filtered.length} leads`, landscape: true });
              let y = addSectionTitle(doc, "Overview", startY);
              y = addTable(doc, {
                startY: y,
                head: ["Total Leads", "Converted", "Conversion Rate", "Follow-ups Today"],
                body: [[String(totalLeads), String(totalConverted), `${convRate}%`, String(followUpToday)]],
              });
              y += 6;
              y = addSectionTitle(doc, "Lead Details", y);
              addTable(doc, {
                startY: y,
                head: ["#", "Name", "Phone", "Course", "Status", "Source", "Follow Up", "Added"],
                body: filtered.map((l, i) => [
                  String(i + 1),
                  l.name,
                  l.phone,
                  l.course_interest || "—",
                  STATUS_META[l.status]?.label || l.status,
                  l.source?.replace(/_/g, " ") || "—",
                  l.follow_up_date ? new Date(l.follow_up_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—",
                  new Date(l.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }),
                ]),
              });
              downloadPdf(doc, "Leads_Report.pdf", addFooter);
            }}
            className="btn-secondary text-sm"
          >
            <Download size={14} /> PDF
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary whitespace-nowrap text-sm">
            <UserPlus size={14} /> Add Lead
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:"Total Leads", value: totalLeads, icon: Users, color:"text-indigo-600", bg:"bg-indigo-50" },
          { label:"Converted",   value: totalConverted, icon: CheckCircle2, color:"text-emerald-600", bg:"bg-emerald-50" },
          { label:"Conversion Rate", value:`${convRate}%`, icon: TrendingUp, color:"text-blue-600", bg:"bg-blue-50" },
          { label:"Follow-ups Today", value: followUpToday, icon: Clock, color: followUpToday>0?"text-amber-600":"text-gray-500", bg: followUpToday>0?"bg-amber-50":"bg-gray-50" },
        ].map((c,i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className={`p-2 ${c.bg} rounded-lg`}><Icon size={14} className={c.color} /></div>
              </div>
              <div className="text-xl font-bold text-gray-900">{c.value}</div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-1">{c.label}</div>
            </div>
          );
        })}
      </div>

      {/* Pipeline funnel — enhanced */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[12px] font-bold text-gray-900 flex items-center gap-2">
            <Megaphone size={13} className="text-indigo-500" /> Admission Pipeline
          </h2>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{totalLeads} leads total</span>
        </div>

        {/* Visual bar chart + stage pills */}
        <div className="space-y-2 mb-4">
          {STATUSES.filter(s=>s!=="ALL").map((s) => {
            const cnt = counts[s] || 0;
            const pct = totalLeads ? Math.round((cnt/totalLeads)*100) : 0;
            const meta = STATUS_META[s];
            const active = filter === s;
            return (
              <button
                key={s}
                onClick={() => onFilterChange(s)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-all text-left ${active ? "border-gray-900 bg-gray-900" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50/50"}`}
              >
                <div className={`text-[11px] font-bold w-24 shrink-0 ${active ? "text-white" : "text-gray-500"}`}>{meta?.label}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width:`${pct}%`, backgroundColor: meta?.barColor || "#94a3b8" }}
                  />
                </div>
                <div className={`text-[12px] font-bold w-8 text-right shrink-0 ${active ? "text-white" : "text-gray-800"}`}>{cnt}</div>
                <div className={`text-[10px] w-8 text-right shrink-0 ${active ? "text-gray-400" : "text-gray-400"}`}>{pct}%</div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Conversion Rate</span>
              <div className="text-lg font-bold text-emerald-600">{convRate}%</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Converted</span>
              <div className="text-lg font-bold text-gray-800">{totalConverted}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Lost</span>
              <div className="text-lg font-bold text-red-500">{totalLost}</div>
            </div>
          </div>
          <button
            onClick={() => onFilterChange("ALL")}
            className={`px-3 py-1.5 text-[10px] font-bold rounded-md border transition-all ${filter==="ALL" ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
          >
            Show All
          </button>
        </div>
      </div>

      {/* Lead table — full width */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e=>{setSearch(e.target.value); setPage(1);}}
              placeholder="Search by name, phone, email..."
              className="input-field !pl-8 !py-2 text-xs"
            />
          </div>
          <span className="text-[11px] text-gray-400 whitespace-nowrap">{filtered.length} leads</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                {["Lead","Contact","Status","Source","Follow Up","Added","Action"].map(h => (
                  <th key={h} className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(8).fill(0).map((_,i)=>(
                  <tr key={i} className="border-b border-gray-100">
                    {Array(7).fill(0).map((_,j)=>(
                      <td key={j} className="px-5 py-4"><div className="h-3 animate-shimmer rounded w-16" /></td>
                    ))}
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-sm text-gray-400">No leads found</td></tr>
              ) : (
                paginated.map(l => (
                  <LeadRow key={l._id} lead={l} onStatusChange={onStatusChange} updating={updating} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/30">
            <p className="text-sm text-gray-500">Page {page} of {pages} · {filtered.length} leads</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1} className="btn-secondary !px-3 !py-1.5 text-xs disabled:opacity-40">
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, pages - 4));
                const n = start + i;
                return n <= pages ? (
                  <button key={n} onClick={() => setPage(n)} className={`w-8 h-8 text-xs font-semibold rounded-md border transition-colors ${n === page ? "bg-gray-900 text-white border-slate-800" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>{n}</button>
                ) : null;
              })}
              <button onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page >= pages} className="btn-secondary !px-3 !py-1.5 text-xs disabled:opacity-40">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showAdd && (
        <AddLeadModal
          onClose={() => setShowAdd(false)}
          onAdd={(lead) => { setLeads(prev => [lead, ...prev]); load(filter); }}
          courses={courses}
        />
      )}
    </div>
  );
}
