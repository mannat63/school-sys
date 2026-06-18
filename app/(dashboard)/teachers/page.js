"use client";

import { useEffect, useState, useCallback } from "react";
import { GraduationCap, Plus, X, Pencil, Trash2, Check, AlertCircle, CheckCircle, Search, Eye, Users, BookOpen, FileText, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 30;
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

function DeleteModal({ open, onClose, onConfirm, name, deleting }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-8 text-center">
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-lg flex items-center justify-center mx-auto mb-4"><Trash2 size={20} /></div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">Delete Teacher</h3>
          <p className="text-sm text-gray-500">Remove <span className="font-semibold text-gray-700">{name}</span>? This cannot be undone.</p>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary" disabled={deleting}>Cancel</button>
          <button onClick={onConfirm} className="btn-danger" disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</button>
        </div>
      </div>
    </div>
  );
}

const COLORS = ["bg-indigo-600", "bg-violet-600", "bg-blue-600", "bg-teal-600", "bg-rose-600", "bg-amber-600", "bg-slate-700"];
const avatarColor = (name) => COLORS[(name?.charCodeAt(0) || 0) % COLORS.length];

export default function TeachersPage() {
  const [teachers, setTeachers]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [role, setRole]                 = useState("");
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(1);

  const [showForm, setShowForm]         = useState(false);
  const [creating, setCreating]         = useState(false);
  const [form, setForm]                 = useState({ name: "", email: "", phone: "+91 ", subjects: [] });

  const [editId, setEditId]             = useState(null);
  const [editForm, setEditForm]         = useState({ name: "", email: "", phone: "+91 ", subjects: [] });
  const [saving, setSaving]             = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [t, m, s] = await Promise.all([
        fetch("/api/teachers").then(r => r.json()),
        fetch("/api/me").then(r => r.json()),
        fetch("/api/subjects").then(r => r.json()),
      ]);
      setTeachers(Array.isArray(t) ? t : []);
      setRole(m?.role || "STUDENT");
      setAvailableSubjects(Array.isArray(s) ? s : []);
    } catch { toast("Failed to load", "error"); }
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  async function handleSubmit(e) {
    e.preventDefault(); setCreating(true);
    try {
      const res = await fetch("/api/teachers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { setShowForm(false); setForm({ name: "", email: "", phone: "+91 ", subjects: [] }); loadAll(); toast("Teacher added"); }
      else { const err = await res.json(); toast(err.error || "Failed to add", "error"); }
    } catch { toast("Network error", "error"); }
    setCreating(false);
  }

  async function handleEdit(e) {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch(`/api/teachers/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) });
      if (res.ok) { loadAll(); setEditId(null); toast("Teacher updated"); }
      else { const err = await res.json(); toast(err.error || "Update failed", "error"); }
    } catch { toast("Network error", "error"); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/teachers/${deleteTarget._id}`, { method: "DELETE" });
      if (res.ok) { loadAll(); setDeleteTarget(null); toast("Teacher deleted"); }
      else { const err = await res.json(); toast(err.error || "Delete failed", "error"); }
    } catch { toast("Network error", "error"); }
    setDeleting(false);
  }

  const filtered = teachers.filter(t => {
    const q = search.toLowerCase();
    return !q || (t.user_id?.name || "").toLowerCase().includes(q) || (t.user_id?.phoneOrEmail || "").toLowerCase().includes(q) || (t.subjects || []).some(s => (s.name || "").toLowerCase().includes(q));
  });

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="h-8 w-48 animate-shimmer rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="card !p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl animate-shimmer" />
                <div className="space-y-1.5 flex-1"><div className="h-4 w-28 animate-shimmer rounded" /><div className="h-3 w-20 animate-shimmer rounded" /></div>
              </div>
              <div className="h-3 w-full animate-shimmer rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Toast toasts={toasts} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">{role === "STUDENT" ? "Our Faculty" : "Teachers"}</h1>
          <p className="page-subtitle">
            {role === "STUDENT" ? "Expert faculty dedicated to your success." : `${teachers.length} teacher${teachers.length !== 1 ? "s" : ""} on the faculty`}
          </p>
        </div>
        {role === "ADMIN" && (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={async () => {
              const { doc, startY, addFooter } = await createPdf({ title: "Faculty Directory", subtitle: `${teachers.length} teachers` });
              const head = ["#", "Name", "Contact", "Subjects"];
              const body = teachers.map((t, i) => [
                i + 1,
                t.user_id?.name || "—",
                t.user_id?.phoneOrEmail || "—",
                (t.subjects || []).map(s => s.name).join(", ") || "—",
              ]);
              addTable(doc, { startY, head, body });
              downloadPdf(doc, "teachers-report.pdf", addFooter);
            }} className="btn-secondary text-sm"><FileText size={15}/> Export PDF</button>
            <button onClick={() => setShowForm(!showForm)} className={`btn-primary ${showForm ? "!bg-gray-500 hover:!bg-gray-600" : ""}`}>
              {showForm ? <><X size={16} /> Cancel</> : <><Plus size={16} /> Add Teacher</>}
            </button>
          </div>
        )}
      </div>

      {/* Add form */}
      {showForm && role === "ADMIN" && (
        <form onSubmit={handleSubmit} className="card bg-gray-50 space-y-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">New Teacher</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Full Name</label>
              <input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" disabled={creating} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
              <input type="email" required placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" disabled={creating} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Phone</label>
              <input required pattern="^\+91 \d{10}$" title="+91 followed by 10 digits" placeholder="+91 9876543210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" disabled={creating} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Assign Subjects</label>
            <div className="flex flex-wrap gap-2">
              {availableSubjects.map(sub => (
                <label key={sub._id} className="flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-1.5 rounded-md text-xs cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" className="accent-slate-700" checked={form.subjects?.includes(sub._id) || false} onChange={(e) => { const s = form.subjects || []; setForm({ ...form, subjects: e.target.checked ? [...s, sub._id] : s.filter(x => x !== sub._id) }); }} />
                  {sub.name}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={creating}>{creating ? "Saving…" : "Save Teacher"}</button>
        </form>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
        <input type="text" placeholder="Search by name or subject…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 outline-none transition-all shadow-sm" />
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="card py-16 text-center border-dashed">
          <div className="w-12 h-12 bg-gray-100 text-gray-300 rounded-lg flex items-center justify-center mx-auto mb-3"><GraduationCap size={24} /></div>
          <h3 className="text-sm font-semibold text-gray-700">{search ? `No teachers matching "${search}"` : "No teachers yet"}</h3>
          <p className="text-sm text-gray-500 mt-1">Add faculty members to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginated.map(t => editId === t._id ? (
            /* Inline edit */
            <form key={t._id} onSubmit={handleEdit} className="card !p-5 flex flex-col gap-3 border-2 border-slate-300 bg-slate-50">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Editing</p>
              <input required placeholder="Full name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="input-field" />
              <input type="email" placeholder="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="input-field" />
              <input placeholder="+91 9876543210" pattern="^\+91 \d{10}$" title="+91 followed by 10 digits" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="input-field" />
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                {availableSubjects.map(sub => (
                  <label key={sub._id} className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-md text-[10px] uppercase font-bold text-slate-600 cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" className="accent-slate-700 w-3 h-3" checked={editForm.subjects?.includes(sub._id) || false} onChange={(e) => { const s = editForm.subjects || []; setEditForm({ ...editForm, subjects: e.target.checked ? [...s, sub._id] : s.filter(x => x !== sub._id) }); }} />
                    {sub.name}
                  </label>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setEditId(null)} className="px-3 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-md hover:bg-gray-100">Cancel</button>
                <button type="submit" disabled={saving} className="px-3 py-1.5 text-xs font-bold bg-slate-700 text-white rounded-md hover:bg-gray-900 flex items-center gap-1.5">
                  <Check size={13} /> {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          ) : (
            /* Normal card */
            <div key={t._id} className="card !p-5 hover:shadow-md transition-shadow flex flex-col gap-3">
              {/* Top */}
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-xl ${avatarColor(t.user_id?.name)} flex items-center justify-center text-white font-bold text-base flex-shrink-0`}>
                  {(t.user_id?.name || "T")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm">{t.user_id?.name || "—"}</div>
                  <div className="text-xs text-gray-400 truncate">{t.user_id?.phoneOrEmail || "—"}</div>
                </div>
                {role === "ADMIN" && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => { setEditId(t._id); setEditForm({ name: t.user_id?.name || "", email: t.user_id?.phoneOrEmail?.includes("@") ? t.user_id.phoneOrEmail : "", phone: !t.user_id?.phoneOrEmail?.includes("@") ? (t.user_id?.phoneOrEmail || "+91 ") : "+91 ", subjects: t.subjects?.map(s => typeof s === "object" ? s._id : s) || [] }); }} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors" title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleteTarget(t)} className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Subjects */}
              <div className="flex flex-wrap gap-1.5">
                {(t.subjects || []).length > 0 ? t.subjects.map(s => (
                  <span key={s._id} className="flex items-center gap-1 text-[9px] uppercase font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                    <BookOpen size={9} /> {s.name}
                  </span>
                )) : (
                  <span className="text-[9px] uppercase font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">No subjects</span>
                )}
              </div>

              {/* Profile button */}
              <div className="pt-1 border-t border-gray-100">
                <Link href={`/teachers/${t._id}`} className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors w-full">
                  <Eye size={13} /> View Profile
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-gray-500">Page {page} of {pages} · {filtered.length} teachers</p>
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

      <DeleteModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} name={deleteTarget?.user_id?.name || "this teacher"} deleting={deleting} />
    </div>
  );
}
