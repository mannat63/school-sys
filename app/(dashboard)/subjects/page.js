"use client";

import { useEffect, useState } from "react";
import { BookOpen, Plus, X, Layers, Users, ChevronDown, ChevronRight, Pencil, Trash2, Check, AlertCircle, CheckCircle } from "lucide-react";

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

function DeleteModal({ open, onClose, onConfirm, label, deleting }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-8 text-center">
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-lg flex items-center justify-center mx-auto mb-4"><Trash2 size={20} /></div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">Delete {label}?</h3>
          <p className="text-sm text-gray-500">This cannot be undone.</p>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary" disabled={deleting}>Cancel</button>
          <button onClick={onConfirm} className="btn-danger" disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</button>
        </div>
      </div>
    </div>
  );
}

export default function SubjectsPage() {
  const [subjects, setSubjects]         = useState([]);
  const [courses, setCourses]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState("courses");
  const [expanded, setExpanded]         = useState({});

  // Subject form
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [subjectForm, setSubjectForm]   = useState({ name: "" });
  const [creatingSubject, setCreatingSubject] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editingSubjectName, setEditingSubjectName] = useState("");
  const [deleteSubjectTarget, setDeleteSubjectTarget] = useState(null);
  const [deletingSubject, setDeletingSubject] = useState(false);

  // Course (Class) form
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseForm, setCourseForm]     = useState({ name: "" });
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [editingCourseName, setEditingCourseName] = useState("");
  const [deleteCourseTarget, setDeleteCourseTarget] = useState(null);
  const [deletingCourse, setDeletingCourse] = useState(false);

  const [toasts, setToasts] = useState([]);
  const toast = (msg, type = "success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  };

  async function loadAll() {
    setLoading(true);
    try {
      const [subs, overview] = await Promise.all([
        fetch("/api/subjects").then(r => r.json()),
        fetch("/api/subjects/overview").then(r => r.json()),
      ]);
      setSubjects(Array.isArray(subs) ? subs : []);
      setCourses(Array.isArray(overview.courses) ? overview.courses : []);
    } catch { toast("Failed to load", "error"); }
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  // ── Subject handlers ─────────────────────────────────────────────────────────
  async function handleAddSubject(e) {
    e.preventDefault(); setCreatingSubject(true);
    try {
      const res = await fetch("/api/subjects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subjectForm) });
      if (res.ok) { setShowSubjectForm(false); setSubjectForm({ name: "" }); loadAll(); toast("Subject added"); }
      else { const d = await res.json(); toast(d.error || "Failed to add", "error"); }
    } catch { toast("Network error", "error"); }
    setCreatingSubject(false);
  }

  async function handleEditSubject(id) {
    if (!editingSubjectName.trim()) return toast("Name cannot be empty", "error");
    try {
      const res = await fetch(`/api/subjects/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editingSubjectName }) });
      if (res.ok) { setEditingSubjectId(null); loadAll(); toast("Subject updated"); }
      else { const d = await res.json(); toast(d.error || "Update failed", "error"); }
    } catch { toast("Network error", "error"); }
  }

  async function handleDeleteSubject() {
    if (!deleteSubjectTarget) return;
    setDeletingSubject(true);
    try {
      const res = await fetch(`/api/subjects/${deleteSubjectTarget._id}`, { method: "DELETE" });
      if (res.ok) { loadAll(); setDeleteSubjectTarget(null); toast("Subject deleted"); }
      else { const d = await res.json(); toast(d.error || "Delete failed", "error"); }
    } catch { toast("Network error", "error"); }
    setDeletingSubject(false);
  }

  // ── Course (Class) handlers ──────────────────────────────────────────────────
  async function handleAddCourse(e) {
    e.preventDefault(); setCreatingCourse(true);
    try {
      const res = await fetch("/api/classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(courseForm) });
      if (res.ok) { setShowCourseForm(false); setCourseForm({ name: "" }); loadAll(); toast("Course added"); }
      else { const d = await res.json(); toast(d.error || "Failed to add", "error"); }
    } catch { toast("Network error", "error"); }
    setCreatingCourse(false);
  }

  async function handleEditCourse(id) {
    if (!editingCourseName.trim()) return toast("Name cannot be empty", "error");
    try {
      const res = await fetch(`/api/classes/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editingCourseName }) });
      if (res.ok) { setEditingCourseId(null); loadAll(); toast("Course updated"); }
      else { const d = await res.json(); toast(d.error || "Update failed", "error"); }
    } catch { toast("Network error", "error"); }
  }

  async function handleDeleteCourse() {
    if (!deleteCourseTarget) return;
    setDeletingCourse(true);
    try {
      const res = await fetch(`/api/classes/${deleteCourseTarget.classId}`, { method: "DELETE" });
      if (res.ok) { loadAll(); setDeleteCourseTarget(null); toast("Course deleted"); }
      else { const d = await res.json(); toast(d.error || "Delete failed", "error"); }
    } catch { toast("Network error", "error"); }
    setDeletingCourse(false);
  }

  function toggle(id) { setExpanded(prev => ({ ...prev, [id]: !prev[id] })); }

  if (loading) return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="h-8 w-48 animate-shimmer rounded-xl" />
      <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 animate-shimmer rounded-lg" />)}</div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Toast toasts={toasts} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Courses & Subjects</h1>
          <p className="page-subtitle">{courses.length} course{courses.length !== 1 ? "s" : ""} · {subjects.length} subject{subjects.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowCourseForm(!showCourseForm); setShowSubjectForm(false); }} className={`btn-secondary text-sm ${showCourseForm ? "!bg-gray-200" : ""}`}>
            {showCourseForm ? <><X size={14}/> Cancel</> : <><Plus size={14}/> Add Course</>}
          </button>
          <button onClick={() => { setShowSubjectForm(!showSubjectForm); setShowCourseForm(false); }} className={`btn-primary ${showSubjectForm ? "!bg-gray-500 hover:!bg-gray-600" : ""}`}>
            {showSubjectForm ? <><X size={16}/> Cancel</> : <><Plus size={16}/> Add Subject</>}
          </button>
        </div>
      </div>

      {/* Add Course form */}
      {showCourseForm && (
        <form onSubmit={handleAddCourse} className="card bg-indigo-50 border border-indigo-100 flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-1.5">Course Name</label>
            <input placeholder="e.g. JEE 2025, NEET 12, Foundation" required value={courseForm.name} onChange={(e) => setCourseForm({ name: e.target.value })} className="input-field" disabled={creatingCourse} autoFocus />
          </div>
          <button type="submit" className="btn-primary" disabled={creatingCourse}>{creatingCourse ? "Saving…" : "Save Course"}</button>
        </form>
      )}

      {/* Add Subject form */}
      {showSubjectForm && (
        <form onSubmit={handleAddSubject} className="card bg-gray-50 flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Subject Name</label>
            <input placeholder="e.g. Physics, Chemistry, Maths…" required value={subjectForm.name} onChange={(e) => setSubjectForm({ name: e.target.value })} className="input-field" disabled={creatingSubject} autoFocus />
          </div>
          <button type="submit" className="btn-primary" disabled={creatingSubject}>{creatingSubject ? "Saving…" : "Save Subject"}</button>
        </form>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button onClick={() => setTab("courses")} className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${tab === "courses" ? "border-slate-800 text-slate-900" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
          <Layers size={14} /> Course Hierarchy
        </button>
        <button onClick={() => setTab("subjects")} className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${tab === "subjects" ? "border-slate-800 text-slate-900" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
          <BookOpen size={14} /> All Subjects
        </button>
      </div>

      {/* ── Course Hierarchy tab ── */}
      {tab === "courses" && (
        <div className="space-y-3">
          {courses.length === 0 ? (
            <div className="card py-16 text-center border-dashed">
              <Layers size={28} className="mx-auto mb-2 text-gray-300" />
              <h3 className="text-sm font-semibold text-gray-700">No courses yet</h3>
              <p className="text-sm text-gray-500 mt-1">Click "Add Course" above to create your first course.</p>
            </div>
          ) : courses.map(course => (
            <div key={course.classId} className="card !p-0 overflow-hidden">
              {/* Course row */}
              <div className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
                <button onClick={() => toggle(course.classId)} className="flex items-center gap-3 flex-1 text-left min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {(course.className || "?")[0].toUpperCase()}
                  </div>
                  {editingCourseId === course.classId ? (
                    <input
                      value={editingCourseName}
                      onChange={e => setEditingCourseName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleEditCourse(course.classId); } if (e.key === "Escape") setEditingCourseId(null); }}
                      onClick={e => e.stopPropagation()}
                      className="input-field !py-1 text-sm flex-1"
                      autoFocus
                    />
                  ) : (
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{course.className}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1"><Layers size={10} />{course.sections.length} section{course.sections.length !== 1 ? "s" : ""}</span>
                        <span className="flex items-center gap-1"><Users size={10} />{course.totalStudents} students</span>
                        {course.subjects.length > 0 && <span className="flex items-center gap-1"><BookOpen size={10} />{course.subjects.length} subjects</span>}
                      </div>
                    </div>
                  )}
                  {expanded[course.classId] ? <ChevronDown size={16} className="text-gray-400 ml-auto flex-shrink-0" /> : <ChevronRight size={16} className="text-gray-400 ml-auto flex-shrink-0" />}
                </button>
                {/* Inline edit actions */}
                <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {editingCourseId === course.classId ? (
                    <>
                      <button onClick={() => handleEditCourse(course.classId)} className="p-1.5 rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200" title="Save"><Check size={14} /></button>
                      <button onClick={() => setEditingCourseId(null)} className="p-1.5 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200" title="Cancel"><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditingCourseId(course.classId); setEditingCourseName(course.className); }} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors" title="Rename"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteCourseTarget(course)} className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors" title="Delete"><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>

              {/* Expanded */}
              {expanded[course.classId] && (
                <div className="border-t border-gray-100 bg-gray-50/50">
                  {course.subjects.length > 0 && (
                    <div className="px-5 py-3 border-b border-gray-100">
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">Subjects in this course</p>
                      <div className="flex flex-wrap gap-1.5">
                        {course.subjects.map(sub => (
                          <span key={sub} className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-md">{sub}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="divide-y divide-gray-100">
                    {course.sections.length > 0 ? course.sections.map(sec => (
                      <div key={sec.id} className="flex items-center justify-between px-5 py-2.5">
                        <div className="text-sm font-medium text-gray-700">{sec.name}</div>
                        <span className="text-xs font-semibold text-slate-500 bg-white border border-gray-200 px-2 py-0.5 rounded flex items-center gap-1"><Users size={10} /> {sec.studentCount}</span>
                      </div>
                    )) : (
                      <div className="px-5 py-3 text-xs text-gray-400">No sections yet. Add sections in Classes & Sections.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── All Subjects tab ── */}
      {tab === "subjects" && (
        <div>
          {subjects.length === 0 ? (
            <div className="card py-16 text-center border-dashed">
              <BookOpen size={28} className="mx-auto mb-2 text-gray-300" />
              <h3 className="text-sm font-semibold text-gray-700">No subjects yet</h3>
              <p className="text-sm text-gray-500 mt-1">Add subjects to assign to teachers and tests.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {subjects.map(s => (
                <div key={s._id} className="card !p-4 hover:shadow-md transition-shadow flex items-center gap-3 group">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg flex-shrink-0"><BookOpen size={18} /></div>
                  {editingSubjectId === s._id ? (
                    <input
                      value={editingSubjectName}
                      onChange={e => setEditingSubjectName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleEditSubject(s._id); } if (e.key === "Escape") setEditingSubjectId(null); }}
                      className="input-field !py-1 text-sm flex-1"
                      autoFocus
                    />
                  ) : (
                    <span className="text-sm font-semibold text-gray-800 flex-1">{s.name}</span>
                  )}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {editingSubjectId === s._id ? (
                      <>
                        <button onClick={() => handleEditSubject(s._id)} className="p-1 rounded bg-emerald-100 text-emerald-700"><Check size={12} /></button>
                        <button onClick={() => setEditingSubjectId(null)} className="p-1 rounded bg-gray-100 text-gray-500"><X size={12} /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingSubjectId(s._id); setEditingSubjectName(s.name); }} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700" title="Edit"><Pencil size={12} /></button>
                        <button onClick={() => setDeleteSubjectTarget(s)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600" title="Delete"><Trash2 size={12} /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete modals */}
      <DeleteModal open={!!deleteCourseTarget} onClose={() => setDeleteCourseTarget(null)} onConfirm={handleDeleteCourse} label={`course "${deleteCourseTarget?.className}"`} deleting={deletingCourse} />
      <DeleteModal open={!!deleteSubjectTarget} onClose={() => setDeleteSubjectTarget(null)} onConfirm={handleDeleteSubject} label={`subject "${deleteSubjectTarget?.name}"`} deleting={deletingSubject} />
    </div>
  );
}
