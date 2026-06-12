"use client";

import { useEffect, useState } from "react";
import { Layers, Plus, X, Pencil, Trash2, Check, GraduationCap, Users, BookOpen } from "lucide-react";
import toast from "react-hot-toast";

export default function ClassesAndSectionsPage() {
  const [sections, setSections] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");

  const [showClassForm, setShowClassForm] = useState(false);
  const [showSectionFormId, setShowSectionFormId] = useState(null);
  const [classForm, setClassForm] = useState({ name: "" });
  const [sectionForm, setSectionForm] = useState({ name: "" });

  const [creatingClass, setCreatingClass] = useState(false);
  const [creatingSection, setCreatingSection] = useState(false);

  const [editSectionId, setEditSectionId] = useState(null);
  const [editSectionForm, setEditSectionForm] = useState({ name: "" });
  const [deletingSectionId, setDeletingSectionId] = useState(null);
  const [deletingClassId, setDeletingClassId] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/sections").then((r) => r.json()),
      fetch("/api/classes").then((r) => r.json()),
      fetch("/api/students").then((r) => r.json()),
      fetch("/api/me").then((r) => r.json()),
    ])
      .then(([b, cl, st, m]) => {
        setSections(Array.isArray(b) ? b : []);
        setClasses(Array.isArray(cl) ? cl : []);
        setStudents(Array.isArray(st) ? st : []);
        setRole(m?.role || "STUDENT");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleCreateClass(e) {
    e.preventDefault();
    setCreatingClass(true);
    let finalName = classForm.name.trim();
    if (/^\d+$/.test(finalName)) {
      finalName = `Class ${finalName}`;
    }

    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: finalName }),
      });
      if (res.ok) {
        setShowClassForm(false);
        setClassForm({ name: "" });
        const newClass = await res.json();
        setClasses([...classes, newClass]);
        toast.success("Class created");
      } else {
        toast.error((await res.json()).error || "Failed to create class");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setCreatingClass(false);
    }
  }

  async function handleCreateSection(e, classId) {
    e.preventDefault();
    setCreatingSection(true);
    try {
      const res = await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: sectionForm.name, class_id: classId }),
      });
      if (res.ok) {
        setShowSectionFormId(null);
        setSectionForm({ name: "" });
        const updated = await fetch("/api/sections").then((r) => r.json());
        setSections(Array.isArray(updated) ? updated : []);
        toast.success("Section created");
      } else {
        toast.error((await res.json()).error || "Failed to create section");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setCreatingSection(false);
    }
  }

  async function handleEditSectionSave(e, sectionId) {
    e.preventDefault();
    try {
      const res = await fetch(`/api/sections/${sectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editSectionForm.name }),
      });
      if (res.ok) {
        const updated = await fetch("/api/sections").then((r) => r.json());
        setSections(Array.isArray(updated) ? updated : []);
        setEditSectionId(null);
        toast.success("Section updated");
      } else {
        toast.error((await res.json()).error || "Update failed");
      }
    } catch {
      toast.error("Network error");
    }
  }

  async function handleDeleteSection(id) {
    if (!confirm("Delete this section? This cannot be undone.")) return;
    setDeletingSectionId(id);
    try {
      const res = await fetch(`/api/sections/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSections((prev) => prev.filter((b) => b._id !== id));
        toast.success("Section deleted");
      } else {
        toast.error((await res.json()).error || "Delete failed");
      }
    } catch {
      toast.error("Network error");
    }
    setDeletingSectionId(null);
  }

  async function handleDeleteClass(id) {
    if (!confirm("Delete this Class and all its sections? This cannot be undone.")) return;
    setDeletingClassId(id);
    try {
      const res = await fetch(`/api/classes/${id}`, { method: "DELETE" });
      if (res.ok) {
        setClasses((prev) => prev.filter((c) => c._id !== id));
        setSections((prev) => prev.filter((s) => (s.class_id?._id || s.class_id) !== id));
        toast.success("Class deleted");
      } else {
        toast.error((await res.json()).error || "Delete failed");
      }
    } catch {
      toast.error("Network error");
    }
    setDeletingClassId(null);
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-8 w-48 animate-shimmer rounded-lg" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-44 animate-shimmer rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const sortedClasses = [...classes].sort((a, b) => {
    const numA = parseInt(a.name.replace(/\D/g, ""), 10);
    const numB = parseInt(b.name.replace(/\D/g, ""), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.name.localeCompare(b.name);
  });

  const totalSections = sections.length;
  const totalStudents = students.length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">{role === "TEACHER" ? "My Sections" : "Classes & Sections"}</h1>
          <p className="page-subtitle">
            {role === "TEACHER"
              ? "View and manage your assigned class schedules and students."
              : `${sortedClasses.length} classes · ${totalSections} sections · ${totalStudents} students enrolled`}
          </p>
        </div>
        {role === "ADMIN" && (
          <button
            onClick={() => setShowClassForm(!showClassForm)}
            className={`btn-primary flex-shrink-0 ${showClassForm ? "!bg-slate-500 hover:!bg-slate-600" : ""}`}
          >
            {showClassForm ? <><X size={15} /> Cancel</> : <><Plus size={15} /> Add Class</>}
          </button>
        )}
      </div>

      {/* Add Class Form */}
      {showClassForm && role === "ADMIN" && (
        <form onSubmit={handleCreateClass} className="card bg-slate-50 border-dashed border-2 border-slate-300 flex items-end gap-4 !p-5">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">New Class Name</label>
            <input
              placeholder="e.g. Class 11"
              required
              value={classForm.name}
              onChange={(e) => setClassForm({ name: e.target.value })}
              className="input-field"
              disabled={creatingClass}
              autoFocus
            />
          </div>
          <button type="submit" className="btn-primary mb-0.5 h-[42px]" disabled={creatingClass}>
            {creatingClass ? "Creating…" : "Create Class"}
          </button>
        </form>
      )}

      {/* Stats Row */}
      {sortedClasses.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Classes", value: sortedClasses.length, Icon: BookOpen },
            { label: "Total Sections", value: totalSections, Icon: Layers },
            { label: "Total Students", value: totalStudents, Icon: Users },
          ].map((s, i) => (
            <div key={i} className="stat-card border border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-gray-500">{s.label}</div>
                  <div className="text-2xl font-bold tracking-tight text-gray-900">{s.value}</div>
                </div>
                <div className="p-2 bg-slate-100 rounded-md">
                  <s.Icon size={18} className="text-slate-600" strokeWidth={1.8} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Class Cards Grid — 3 per row, compact */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedClasses.map((cl) => {
          const classSections = sections
            .filter((s) => (s.class_id?._id || s.class_id) === cl._id)
            .sort((a, b) => a.name.localeCompare(b.name));
          const classStudentCount = students.filter((s) => {
            const secId = s.section_id?._id || s.section_id;
            return classSections.some((sec) => sec._id === secId);
          }).length;
          const classNum = cl.name.replace(/\D/g, "");

          return (
            <div key={cl._id} className="card !p-0 overflow-hidden border border-gray-200 shadow-sm">
              {/* Card Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-800 text-white rounded-md flex items-center justify-center text-xs font-black flex-shrink-0">
                    {classNum || cl.name.slice(0, 2)}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 leading-none">{cl.name}</h2>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-none">
                      {classSections.length} section{classSections.length !== 1 ? "s" : ""} · {classStudentCount} students
                    </p>
                  </div>
                </div>
                {role === "ADMIN" && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        if (showSectionFormId === cl._id) {
                          setShowSectionFormId(null);
                        } else {
                          setShowSectionFormId(cl._id);
                          setSectionForm({ name: "" });
                        }
                      }}
                      className={`text-xs font-semibold flex items-center gap-1 px-2.5 py-1.5 rounded-md border transition-all ${
                        showSectionFormId === cl._id
                          ? "bg-slate-100 text-slate-500 border-slate-200"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      {showSectionFormId === cl._id ? <><X size={11} /> Cancel</> : <><Plus size={11} /> Section</>}
                    </button>
                    <button
                      onClick={() => handleDeleteClass(cl._id)}
                      disabled={deletingClassId === cl._id}
                      className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all disabled:opacity-40"
                      title="Delete Class"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="p-3">
                {/* Inline add-section form */}
                {showSectionFormId === cl._id && role === "ADMIN" && (
                  <form onSubmit={(e) => handleCreateSection(e, cl._id)} className="flex gap-2 mb-3">
                    <input
                      placeholder="Section name, e.g. A"
                      value={sectionForm.name}
                      onChange={(e) => setSectionForm({ name: e.target.value })}
                      className="input-field flex-1 !py-1.5 text-sm"
                      required
                      disabled={creatingSection}
                      autoFocus
                    />
                    <button type="submit" className="btn-primary !py-1.5 !px-3 text-xs" disabled={creatingSection}>
                      {creatingSection ? "…" : "Add"}
                    </button>
                  </form>
                )}

                {/* Section chips — 3 per row */}
                <div className="grid grid-cols-3 gap-2">
                  {classSections.map((sec) => {
                    const secCount = students.filter(
                      (s) => (s.section_id?._id || s.section_id) === sec._id
                    ).length;

                    return (
                      <div
                        key={sec._id}
                        className="relative group border border-gray-200 rounded-lg bg-white hover:border-slate-300 hover:shadow-sm transition-all flex flex-col items-center justify-center py-3 min-h-[70px]"
                      >
                        {editSectionId === sec._id ? (
                          <form onSubmit={(e) => handleEditSectionSave(e, sec._id)} className="flex flex-col gap-1.5 w-full px-2">
                            <input
                              className="input-field !py-1 !px-2 text-xs text-center"
                              value={editSectionForm.name}
                              onChange={(e) => setEditSectionForm({ name: e.target.value })}
                              autoFocus
                              required
                            />
                            <div className="flex justify-center gap-1">
                              <button type="button" onClick={() => setEditSectionId(null)} className="p-1 rounded bg-white border border-slate-200 text-slate-400 hover:text-slate-600">
                                <X size={11} />
                              </button>
                              <button type="submit" className="p-1 rounded bg-slate-800 text-white">
                                <Check size={11} />
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <span className="text-lg font-black text-slate-800 leading-none">{sec.name}</span>
                            <span className="text-[10px] text-gray-400 font-medium mt-0.5 leading-none">{secCount} students</span>

                            {role === "ADMIN" && (
                              <div className="absolute inset-0 rounded-lg flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all bg-slate-800/5 backdrop-blur-[1px]">
                                <button
                                  onClick={() => { setEditSectionId(sec._id); setEditSectionForm({ name: sec.name }); }}
                                  className="p-1.5 rounded-md bg-white shadow border border-gray-200 text-gray-400 hover:text-blue-600 transition-colors"
                                >
                                  <Pencil size={11} />
                                </button>
                                <button
                                  onClick={() => handleDeleteSection(sec._id)}
                                  disabled={deletingSectionId === sec._id}
                                  className="p-1.5 rounded-md bg-white shadow border border-gray-200 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}

                  {classSections.length === 0 && showSectionFormId !== cl._id && (
                    <div className="col-span-3 py-5 flex flex-col items-center gap-1.5 text-gray-300 border border-dashed border-gray-200 rounded-lg">
                      <Layers size={18} />
                      <span className="text-xs font-medium text-gray-400">No sections yet</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {classes.length === 0 && (
          <div className="col-span-3 py-20 text-center border-2 border-dashed border-gray-200 rounded-lg bg-white">
            <div className="w-12 h-12 bg-gray-100 text-gray-300 rounded-lg flex items-center justify-center mx-auto mb-3">
              <GraduationCap size={24} />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">No classes yet</h3>
            <p className="text-sm text-gray-500 mt-1 mb-5">Create your first class like "Class 8" to get started.</p>
            {role === "ADMIN" && (
              <button onClick={() => setShowClassForm(true)} className="btn-primary inline-flex">
                <Plus size={15} /> Add First Class
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
