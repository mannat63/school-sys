"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Users, Upload, Plus, X, Download, Pencil, Trash2, CheckCircle, AlertCircle, Search, User, Bell, BarChart3, Activity } from "lucide-react";

// ─── Toast Component ───
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

// ─── Modal Component ───
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

// ─── Delete Confirm Modal ───
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
          <p className="text-sm text-gray-500">
            Remove <span className="font-semibold text-gray-700">{name}</span>? This cannot be undone.
          </p>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary" disabled={deleting}>Cancel</button>
          <button onClick={onConfirm} className="btn-danger" disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [riskType, setRiskType] = useState("");
  const [notifying, setNotifying] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", student_phone: "+91 ", class_id: "", section_id: "", parent_name: "", parent_phone: "+91 ", admission_date: "", total_fee: "", due_date: "" });
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreviewRows, setCsvPreviewRows] = useState(null);
  const [csvResult, setCsvResult] = useState(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [perfModalOpen, setPerfModalOpen] = useState(false);
  const [perfStudent, setPerfStudent] = useState(null);
  const [perfHistory, setPerfHistory] = useState([]);
  const [perfLoading, setPerfLoading] = useState(false);
  const [expandedTest, setExpandedTest] = useState(null);
  const fileRef = useRef(null);

  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const params = new URLSearchParams(window.location.search);
    const risk = params.get("risk");
    const query = risk ? `?risk=${risk}` : "";

    const [s, b, cRes, m] = await Promise.all([
      fetch(`/api/students${query}`).then((r) => r.json()),
      fetch("/api/sections").then((r) => r.json()),
      fetch("/api/classes").then((r) => r.json()),
      fetch("/api/me").then((r) => r.json()),
    ]);
    setStudents(Array.isArray(s) ? s : []);
    setSections(Array.isArray(b) ? b : []);
    setClasses(Array.isArray(cRes) ? cRes : []);
    setRole(m?.role || "STUDENT");
    setRiskType(risk || "");
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
      student_phone: s.student_phone || "+91 ",
      class_id: sec?.class_id?._id || sec?.class_id || "",
      section_id: s.section_id?._id || s.section_id || "",
      parent_name: s.parent_name || "",
      parent_phone: s.parent_phone || "",
      admission_date: s.admission_date ? new Date(s.admission_date).toLocaleDateString("en-CA") : "",
      total_fee: "",
      due_date: "",
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditingStudent(null); }

  async function handleSave(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = editingStudent ? `/api/students/${editingStudent._id}` : "/api/students";
      const method = editingStudent ? "PUT" : "POST";
      // Translate email into phoneOrEmail for the API
      const payload = { ...form, phoneOrEmail: form.email };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast(editingStudent ? "Student updated successfully" : "Student added successfully");
        closeModal();
        loadData();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to save", "error");
      }
    } catch {
      toast("Network error", "error");
    }
    setSubmitting(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/students/${deleteTarget._id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Student removed");
        setDeleteTarget(null);
        loadData();
      } else {
        toast("Failed to delete", "error");
      }
    } catch {
      toast("Network error", "error");
    }
    setDeleting(false);
  }

  async function handleNotify(s) {
    setNotifying(true);
    try {
      const res = await fetch("/api/students/notify-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          student_id: s._id, 
          risk_type: riskType, 
          risk_value: s.risk_info?.value || "Metric" 
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message || "Risk notification sent successfully!");
      } else {
        toast(data.error || "Notification failed", "error");
      }
    } catch {
      toast("Network error while notifying parent", "error");
    }
    setNotifying(false);
  }
  function handleDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  }

  function handleFileSelect(e) {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  }

  function processSelectedFile(file) {
    if (!file.name.endsWith(".csv")) {
      return toast("Please upload a valid .csv file", "error");
    }
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const rows = text.split("\n").filter(r => r.trim());
      setCsvPreviewRows(rows.length > 1 ? rows.length - 1 : 0);
    };
    reader.readAsText(file);
  }

  async function openPerformance(s) {
    setPerfStudent(s);
    setPerfModalOpen(true);
    setPerfLoading(true);
    setPerfHistory([]);
    setExpandedTest(null);
    try {
      const res = await fetch(`/api/students/${s._id}/performance`);
      if (res.ok) {
        const data = await res.json();
        setPerfHistory(Array.isArray(data) ? data : []);
      }
    } catch {
      toast("Failed to load history", "error");
    }
    setPerfLoading(false);
  }

  async function handleConfirmCSV() {
    if (!csvFile) return;
    setCsvUploading(true);
    setCsvResult(null);
    const formData = new FormData();
    formData.append("file", csvFile);
    try {
      const res = await fetch("/api/students/import", { method: "POST", body: formData });
      const data = await res.json();
      setCsvResult(data);
      if (res.ok) {
        toast(`Imported ${data.imported || 0} students!`);
        setCsvModalOpen(false);
        setCsvFile(null);
        setCsvPreviewRows(null);
        loadData();
      } else {
        toast("Import completed with errors", "error");
      }
    } catch (err) {
      setCsvResult({ error: err.message });
      toast("CSV import failed", "error");
    }
    setCsvUploading(false);
  }

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch = (
      (s.user_id?.name || "").toLowerCase().includes(q) ||
      (s.user_id?.phoneOrEmail || "").toLowerCase().includes(q) ||
      (s.section_id?.name || "").toLowerCase().includes(q) ||
      (s.parent_name || "").toLowerCase().includes(q)
    );
    const matchesSection = filterSection ? (s.section_id?._id === filterSection || s.section_id === filterSection) : true;
    return matchesSearch && matchesSection;
  });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 w-40 animate-shimmer rounded-lg" />
          <div className="h-10 w-32 animate-shimmer rounded-lg" />
        </div>
        <div className="card !p-0">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-100">
              <div className="w-8 h-8 animate-shimmer rounded-md" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 animate-shimmer rounded" />
                <div className="h-3 w-48 animate-shimmer rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Toast toasts={toasts} />

      {/* ─── Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Student Directory</h1>
          <p className="page-subtitle">
            {students.length} student{students.length !== 1 ? "s" : ""} currently enrolled in the institute.
            {riskType && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                Showing {riskType} risk only
                <button onClick={() => { window.location.href='/students'; }} className="hover:text-red-700 underline ml-1">Clear</button>
              </span>
            )}
          </p>
        </div>
        {role === "ADMIN" && (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setCsvModalOpen(true)} className="btn-secondary text-sm">
              <Upload size={15}/> Import CSV
            </button>
            <a href="/sample-students.csv" download className="btn-secondary text-sm">
              <Download size={15}/> Sample
            </a>
            <button onClick={openAdd} className="btn-primary">
              <Plus size={16}/> Add Student
            </button>
          </div>
        )}
      </div>

      {/* ─── CSV Result ─── */}
      {csvResult && (
        <div className={`p-4 rounded-lg text-sm font-medium flex items-start justify-between gap-4 border ${csvResult.error ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
          <div>
            <div>{csvResult.error || csvResult.message}</div>
            {csvResult.errors?.length > 0 && (
              <ul className="mt-1 text-xs list-disc list-inside opacity-80">
                {csvResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
          <button onClick={() => setCsvResult(null)} className="text-xs font-semibold underline opacity-70 hover:opacity-100 whitespace-nowrap">Dismiss</button>
        </div>
      )}

      {/* ─── Search ─── */}
      {students.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input type="text" placeholder="Search students..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 outline-none transition-all shadow-sm" />
          </div>
          <select
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value)}
            className="py-2 px-3 bg-white border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 outline-none shadow-sm min-w-[160px]"
          >
            <option value="">All Sections</option>
            {sections.map(b => (
              <option key={b._id} value={b._id}>{b.class_id?.name || "No Class"} - {b.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ─── Table ─── */}
      <div className="card !p-0">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="min-w-[180px]">Student</th>
                <th className="min-w-[160px]">Contact</th>
                <th className="min-w-[150px]">Section</th>
                {riskType ? (
                   <th className="min-w-[130px]">Risk Metrics</th>
                ) : (
                  <>
                    <th className="min-w-[130px]">Attendance (30D)</th>
                    <th className="min-w-[120px]">Exam Avg.</th>
                  </>
                )}
                <th className="min-w-[150px]">Parent Name</th>
                <th className="min-w-[140px]">Phone No.</th>
                <th className="min-w-[120px]">Admission</th>
                <th className="min-w-[110px]">Total Fee</th>
                {(role === "ADMIN" || role === "TEACHER") && <th className="text-right min-w-[100px]">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => (
                <tr key={s._id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-slate-700 rounded-md flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {(s.user_id?.name || "?")[0].toUpperCase()}
                      </div>
                      <span className="font-semibold text-gray-800 text-sm">{s.user_id?.name || "—"}</span>
                    </div>
                  </td>
                  <td>
                    <div className="max-w-[150px] truncate-fade text-sm text-gray-500" title={s.user_id?.phoneOrEmail || "—"}>
                      {s.user_id?.phoneOrEmail || "—"}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-slate whitespace-nowrap">
                      <Users size={12} className="mr-1" />
                      {s.section_id ? `${s.section_id.class_id?.name || "No Class"} - ${s.section_id.name}` : "No Section"}
                    </span>
                  </td>
                  {riskType ? (
                    <td>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{s.risk_info?.label || "Metric"}</span>
                        <span className={`text-sm font-bold ${riskType === 'fees' ? 'text-red-600' : 'text-amber-600'}`}>{s.risk_info?.value || "—"}</span>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td>
                        <div className="flex flex-col">
                          <div className={`text-xs font-bold ${s.attendance_percentage < 75 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {s.attendance_percentage !== null ? `${s.attendance_percentage.toFixed(1)}%` : "—"}
                          </div>
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${s.attendance_percentage < 50 ? 'bg-red-500' : s.attendance_percentage < 75 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                              style={{ width: `${s.attendance_percentage || 0}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <button onClick={() => openPerformance(s)} className="group flex items-center gap-1.5 px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-all">
                          <BarChart3 size={13} className="text-slate-500 group-hover:text-slate-700" />
                          <span className="text-[11px] font-bold text-slate-600 group-hover:text-slate-800">
                             {s.performance_avg !== null ? `${s.performance_avg.toFixed(1)}%` : "View"}
                          </span>
                        </button>
                      </td>
                    </>
                  )}
                  <td className="text-gray-600 text-sm">{s.parent_name || "—"}</td>
                  <td className="text-gray-500 font-mono text-xs">{s.parent_phone || "—"}</td>
                  <td className="text-gray-500 text-xs">
                    {s.admission_date ? new Date(s.admission_date).toLocaleDateString('en-GB') : "—"}
                  </td>
                  <td className="text-gray-700 font-semibold text-xs tracking-wide">
                    ₹{s.total_fee?.toLocaleString() || "0"}
                  </td>
                  {(role === "ADMIN" || role === "TEACHER") && (
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {riskType && (
                          <button onClick={() => handleNotify(s)} disabled={notifying} className="mr-2 btn-ghost !p-1.5 rounded-md text-amber-600 hover:bg-amber-50" title="Notify Parent">
                            <Bell size={14} />
                          </button>
                        )}
                        <button onClick={() => openEdit(s)} className="btn-ghost !p-1.5 rounded-md text-gray-400" title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteTarget(s)} className="btn-ghost !p-1.5 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && students.length > 0 && (
                <tr>
                  <td colSpan={role === "ADMIN" ? 8 : 7} className="py-10 text-center text-gray-400">
                    No students match &ldquo;{search}&rdquo;
                  </td>
                </tr>
              )}
              {students.length === 0 && (
                <tr>
                  <td colSpan={role === "ADMIN" ? 8 : 7} className="py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 bg-gray-100 text-gray-300 rounded-lg flex items-center justify-center mb-3">
                        <Users size={24} />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-700">No students yet</h3>
                      <p className="text-sm text-gray-500 mt-1 max-w-xs">Add or import students to get started.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Add / Edit Modal ─── */}
      <Modal open={modalOpen} onClose={closeModal} title={editingStudent ? "Edit Student" : "Add New Student"}>
        <form onSubmit={handleSave}>
          <div className="modal-body space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Full Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="e.g. Aarav Patel" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Student Email</label>
                <input required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" placeholder="e.g. aarav@example.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Student Phone</label>
                <input value={form.student_phone} onChange={(e) => setForm({ ...form, student_phone: e.target.value })} className="input-field" placeholder="e.g. +91 98000..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Class</label>
                <select required value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value, section_id: "" })} className="input-field">
                  <option value="">Select class...</option>
                  {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Section</label>
                <select required value={form.section_id} onChange={(e) => setForm({ ...form, section_id: e.target.value })} className="input-field" disabled={!form.class_id}>
                  <option value="">Select section...</option>
                  {sections.filter(s => (s.class_id?._id || s.class_id) === form.class_id).map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
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
                <input required value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} className="input-field" placeholder="+91..." />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Admission Date</label>
              <input type="date" value={form.admission_date} onChange={(e) => setForm({ ...form, admission_date: e.target.value })} className="input-field" />
            </div>
            {!editingStudent && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Total Course Fee</label>
                  <input type="number" required value={form.total_fee} onChange={(e) => setForm({ ...form, total_fee: e.target.value })} className="input-field" placeholder="e.g. 20000" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Fee Due Date</label>
                  <input type="date" required value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="input-field" />
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" onClick={closeModal} className="btn-secondary" disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Saving..." : editingStudent ? "Save Changes" : "Add Student"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── CSV Import Modal ─── */}
      <Modal open={csvModalOpen} onClose={() => { setCsvModalOpen(false); setCsvFile(null); setCsvPreviewRows(null); setCsvResult(null); }} title="Import Students (CSV)">
        <div className="modal-body space-y-4">
          <div className="bg-gray-50 text-gray-600 text-sm p-3.5 rounded-lg border border-gray-200">
            <p className="font-semibold text-gray-800 mb-1">Required Headers:</p>
            <code className="bg-white px-2.5 py-1 rounded-md text-slate-700 text-xs border border-gray-200 font-mono">name, parent_phone, section_name, admission_date</code>
          </div>
          
          <div 
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive ? "border-slate-400 bg-slate-50" : "border-gray-200 bg-white hover:bg-gray-50"} ${csvFile ? "border-emerald-400 bg-emerald-50" : ""}`}
            onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
          >
            {csvFile ? (
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 mb-3"><CheckCircle size={22} /></div>
                <h3 className="font-semibold text-gray-800 text-sm">{csvFile.name}</h3>
                <p className="text-sm text-gray-500 mt-1">Found {csvPreviewRows} row(s) inside.</p>
                <button onClick={() => { setCsvFile(null); setCsvPreviewRows(null); }} className="text-red-500 hover:text-red-700 text-xs font-semibold mt-4 underline">Remove file</button>
              </div>
            ) : (
              <label className="flex flex-col items-center cursor-pointer">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 mb-3"><Upload size={22} /></div>
                <h3 className="font-semibold text-gray-700 text-sm">Drag & Drop your CSV</h3>
                <p className="text-sm text-gray-500 mt-1">or click to browse your files</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
              </label>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={() => { setCsvModalOpen(false); setCsvFile(null); }} className="btn-secondary" disabled={csvUploading}>Cancel</button>
          <button onClick={handleConfirmCSV} className={`btn-primary ${!csvFile ? "opacity-50 cursor-not-allowed" : ""}`} disabled={!csvFile || csvUploading}>
            {csvUploading ? "Importing..." : "Confirm & Import"}
          </button>
        </div>
      </Modal>

      <DeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        name={deleteTarget?.user_id?.name || "this student"}
        deleting={deleting}
      />

      {/* ─── Performance History Modal ─── */}
      <Modal open={perfModalOpen} onClose={() => setPerfModalOpen(false)} title="Test Performance History">
        <div className="modal-body !p-0 max-h-[500px] overflow-y-auto">
          {perfStudent && (
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-slate-700 text-white flex items-center justify-center rounded-lg font-bold text-lg">
                    {(perfStudent.user_id?.name || "?")[0]}
                 </div>
                 <div>
                    <h3 className="font-bold text-gray-900 leading-none">{perfStudent.user_id?.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {perfStudent.section_id?.class_id?.name
                        ? `${perfStudent.section_id.class_id.name} · ${perfStudent.section_id.name}`
                        : (perfStudent.section_id?.name || "No Section")}
                    </p>
                 </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Average Score</div>
                <div className="text-xl font-bold text-slate-800">{perfStudent.performance_avg !== null ? `${perfStudent.performance_avg.toFixed(1)}%` : "—"}</div>
              </div>
            </div>
          )}
          
          <div className="p-4">
            {perfLoading ? (
               <div className="py-20 flex flex-col items-center justify-center gap-3 opacity-50">
                  <Activity size={32} className="animate-spin text-slate-400" />
                  <p className="text-sm font-medium">Crunching records...</p>
               </div>
            ) : perfHistory.length > 0 ? (
               <div className="space-y-2">
                 {perfHistory.map((res, i) => {
                   const pct = res.percentage ?? 0;
                   const isExpanded = expandedTest === i;
                   return (
                     <div key={i} className="rounded-lg border border-gray-100 overflow-hidden shadow-sm">
                       {/* Row header — clickable */}
                       <div
                         onClick={() => setExpandedTest(isExpanded ? null : i)}
                         className="flex items-center justify-between p-3 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                       >
                         <div className="space-y-0.5">
                           <div className="font-bold text-gray-800 text-sm">{res.test_id?.name || "Unknown test"}</div>
                           <div className="text-[10px] text-gray-400 font-medium uppercase flex items-center gap-1.5">
                             {res.test_id?.section || ""}
                             {res.test_id?.section && res.test_id?.date ? " · " : ""}
                             {res.test_id?.date ? new Date(res.test_id.date).toLocaleDateString("en-GB") : "—"}
                           </div>
                         </div>
                         <div className="text-right flex items-center gap-3">
                           <div>
                             <div className="text-sm font-bold text-slate-700">{res.total_earned ?? "—"} / {res.total_marks ?? "—"}</div>
                             <div className={`text-[11px] font-bold ${ pct >= 75 ? "text-emerald-500" : pct >= 40 ? "text-amber-500" : "text-red-500" }`}>
                               {pct.toFixed(1)}%
                             </div>
                           </div>
                           <span className="text-gray-300 text-sm">{isExpanded ? "▲" : "▼"}</span>
                         </div>
                       </div>

                       {/* Expanded subject breakdown */}
                       {isExpanded && res.subject_marks?.length > 0 && (
                         <div className="border-t border-gray-100 bg-gray-50/80">
                           <table className="w-full text-xs">
                             <thead>
                               <tr className="border-b border-gray-100">
                                 <th className="text-left px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider">Subject</th>
                                 <th className="text-right px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider">Max</th>
                                 <th className="text-right px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider">Scored</th>
                                 <th className="text-right px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider">%</th>
                               </tr>
                             </thead>
                             <tbody>
                               {res.subject_marks.map((sm, j) => (
                                 <tr key={j} className="border-b border-gray-100 last:border-0">
                                   <td className="px-4 py-2 font-medium text-gray-700">{sm.subject}</td>
                                   <td className="px-4 py-2 text-right text-gray-400 font-mono">{sm.max_marks}</td>
                                   <td className="px-4 py-2 text-right font-bold text-gray-800 font-mono">{sm.marks}</td>
                                   <td className={`px-4 py-2 text-right font-bold ${ sm.pct >= 75 ? "text-emerald-600" : sm.pct >= 40 ? "text-amber-600" : "text-red-600" }`}>{sm.pct}%</td>
                                 </tr>
                               ))}
                             </tbody>
                           </table>
                         </div>
                       )}
                     </div>
                   );
                 })}
               </div>
            ) : (
               <div className="py-20 text-center text-gray-400 border-dashed border border-gray-100 rounded-lg">
                  <BarChart3 size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No test results found for this student.</p>
               </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={() => setPerfModalOpen(false)} className="btn-primary w-full">Close View</button>
        </div>
      </Modal>
    </div>
  );
}
