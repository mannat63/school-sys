"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Wallet, Plus, X, IndianRupee, CheckCircle, AlertCircle,
  Bell, Calendar, ChevronRight, Clock, TrendingUp, Search
} from "lucide-react";
import toast from "react-hot-toast";

// ─── helpers ────────────────────────────────────────────────────────────────
function midnight(d) {
  const dt = new Date(d);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}
function today() { return midnight(new Date()); }

function feeStatus(fee) {
  if (fee.status === "PAID") return "PAID";
  const diffDays = Math.round((midnight(fee.due_date) - today()) / 86400000);
  if (diffDays < 0) return "OVERDUE";
  if (diffDays <= 5) return "UPCOMING";
  return "CLEAR";
}

function daysLabel(fee) {
  if (fee.status === "PAID") return "Settled";
  const diff = Math.round((today() - midnight(fee.due_date)) / 86400000);
  if (diff === 0) return "Due today";
  return diff > 0 ? `${diff}d overdue` : `Due in ${Math.abs(diff)}d`;
}

// ─── Student Fee Card ─────────────────────────────────────────────────────────
function StudentFeeCard({ student, fees, onOpen }) {
  const name = student.user_id?.name || student.parent_name || "—";
  const phone = student.parent_phone || "—";

  // Summary stats
  const totalPaid  = fees.reduce((s, f) => s + (f.paid_amount || 0), 0);
  const overdue    = fees.filter(f => feeStatus(f) === "OVERDUE");
  const upcoming   = fees.filter(f => feeStatus(f) === "UPCOMING");
  
  const outstandingDue = overdue.reduce((s, f) => s + (f.due_amount || 0), 0);

  const statusColor =
    overdue.length > 0 ? "border-red-200 bg-red-50/30" :
    upcoming.length > 0 ? "border-amber-200 bg-amber-50/20" :
    "border-emerald-200 bg-emerald-50/20";

  const pill =
    overdue.length > 0
      ? <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded uppercase">{overdue.length} Overdue</span>
      : upcoming.length > 0
      ? <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase">Upcoming</span>
      : <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase">All Clear</span>;

  return (
    <button
      onClick={() => onOpen(student, fees)}
      className={`w-full text-left card border ${statusColor} hover:shadow-md transition-all group cursor-pointer`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">{name}</div>
          <div className="text-[11px] text-gray-400 font-mono mt-0.5">{phone}</div>
        </div>
        <div className="flex items-center gap-2">
          {pill}
          <ChevronRight size={15} className="text-gray-300 group-hover:text-blue-400 transition-colors" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mt-1">
        <div className="bg-white rounded-md p-2 border border-gray-100">
          <div className="text-[10px] text-gray-400 uppercase font-semibold">Paid</div>
          <div className="text-sm font-bold text-emerald-600">₹{totalPaid.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-md p-2 border border-gray-100">
          <div className="text-[10px] text-gray-400 uppercase font-semibold">Outstanding</div>
          <div className="text-sm font-bold text-red-500">₹{outstandingDue.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-md p-2 border border-gray-100">
          <div className="text-[10px] text-gray-400 uppercase font-semibold">Records</div>
          <div className="text-sm font-bold text-gray-700">{fees.length}</div>
        </div>
      </div>
    </button>
  );
}

// ─── Fee Timeline Modal ───────────────────────────────────────────────────────
function FeeModal({ student, fees, onClose, onRefresh, role }) {
  const name = student.user_id?.name || student.parent_name || "—";
  const [showPay, setShowPay]   = useState(null);
  const [payForm, setPayForm]   = useState({ fee_id: "", student_id: "", amount: "", method: "CASH" });
  const [reminding, setReminding] = useState(false);

  const [paying, setPaying]     = useState(false);

  // Sort chronologically
  const sorted = [...fees].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  async function handlePayment(e, fee) {
    e.preventDefault();
    setPaying(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payForm),
      });
      if (res.ok) {
        const payment = await res.json();
        await fetch(`/api/payments/${payment._id}/confirm`, { method: "PUT" });
        toast.success("Payment recorded!");
        setShowPay(null);
        onRefresh();
      } else {
        const err = await res.json();
        toast.error(err.error || "Payment failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setPaying(false);
    }
  }

  async function handleSettle(fee) {
    const ok = confirm(`Settle ₹${fee.due_amount.toLocaleString()} for ${name}?`);
    if (!ok) return;
    setPaying(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fee_id: fee._id, student_id: student._id, amount: fee.due_amount, method: "CASH" }),
      });
      if (res.ok) {
        const payment = await res.json();
        await fetch(`/api/payments/${payment._id}/confirm`, { method: "PUT" });
        toast.success("Fee settled!");
        onRefresh();
      } else {
        const err = await res.json();
        toast.error(err.error || "Settle failed");
      }
    } catch {
      toast.error("Network error");
    }
    setPaying(false);
  }

  async function handleRemind(fee) {
    setReminding(true);
    try {
      const payload = {
        _id: fee._id,
        student_id: student._id,
        name,
        parent_phone: student.parent_phone || "—",
        due_amount: fee.due_amount,
        days_overdue: Math.round((today() - midnight(fee.due_date)) / 86400000)
      };
      const res = await fetch("/api/defaulters/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fees: [payload] })
      });
      const data = await res.json();
      if (res.ok) toast.success(`Reminder sent!`);
      else toast.error(data.error || "Reminder failed");
    } catch {
      toast.error("Network error");
    }
    setReminding(false);
  }

  const statusConfig = {
    PAID:     { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", label: "PAID" },
    OVERDUE:  { bg: "bg-red-50",     border: "border-red-200",     text: "text-red-700",     dot: "bg-red-500",     label: "OVERDUE" },
    UPCOMING: { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   dot: "bg-amber-400",   label: "UPCOMING" },
    CLEAR:    { bg: "bg-emerald-50/20", border: "border-emerald-100", text: "text-emerald-600", dot: "bg-emerald-300", label: "CLEAR" },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
          <div>
            <h2 className="text-base font-bold text-gray-900">{name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Fee Timeline · {sorted.length} records</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Summary Strip */}
        {(() => {
          const totalPaid = sorted.reduce((s, f) => s + (f.paid_amount || 0), 0);
          const overdueFees = sorted.filter(f => feeStatus(f) === "OVERDUE");
          const totalOutstanding = overdueFees.reduce((s, f) => s + (f.due_amount  || 0), 0);
          const overdueCount = overdueFees.length;
          return (
            <div className="px-6 py-3 border-b border-gray-100 grid grid-cols-3 gap-4 bg-white">
              <div className="text-center">
                <div className="text-[10px] text-gray-400 uppercase font-semibold">Total Paid</div>
                <div className="text-base font-bold text-emerald-600">₹{totalPaid.toLocaleString()}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-400 uppercase font-semibold">Outstanding</div>
                <div className="text-base font-bold text-red-500">₹{totalOutstanding.toLocaleString()}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-400 uppercase font-semibold">Overdue Months</div>
                <div className="text-base font-bold text-gray-700">{overdueCount}</div>
              </div>
            </div>
          );
        })()}

        {/* Timeline */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-3">
          {sorted.map((fee, idx) => {
            const st = feeStatus(fee);
            const cfg = statusConfig[st];
            const label = daysLabel(fee);
            const isCurrentShowPay = showPay === fee._id;

            return (
              <div key={fee._id} className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4`}>
                {/* Row header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0`} />
                    <div>
                      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        Month {idx + 1} · Due {new Date(fee.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                      <div className={`text-xs font-bold mt-0.5 ${cfg.text}`}>{label}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <div className="text-[10px] text-gray-400">Total</div>
                      <div className="text-sm font-bold text-gray-800">₹{fee.total_amount?.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400">Paid</div>
                      <div className="text-sm font-bold text-emerald-600">₹{fee.paid_amount?.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400">Due</div>
                      <div className="text-sm font-bold text-red-500">₹{fee.due_amount?.toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {role === "ADMIN" && st !== "PAID" && (
                  <div className="mt-3 pt-3 border-t border-white/60">
                    {isCurrentShowPay ? (
                      <form onSubmit={(e) => handlePayment(e, fee)} className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                          <input
                            type="number" placeholder="Amount" required max={fee.due_amount}
                            className="w-[130px] px-2.5 py-1.5 pr-[42px] border border-gray-200 rounded-md text-sm font-mono focus:ring-2 focus:ring-slate-400/20 outline-none bg-white"
                            value={payForm.amount}
                            onChange={e => setPayForm({ ...payForm, amount: Number(e.target.value) })}
                          />
                          <button type="button" onClick={() => setPayForm({ ...payForm, amount: fee.due_amount })}
                            className="absolute right-1 top-1 bottom-1 px-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-[10px] uppercase rounded">
                            Full
                          </button>
                        </div>
                        <select value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value })}
                          className="px-2 py-1.5 border border-gray-200 rounded-md text-xs outline-none bg-white" disabled={paying}>
                          <option value="CASH">CASH</option>
                          <option value="UPI">UPI</option>
                          <option value="BANK_TRANSFER">BANK</option>
                        </select>
                        <button type="submit" className="px-3 py-1.5 bg-emerald-600 text-white font-semibold rounded-md text-xs hover:bg-emerald-700 disabled:opacity-50" disabled={paying}>Save</button>
                        <button type="button" onClick={() => setShowPay(null)} className="px-2 py-1.5 text-gray-400 hover:text-gray-600"><X size={14} /></button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          disabled={paying || reminding}
                          onClick={() => { setShowPay(fee._id); setPayForm({ fee_id: fee._id, student_id: student._id, amount: fee.due_amount, method: "CASH" }); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-md transition-all shadow-sm disabled:opacity-50"
                        >
                          <IndianRupee size={12} /> Record Pay
                        </button>
                        <button onClick={() => handleSettle(fee)} disabled={paying || reminding}
                          className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-md hover:bg-emerald-700 shadow-sm disabled:opacity-50">
                          {paying ? "..." : "Settle"}
                        </button>
                        <button onClick={() => handleRemind(fee)} disabled={reminding || paying}
                          className="px-3 py-1.5 bg-white border border-amber-200 text-amber-700 text-xs font-bold rounded-md hover:bg-amber-50 shadow-sm disabled:opacity-60 flex items-center gap-1">
                          <Bell size={11} /> {reminding ? "..." : "Remind"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {st === "PAID" && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                    <CheckCircle size={12} /> Fully settled
                  </div>
                )}
              </div>
            );
          })}

          {sorted.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center text-center opacity-50">
              <Wallet size={28} className="text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No fee records yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FeesPage() {
  const [fees, setFees]         = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses]   = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [role, setRole]         = useState("");
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState("ALL"); // ALL | OVERDUE | UPCOMING | CLEAR
  
  // Tree Filter
  const [filterClass, setFilterClass]     = useState("");
  const [filterSection, setFilterSection] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm]         = useState({ student_id: "", total_amount: "", due_date: "" });
  const [defaulters, setDefaulters] = useState([]);
  const [reminding, setReminding]   = useState(false);

  // Modal state
  const [modal, setModal] = useState(null); // { student, fees }

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [f, s, m, dRes, c, sec] = await Promise.all([
      fetch("/api/fees").then(r => r.json()),
      fetch("/api/students").then(r => r.json()),
      fetch("/api/me").then(r => r.json()),
      fetch("/api/defaulters").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/classes").then(r => r.json()),
      fetch("/api/sections").then(r => r.json()),
    ]);
    setFees(Array.isArray(f) ? f : []);
    setStudents(Array.isArray(s) ? s : []);
    setClasses(Array.isArray(c) ? c : []);
    setSections(Array.isArray(sec) ? sec : []);
    if (dRes && Array.isArray(dRes)) setDefaulters(dRes);
    setRole(m?.role || "STUDENT");
    setLoading(false);
  }

  // If modal is open, refresh its fees too
  async function handleRefresh() {
    await loadData();
  }

  async function handleCreateFee(e) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ student_id: "", total_amount: "", due_date: "" });
        loadData();
        toast.success("Fee record created");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to create fee");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setCreating(false);
    }
  }

  async function handleRemindAll() {
    setReminding(true);
    try {
      const overdue = fees
        .filter(f => f.status !== "PAID" && today() > midnight(f.due_date))
        .map(f => ({
          _id: f._id,
          student_id: f.student_id?._id,
          name: f.student_id?.user_id?.name || f.student_id?.parent_name,
          parent_phone: f.student_id?.parent_phone || "—",
          due_amount: f.due_amount,
          days_overdue: Math.round((today() - midnight(f.due_date)) / 86400000),
        }));
      const res = await fetch("/api/defaulters/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fees: overdue }),
      });
      const data = await res.json();
      if (res.ok) toast.success(`Sent ${data.sent} reminders`);
      else toast.error(data.error || "Reminder failed");
    } catch {
      toast.error("Network error");
    }
    setReminding(false);
  }

  // ── Group fees by student ────────────────────────────────────────────────
  const feesByStudent = useMemo(() => {
    const map = {};
    fees.forEach(fee => {
      const sid = fee.student_id?._id || fee.student_id;
      if (!sid) return;
      const key = String(sid);
      if (!map[key]) map[key] = [];
      map[key].push(fee);
    });
    return map;
  }, [fees]);

  // ── Filter / search students ─────────────────────────────────────────────
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const name = (s.user_id?.name || s.parent_name || "").toLowerCase();
      if (search && !name.includes(search.toLowerCase())) return false;

      if (filterClass) {
         const secObj = sections.find(sec => sec._id === (s.section_id?._id || s.section_id));
         const secClassId = secObj?.class_id?._id || secObj?.class_id;
         if (!secObj || secClassId !== filterClass) return false;
      }
      
      if (filterSection && (s.section_id?._id || s.section_id) !== filterSection) return false;

      const sid = String(s._id);
      const studentFees = feesByStudent[sid] || [];

      if (filter === "ALL") return true;
      if (filter === "OVERDUE") return studentFees.some(f => feeStatus(f) === "OVERDUE");
      if (filter === "UPCOMING") return studentFees.some(f => feeStatus(f) === "UPCOMING");
      if (filter === "CLEAR") {
        const hasOverdue = studentFees.some(f => feeStatus(f) === "OVERDUE");
        const hasUpcoming = studentFees.some(f => feeStatus(f) === "UPCOMING");
        return !hasOverdue && !hasUpcoming;
      }
      return true;
    });
  }, [students, search, filter, feesByStudent, filterClass, filterSection, sections]);

  // Stats
  const overdueStudents = students.filter(s =>
    (feesByStudent[String(s._id)] || []).some(f => feeStatus(f) === "OVERDUE")
  ).length;

  if (loading) return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="h-8 w-48 animate-shimmer rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-36 animate-shimmer rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ─ Header ─ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">{role === "STUDENT" ? "My Fee Summary" : "Fees Management"}</h1>
          <p className="page-subtitle">
            {role === "STUDENT"
              ? "View your fee timeline, payment history and upcoming dues."
              : "Click any student card to view their full fee timeline."}
          </p>
        </div>
        {role === "ADMIN" && (
          <div className="flex items-center gap-3">
            <button onClick={handleRemindAll} disabled={reminding || overdueStudents === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-md transition-colors shadow-sm disabled:opacity-50">
              <Bell size={14} /> {reminding ? "Sending…" : "Remind All Overdue"}
            </button>
            <button onClick={() => setShowForm(!showForm)}
              className={`btn-primary ${showForm ? "!bg-gray-500 hover:!bg-gray-600" : ""}`}>
              {showForm ? <><X size={16} /> Cancel</> : <><Plus size={16} /> Add Fee</>}
            </button>
          </div>
        )}
      </div>

      {/* ─ Stats bar ─ */}
      {role === "ADMIN" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Students", value: students.length, icon: <TrendingUp size={14} />, color: "text-slate-700" },
            { label: "Overdue", value: overdueStudents, icon: <AlertCircle size={14} />, color: "text-red-600" },
            { label: "Total Collected", value: `₹${fees.reduce((s, f) => s + (f.paid_amount || 0), 0).toLocaleString()}`, icon: <CheckCircle size={14} />, color: "text-emerald-600" },
            { label: "Outstanding", value: `₹${fees.filter(f => feeStatus(f) === "OVERDUE").reduce((s, f) => s + (f.due_amount || 0), 0).toLocaleString()}`, icon: <Wallet size={14} />, color: "text-red-500" },
          ].map((c, i) => (
            <div key={i} className="card !py-3 !px-4 flex items-center gap-3">
              <span className={`${c.color} opacity-70`}>{c.icon}</span>
              <div>
                <div className="text-[10px] text-gray-400 uppercase font-semibold">{c.label}</div>
                <div className={`text-base font-bold ${c.color}`}>{c.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─ Create Fee Form ─ */}
      {showForm && role === "ADMIN" && (
        <form onSubmit={handleCreateFee} className="card bg-gray-50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Student</label>
            <select required value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })} className="input-field" disabled={creating}>
              <option value="">Select Student</option>
              {students.map(s => <option key={s._id} value={s._id}>{s.user_id?.name || s.parent_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Amount</label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-gray-400 font-semibold">₹</span>
              <input type="number" placeholder="Amount" required value={form.total_amount} onChange={e => setForm({ ...form, total_amount: e.target.value })} className="input-field pl-8" disabled={creating} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Due Date</label>
            <input type="date" required value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="input-field" disabled={creating} />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full" disabled={creating}>
              {creating ? "Saving..." : <><CheckCircle size={15} /> Save</>}
            </button>
          </div>
        </form>
      )}

      {/* ─ Search + Filter ─ */}
      {role !== "STUDENT" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                placeholder="Search student…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field pl-9 !py-2 text-sm"
              />
            </div>
            <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
              {[["ALL", "All"], ["OVERDUE", "Overdue"], ["UPCOMING", "Upcoming"], ["CLEAR", "Clear"]].map(([val, lbl]) => (
                <button key={val} onClick={() => setFilter(val)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${filter === val ? "bg-slate-700 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"}`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-2 border border-gray-200 rounded-lg">
             <div className="flex items-center gap-2">
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Class</span>
                 <select value={filterClass} onChange={(e) => { setFilterClass(e.target.value); setFilterSection(""); }} className="input-field !py-1 text-xs h-auto min-w-[120px]">
                   <option value="">All Classes</option>
                   {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                 </select>
             </div>
             <div className="flex items-center gap-2">
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Section</span>
                 <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)} className="input-field !py-1 text-xs h-auto min-w-[120px]" disabled={!filterClass}>
                   <option value="">All Sections</option>
                   {sections.filter(s => {
                     const cid = s.class_id?._id || s.class_id;
                     return !filterClass || cid === filterClass;
                   }).map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                 </select>
             </div>
          </div>
        </div>
      )}

      {/* ─ Student Cards Grid ─ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.map(student => (
          <StudentFeeCard
            key={student._id}
            student={student}
            fees={feesByStudent[String(student._id)] || []}
            onOpen={(s, f) => setModal({ student: s, fees: f })}
          />
        ))}
        {filteredStudents.length === 0 && (
          <div className="col-span-full py-16 flex flex-col items-center justify-center text-center opacity-50">
            <Wallet size={28} className="text-gray-300 mb-2" />
            <p className="text-sm font-semibold text-gray-500">No students match this filter</p>
          </div>
        )}
      </div>

      {/* ─ Fee Timeline Modal ─ */}
      {modal && (
        <FeeModal
          student={modal.student}
          fees={feesByStudent[String(modal.student._id)] || []}
          role={role}
          onClose={() => setModal(null)}
          onRefresh={async () => {
            await handleRefresh();
            // Update modal fees from new data after reload
            setModal(prev => prev ? { ...prev } : null);
          }}
        />
      )}
    </div>
  );
}
