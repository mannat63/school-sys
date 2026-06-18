"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Users, Upload, Plus, X, Download, Pencil, Trash2, CheckCircle, AlertCircle, Search, BarChart3, Activity, ChevronLeft, ChevronRight, Eye, Filter, FileText } from "lucide-react";
import Link from "next/link";
import { createPdf, addTable, downloadPdf } from "@/lib/exportPdf";

function Toast({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type === "error" ? "toast-error" : "toast-success"}`}>
          {t.type === "error" ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="btn-ghost !p-1.5 rounded-md"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DeleteModal({ open, onClose, onConfirm, name, deleting }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-8 text-center">
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Trash2 size={20} />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">Delete Student</h3>
          <p className="text-sm text-gray-500">Remove <span className="font-semibold text-gray-700">{name}</span>? This cannot be undone.</p>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary" disabled={deleting}>Cancel</button>
          <button onClick={onConfirm} className="btn-danger" disabled={deleting}>{deleting ? "Deleting..." : "Delete"}</button>
        </div>
      </div>
    </div>
  );
}

function AttBadge({ pct }) {
  if (pct === null || pct === undefined) return <span className="text-gray-400 text-xs">—</span>;
  const color = pct < 50 ? "text-red-600 bg-red-50" : pct < 75 ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50";
  return <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${color}`}>{pct.toFixed(1)}%</span>;
}

function PerfBadge({ pct }) {
  if (pct === null || pct === undefined) return <span className="text-gray-400 text-xs">—</span>;
  const color = pct < 40 ? "text-red-600" : pct < 60 ? "text-amber-600" : "text-emerald-600";
  return <span className={`text-xs font-bold ${color}`}>{pct.toFixed(1)}%</span>;
}

export default function StudentsPage() {
  const [data, setData] = useState({ students: [], total: 0, page: 1, pages: 1 });
  const [sections, setSections] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");

  const [search, setSearch]         = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [riskType, setRiskType]     = useState("");
  const [page, setPage]             = useState(1);

  const [modalOpen, setModalOpen]   = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", student_phone: "+91 ", class_id: "", section_id: "", parent_name: "", parent_phone: "+91 ", admission_date: "", total_fee: "", due_date: "" });
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [dragActive, setDragActive]     = useState(false);
  const [csvFile, setCsvFile]           = useState(null);
  const [csvPreviewRows, setCsvPreviewRows] = useState(null);
  const [csvResult, setCsvResult]       = useState(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const fileRef = useRef(null);

  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  // debounce search
  const searchTimer = useRef(null);
  function handleSearch(v) {
    setSearch(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); }, 400);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const risk = params.get("risk");
    if (risk) setRiskType(risk);

    Promise.all([
      fetch("/api/sections").then(r => r.json()),
      fetch("/api/classes").then(r => r.json()),
      fetch("/api/me").then(r => r.json()),
    ]).then(([s, c, m]) => {
      setSections(Array.isArray(s) ? s : []);
      setClasses(Array.isArray(c) ? c : []);
      setRole(m?.role || "STUDENT");
    });
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [page, filterSection, riskType]);

  useEffect(() => {
    if (page !== 1) setPage(1);
    else fetchStudents();
  }, [search]);

  async function fetchStudents() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (search)        params.set("search", search);
      if (filterSection) params.set("section_id", filterSection);
      if (riskType)      params.set("risk", riskType);
      const res = await fetch(`/api/students?${params}`);
      const json = await res.json();
      setData({ students: json.students || [], total: json.total || 0, page: json.page || 1, pages: json.pages || 1 });
    } catch {
      toast("Failed to load students", "error");
    }
    setLoading(false);
  }

  function openAdd() {
    setEditingStudent(null);
    setForm({ name: "", email: "", student_phone: "+91 ", class_id: "", section_id: "", parent_name: "", parent_phone: "+91 ", admission_date: "", total_fee: "", due_date: "" });
    setModalOpen(true);
  }
  function openEdit(s) {
    setEditingStudent(s);
    const sec = sections.find(sc => sc._id === (s.section_id?._id || s.section_id));
    setForm({
      name: s.user_id?.name || "",
      email: s.user_id?.phoneOrEmail || "",
      student_phone: "+91 ",
      class_id: sec?.class_id?._id || sec?.class_id || "",
      section_id: s.section_id?._id || s.section_id || "",
      parent_name: s.parent_name || "",
      parent_phone: s.parent_phone || "+91 ",
      admission_date: s.admission_date ? new Date(s.admission_date).toLocaleDateString("en-CA") : "",
      total_fee: "",
      due_date: "",
    });
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url    = editingStudent ? `/api/students/${editingStudent._id}` : "/api/students";
      const method = editingStudent ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, phoneOrEmail: form.email }) });
      if (res.ok) {
        toast(editingStudent ? "Student updated" : "Student added");
        setModalOpen(false);
        setEditingStudent(null);
        fetchStudents();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to save", "error");
      }
    } catch { toast("Network error", "error"); }
    setSubmitting(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/students/${deleteTarget._id}`, { method: "DELETE" });
      if (res.ok) { toast("Student removed"); setDeleteTarget(null); fetchStudents(); }
      else toast("Failed to delete", "error");
    } catch { toast("Network error", "error"); }
    setDeleting(false);
  }

  function handleDrag(e) {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }
  function handleDrop(e) {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  }
  function handleFileSelect(e) { if (e.target.files?.[0]) processFile(e.target.files[0]); }
  function processFile(file) {
    if (!file.name.endsWith(".csv")) return toast("Upload a .csv file", "error");
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (evt) => { const rows = evt.target.result.split("\n").filter(r => r.trim()); setCsvPreviewRows(rows.length > 1 ? rows.length - 1 : 0); };
    reader.readAsText(file);
  }
  async function handleConfirmCSV() {
    if (!csvFile) return;
    setCsvUploading(true); setCsvResult(null);
    const fd = new FormData(); fd.append("file", csvFile);
    try {
      const res  = await fetch("/api/students/import", { method: "POST", body: fd });
      const data = await res.json();
      setCsvResult(data);
      if (res.ok) { toast(`Imported ${data.imported || 0} students!`); setCsvModalOpen(false); setCsvFile(null); setCsvPreviewRows(null); fetchStudents(); }
      else toast("Import had errors", "error");
    } catch (err) { setCsvResult({ error: err.message }); toast("CSV import failed", "error"); }
    setCsvUploading(false);
  }

  const { students, total, pages } = data;
  const initials = (name) => (name || "?")[0].toUpperCase();
  const avatarColor = (name) => {
    const colors = ["bg-indigo-600", "bg-violet-600", "bg-blue-600", "bg-teal-600", "bg-rose-600", "bg-amber-600", "bg-slate-700"];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Toast toasts={toasts} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Student Directory</h1>
          <p className="page-subtitle">
            {total} student{total !== 1 ? "s" : ""} enrolled
            {riskType && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                {riskType} risk only
                <button onClick={() => { setRiskType(""); setPage(1); }} className="hover:text-red-700 underline ml-1">Clear</button>
              </span>
            )}
          </p>
        </div>
        {role === "ADMIN" && (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={async () => {
              const { doc, startY, addFooter } = await createPdf({ title: "Student Directory", subtitle: `${total} students` });
              const head = ["#", "Name", "Section", "Parent", "Phone", "Fee Status", "Attendance %", "Avg Score %"];
              const body = students.map((s, i) => [
                i + 1,
                s.user_id?.name || "—",
                s.section_id ? `${s.section_id.class_id?.name || ""} - ${s.section_id.name || ""}` : "—",
                s.parent_name || "—",
                s.user_id?.phoneOrEmail || "—",
                s.fee_status || "—",
                s.attendance_percentage != null ? `${Math.round(s.attendance_percentage)}%` : "—",
                s.performance_avg != null ? `${Math.round(s.performance_avg)}%` : "—",
              ]);
              addTable(doc, { startY, head, body });
              downloadPdf(doc, "students-report.pdf", addFooter);
            }} className="btn-secondary text-sm"><FileText size={15}/> Export PDF</button>
            <button onClick={() => setCsvModalOpen(true)} className="btn-secondary text-sm"><Upload size={15}/> Import CSV</button>
            <a href="/sample-students.csv" download className="btn-secondary text-sm"><Download size={15}/> Sample</a>
            <button onClick={openAdd} className="btn-primary"><Plus size={16}/> Add Student</button>
          </div>
        )}
      </div>

      {/* CSV result banner */}
      {csvResult && (
        <div className={`p-4 rounded-lg text-sm font-medium flex items-start justify-between gap-4 border ${csvResult.error ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
          <div>
            {csvResult.error || csvResult.message}
            {csvResult.errors?.length > 0 && <ul className="mt-1 text-xs list-disc list-inside opacity-80">{csvResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}</ul>}
          </div>
          <button onClick={() => setCsvResult(null)} className="text-xs font-semibold underline opacity-70 hover:opacity-100 whitespace-nowrap">Dismiss</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          <input type="text" placeholder="Search by name..." value={search} onChange={(e) => handleSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 outline-none transition-all shadow-sm" />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <select value={filterSection} onChange={(e) => { setFilterSection(e.target.value); setPage(1); }} className="pl-8 py-2 pr-3 bg-white border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 outline-none shadow-sm min-w-[160px]">
            <option value="">All Sections</option>
            {sections.map(b => <option key={b._id} value={b._id}>{b.class_id?.name || "?"} – {b.name}</option>)}
          </select>
        </div>
      </div>

      {/* Card grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card !p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl animate-shimmer" />
                <div className="space-y-1.5 flex-1"><div className="h-4 w-32 animate-shimmer rounded" /><div className="h-3 w-24 animate-shimmer rounded" /></div>
              </div>
              <div className="h-3 w-full animate-shimmer rounded" />
              <div className="h-3 w-3/4 animate-shimmer rounded" />
            </div>
          ))}
        </div>
      ) : students.length === 0 ? (
        <div className="card py-20 text-center border-dashed">
          <div className="w-12 h-12 bg-gray-100 text-gray-300 rounded-lg flex items-center justify-center mx-auto mb-3"><Users size={24} /></div>
          <h3 className="text-sm font-semibold text-gray-700">{search ? `No students matching "${search}"` : "No students yet"}</h3>
          <p className="text-sm text-gray-500 mt-1">{search ? "Try a different search." : "Add or import students to get started."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((s) => {
            const name    = s.user_id?.name || "Unknown";
            const contact = s.user_id?.phoneOrEmail || "—";
            const section = s.section_id ? `${s.section_id.class_id?.name || "?"} · ${s.section_id.name}` : "No Section";
            return (
              <div key={s._id} className="card !p-5 hover:shadow-md transition-shadow flex flex-col gap-3">
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl ${avatarColor(name)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                      {initials(name)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 text-sm truncate">{name}</div>
                      <div className="text-xs text-gray-400 truncate">{contact}</div>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 whitespace-nowrap flex-shrink-0">
                    {s.section_id?.name || "—"}
                  </span>
                </div>

                {/* Section / class */}
                <div className="text-xs text-gray-500">{section}</div>

                {/* Stats row */}
                <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Attendance</span>
                    <AttBadge pct={s.attendance_percentage} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Avg Score</span>
                    <PerfBadge pct={s.performance_avg} />
                  </div>
                  {s.due_fee > 0 && (
                    <div className="flex flex-col gap-0.5 ml-auto">
                      <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Fee Due</span>
                      <span className="text-xs font-bold text-red-600">₹{s.due_fee.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <Link href={`/students/${s._id}`} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors">
                    <Eye size={13} /> View Profile
                  </Link>
                  {(role === "ADMIN" || role === "TEACHER") && (
                    <>
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Edit"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteTarget(s)} className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors" title="Delete"><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-gray-500">Page {page} of {pages} · {total} total</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary !px-3 !py-1.5 text-xs disabled:opacity-40">
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, pages - 4));
              const n = start + i;
              return n <= pages ? (
                <button key={n} onClick={() => setPage(n)} className={`w-8 h-8 text-xs font-semibold rounded-md border transition-colors ${n === page ? "bg-gray-900 text-white border-slate-800" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>{n}</button>
              ) : null;
            })}
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} className="btn-secondary !px-3 !py-1.5 text-xs disabled:opacity-40">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingStudent(null); }} title={editingStudent ? "Edit Student" : "Add New Student"}>
        <form onSubmit={handleSave}>
          <div className="modal-body space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Full Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="e.g. Aarav Patel" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email / Phone</label>
                <input required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" placeholder="email or +91..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Admission Date</label>
                <input type="date" value={form.admission_date} onChange={(e) => setForm({ ...form, admission_date: e.target.value })} className="input-field" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Class</label>
                <select required value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value, section_id: "" })} className="input-field">
                  <option value="">Select class…</option>
                  {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Section / Batch</label>
                <select required value={form.section_id} onChange={(e) => setForm({ ...form, section_id: e.target.value })} className="input-field" disabled={!form.class_id}>
                  <option value="">Select section…</option>
                  {sections.filter(s => (s.class_id?._id || s.class_id) === form.class_id).map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Parent Name</label>
                <input required value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} className="input-field" placeholder="Parent name" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Parent Phone</label>
                <input required value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} className="input-field" placeholder="+91 98765..." />
              </div>
            </div>
            {!editingStudent && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Course Fee (₹)</label>
                  <input type="number" required value={form.total_fee} onChange={(e) => setForm({ ...form, total_fee: e.target.value })} className="input-field" placeholder="e.g. 45000" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Fee Due Date</label>
                  <input type="date" required value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="input-field" />
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" onClick={() => { setModalOpen(false); setEditingStudent(null); }} className="btn-secondary" disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Saving…" : editingStudent ? "Save Changes" : "Add Student"}</button>
          </div>
        </form>
      </Modal>

      {/* CSV Import Modal */}
      <Modal open={csvModalOpen} onClose={() => { setCsvModalOpen(false); setCsvFile(null); setCsvPreviewRows(null); }} title="Import Students (CSV)">
        <div className="modal-body space-y-4">
          <div className="bg-gray-50 text-gray-600 text-sm p-3.5 rounded-lg border border-gray-200">
            <p className="font-semibold text-gray-800 mb-1">Required Headers:</p>
            <code className="bg-white px-2.5 py-1 rounded-md text-slate-700 text-xs border border-gray-200 font-mono">name, parent_phone, section_name, admission_date</code>
          </div>
          <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive ? "border-slate-400 bg-slate-50" : "border-gray-200 bg-white hover:bg-gray-50"} ${csvFile ? "border-emerald-400 bg-emerald-50" : ""}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
            {csvFile ? (
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 mb-3"><CheckCircle size={22} /></div>
                <h3 className="font-semibold text-gray-800 text-sm">{csvFile.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{csvPreviewRows} row(s) found</p>
                <button onClick={() => { setCsvFile(null); setCsvPreviewRows(null); }} className="text-red-500 text-xs font-semibold mt-4 underline">Remove</button>
              </div>
            ) : (
              <label className="flex flex-col items-center cursor-pointer">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 mb-3"><Upload size={22} /></div>
                <h3 className="font-semibold text-gray-700 text-sm">Drag & Drop CSV</h3>
                <p className="text-sm text-gray-500 mt-1">or click to browse</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
              </label>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={() => { setCsvModalOpen(false); setCsvFile(null); }} className="btn-secondary" disabled={csvUploading}>Cancel</button>
          <button onClick={handleConfirmCSV} className={`btn-primary ${!csvFile ? "opacity-50 cursor-not-allowed" : ""}`} disabled={!csvFile || csvUploading}>{csvUploading ? "Importing…" : "Confirm & Import"}</button>
        </div>
      </Modal>

      <DeleteModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} name={deleteTarget?.user_id?.name || "this student"} deleting={deleting} />
    </div>
  );
}
