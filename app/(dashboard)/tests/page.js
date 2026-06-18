"use client";

import { useEffect, useState, useMemo } from "react";
import { FileText, Plus, X, Calendar, ClipboardList, Save, CheckCircle, Bell, Send, Edit2, Trash2, Download, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { createPdf, addTable, addSectionTitle, downloadPdf } from "@/lib/exportPdf";

const defaultSubjects = [
  { name: "Physics", max_marks: 100 },
  { name: "Chemistry", max_marks: 100 },
  { name: "Maths", max_marks: 100 }
];

export default function TestsPage() {
  const [tests, setTests] = useState([]);
  const [sections, setSections] = useState([]);
  const [results, setResults] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", class_id: "", section_ids: [], date: "", subjects: defaultSubjects });
  const [editingId, setEditingId] = useState(null);
  const [selectedTest, setSelectedTest] = useState(null);
  const [markForm, setMarkForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState("");
  const [notifyingTestId, setNotifyingTestId] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Filters
  const [classes, setClasses] = useState([]);
  const [filterClass, setFilterClass] = useState("");
  const [filterSection, setFilterSection] = useState("");

  const PAGE_SIZE = 30;
  const [testPage, setTestPage] = useState(1);
  const [modalPage, setModalPage] = useState(1);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    try {
      const [t, b, m, c] = await Promise.all([
        fetch("/api/tests").then((r) => r.json()),
        fetch("/api/sections").then((r) => r.json()),
        fetch("/api/me").then((r) => r.json()),
        fetch("/api/classes").then((r) => r.json())
      ]);
      setTests(Array.isArray(t) ? t : []);
      setSections(Array.isArray(b) ? b : []);
      setClasses(Array.isArray(c) ? c : []);
      setRole(m?.role || "STUDENT");
    } catch (err) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  const filteredTests = tests.filter(t => {
     if (filterClass) {
        const sec = sections.find(s => s._id === (t.section_id?._id || t.section_id));
        if (!sec || (sec.class_id?._id || sec.class_id) !== filterClass) return false;
     }
     if (filterSection && filterSection !== (t.section_id?._id || t.section_id)) return false;
     return true;
  });

  const testPages = Math.max(1, Math.ceil(filteredTests.length / PAGE_SIZE));
  const paginatedTests = filteredTests.slice((testPage - 1) * PAGE_SIZE, testPage * PAGE_SIZE);

  // Pagination for modal students
  const studentPages = Math.max(1, Math.ceil(students.length / PAGE_SIZE));
  const paginatedStudents = students.slice((modalPage - 1) * PAGE_SIZE, modalPage * PAGE_SIZE);

  async function handleCreateOrUpdateTest(e) {
    e.preventDefault();
    if (!form.subjects || form.subjects.length === 0) {
      return toast.error("Please add at least one subject.");
    }
    if (!form.section_ids || form.section_ids.length === 0) {
      return toast.error("Please select at least one section.");
    }

    try {
      if (editingId) {
        const res = await fetch(`/api/tests/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, section_id: form.section_ids[0] }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } else {
        const promises = form.section_ids.map((s) =>
          fetch("/api/tests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...form, section_id: s }),
          }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); })
        );
        await Promise.all(promises);
      }

      toast.success(editingId ? "Test updated successfully" : "Tests created successfully");
      setShowForm(false);
      setEditingId(null);
      setForm({ name: "", class_id: "", section_ids: [], date: "", subjects: defaultSubjects });
      const updated = await fetch("/api/tests").then((r) => r.json());
      setTests(Array.isArray(updated) ? updated : []);
    } catch (err) {
      toast.error(err.message || "Failed to save test");
    }
  }

  function handleEditClick(test) {
    setEditingId(test._id);
    const secId = test.section_id?._id || test.section_id;
    const secObj = sections.find(s => s._id === secId);
    setForm({
      name: test.name,
      class_id: secObj ? (secObj.class_id?._id || secObj.class_id) : "",
      section_ids: secId ? [secId] : [],
      date: new Date(test.date).toISOString().split("T")[0],
      subjects: test.subjects && test.subjects.length > 0 ? test.subjects : defaultSubjects
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeleteTest(testId) {
    if (!confirm("Are you sure you want to delete this test? All student marks for this test will be permanently lost.")) return;

    const res = await fetch(`/api/tests/${testId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Test deleted successfully");
      setTests(tests.filter(t => t._id !== testId));
      if (selectedTest?._id === testId) closeModal();
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to delete test");
    }
  }

  async function openResults(test) {
    setSelectedTest(test);
    setModalLoading(true);
    const [r, s] = await Promise.all([
      fetch(`/api/results?test_id=${test._id}`).then((r) => r.json()),
      fetch(`/api/students?section_id=${test.section_id?._id || test.section_id}&limit=200`).then((r) => r.json()),
    ]);
    setResults(Array.isArray(r) ? r : []);
    setStudents(Array.isArray(s) ? s : (s?.students || []));
    setModalPage(1);

    const marks = {};
    if (Array.isArray(r)) {
      r.forEach((res) => {
        const subjectScores = {};
        if (res.subject_marks) {
          res.subject_marks.forEach(sm => {
            subjectScores[sm.subject] = sm.marks;
          });
        }
        marks[res.student_id?._id || res.student_id] = subjectScores;
      });
    }
    setMarkForm(marks);
    setModalLoading(false);
  }

  function closeModal() {
    setSelectedTest(null);
    setResults([]);
    setStudents([]);
    setMarkForm({});
  }

  async function saveMarks() {
    setSaving(true);
    try {
      // Validate marks don't exceed max before saving
      for (const [studentId, subjectScores] of Object.entries(markForm)) {
        for (const sub of (selectedTest.subjects || [])) {
          const val = Number(subjectScores?.[sub.name]);
          if (!isNaN(val) && val > sub.max_marks) {
            toast.error(`${sub.name}: ${val} exceeds max marks (${sub.max_marks})`);
            setSaving(false);
            return;
          }
        }
      }
      const saves = Object.entries(markForm)
        .filter(([, subjectScores]) => Object.keys(subjectScores || {}).length > 0)
        .map(([studentId, subjectScores]) => {
          const subject_marks = Object.entries(subjectScores).map(([subject, marks]) => ({
            subject,
            marks: Number(marks),
          }));
          return fetch("/api/results", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              test_id: selectedTest._id,
              student_id: studentId,
              subject_marks,
            }),
          });
        });

      await Promise.all(saves);
      toast.success("Marks saved successfully");
      openResults(selectedTest);
    } catch {
      toast.error("Failed to save marks");
    }
    setSaving(false);
  }

  async function notifyParents(testId) {
    setNotifyingTestId(testId);
    try {
      const res = await fetch("/api/tests/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test_id: testId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Notifications sent");
      } else {
        toast.error(data.error || "Failed to send notifications");
      }
    } catch (err) {
      toast.error("Network error while sending notifications");
    }
    setNotifyingTestId(null);
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-8 w-48 animate-shimmer rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-shimmer rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">{role === "STUDENT" ? "My Test Results" : "Tests and Results"}</h1>
          <p className="page-subtitle">
            {role === "STUDENT"
              ? "View all your test scores and performance records."
              : "Create exams, enter student marks, and view performance."}
          </p>
        </div>
        {role !== "STUDENT" && (
          <button
            onClick={() => {
              if (showForm) {
                setShowForm(false);
                setEditingId(null);
                setForm({ name: "", class_id: "", section_ids: [], date: "", subjects: defaultSubjects });
              } else {
                setShowForm(true);
              }
            }}
            className={`btn-primary ${showForm ? "bg-gray-500 hover:bg-gray-600 !shadow-none" : ""}`}
          >
            {showForm ? (
              <>
                <X size={16} /> Cancel
              </>
            ) : (
              <>
                <Plus size={16} /> Create Test
              </>
            )}
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleCreateOrUpdateTest}
          className="card bg-gray-50/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-2 mb-2">
             <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                {editingId ? <Edit2 size={16}/> : <Plus size={16}/>}
             </div>
             <h2 className="text-base font-bold text-gray-800">{editingId ? "Edit Test Details" : "Create New Exam"}</h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Test Name
            </label>
            <input
              placeholder="e.g. Midterm 1"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Class
            </label>
            <select
              value={form.class_id || ""}
              onChange={(e) => setForm({ ...form, class_id: e.target.value, section_ids: [] })}
              className="input-field"
            >
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Sections <span className="text-gray-400 font-normal lowercase">(Hold Ctrl/Cmd to select multiple)</span>
            </label>
            <select
              multiple
              required
              value={form.section_ids}
              onChange={(e) => {
                const opts = Array.from(e.target.selectedOptions, option => option.value);
                setForm({ ...form, section_ids: opts });
              }}
              className="input-field min-h-[80px]"
              disabled={!form.class_id}
            >
              {sections.filter(s => (s.class_id?._id || s.class_id) === form.class_id).map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Date
            </label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="input-field leading-normal"
            />
          </div>
          
          <div className="sm:col-span-2 lg:col-span-4 mt-2">
            <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Subjects & Max Marks
              </label>
              <button 
                type="button" 
                onClick={() => setForm({...form, subjects: [...form.subjects, {name: "", max_marks: 100}]})}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md"
              >
                <Plus size={12} /> Add Subject
              </button>
            </div>
            
            <div className="space-y-3">
              {form.subjects.map((sub, idx) => (
                <div key={idx} className="flex gap-3 items-center">
                  <div className="flex-1">
                    <input 
                      placeholder="Subject Name (e.g. Physics)" 
                      required 
                      value={sub.name} 
                      onChange={(e) => { 
                        const newSubs = [...form.subjects]; 
                        newSubs[idx].name = e.target.value; 
                        setForm({...form, subjects: newSubs}); 
                      }} 
                      className="input-field" 
                    />
                  </div>
                  <div className="w-32">
                    <input 
                      type="number" 
                      placeholder="Max Marks" 
                      required 
                      min={1}
                      value={sub.max_marks} 
                      onChange={(e) => { 
                        const newSubs = [...form.subjects]; 
                        newSubs[idx].max_marks = Number(e.target.value); 
                        setForm({...form, subjects: newSubs}); 
                      }} 
                      className="input-field" 
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={() => { 
                      const newSubs = form.subjects.filter((_, i) => i !== idx); 
                      setForm({...form, subjects: newSubs}); 
                    }} 
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-md transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {form.subjects.length === 0 && (
                <div className="text-center py-4 bg-gray-100/50 rounded-lg text-xs text-gray-400 font-medium italic border border-dashed border-gray-200">
                  No subjects added. Add at least one to save.
                </div>
              )}
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex justify-end mt-4 pt-4 border-t border-gray-100">
            <button type="submit" className="btn-primary">
              <CheckCircle size={15} /> {editingId ? "Update Test" : "Save Test"}
            </button>
          </div>
        </form>
      )}

      {/* Tests Grid */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-end mb-4 gap-4 border-b border-gray-200 pb-4">
          <h2 className="section-heading !mb-0">Recent Tests</h2>
          {role === "ADMIN" && (
             <div className="flex gap-3">
               <div className="min-w-[130px]">
                 <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Filter by Class</label>
                 <select value={filterClass} onChange={e => {setFilterClass(e.target.value); setFilterSection(""); setTestPage(1);}} className="input-field text-xs py-1.5 h-auto">
                    <option value="">All Classes</option>
                    {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                 </select>
               </div>
               <div className="min-w-[130px]">
                 <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Filter by Section</label>
                 <select value={filterSection} onChange={e => {setFilterSection(e.target.value); setTestPage(1);}} className="input-field text-xs py-1.5 h-auto" disabled={!filterClass}>
                    <option value="">All Sections</option>
                    {sections.filter(s => !filterClass || (s.class_id?._id || s.class_id) === filterClass).map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                 </select>
               </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {paginatedTests.map((t) => {
            const totalMaxMarks = t.subjects?.reduce((sum, s) => sum + (s.max_marks || 0), 0) || 0;
            return (
              <div
                key={t._id}
                onClick={() => openResults(t)}
                className="card cursor-pointer transition-all hover:shadow-md hover:ring-2 hover:ring-slate-200 group relative"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="p-2 rounded-md bg-slate-100 text-slate-600 transition-colors">
                    <FileText size={18} strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-800 text-base leading-tight truncate">{t.name}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                      {t.section_id?.class_id?.name ? `${t.section_id.class_id.name} · ${t.section_id.name}` : (t.section_id?.name || "—")}
                    </div>
                  </div>
                </div>

                {/* Edit/Delete Floating Actions */}
                {role !== "STUDENT" && (
                   <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleEditClick(t); }}
                        className="p-1.5 bg-white border border-gray-200 rounded-md text-gray-500 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-colors"
                        title="Edit Test"
                      >
                        <Edit2 size={13}/>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteTest(t._id); }}
                        className="p-1.5 bg-white border border-gray-200 rounded-md text-gray-500 hover:text-red-600 hover:border-red-200 shadow-sm transition-colors"
                        title="Delete Test"
                      >
                        <Trash2 size={13}/>
                      </button>
                   </div>
                )}

                <div className="flex flex-col gap-2 pt-3 border-t border-gray-100 border-dashed">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span className="flex items-center text-gray-500 text-xs">
                       <Calendar size={13} className="mr-1.5" />
                       {new Date(t.date).toLocaleDateString()}
                    </span>
                    <span className="flex items-center text-gray-500 text-xs font-bold">
                       <ClipboardList size={13} className="mr-1.5" />
                       {totalMaxMarks} Marks
                    </span>
                  </div>
                  <div className="text-[10px] items-center flex gap-1.5 text-gray-400 font-bold uppercase tracking-wider truncate">
                    {t.subjects?.map((s, i) => (
                       <span key={i} className="flex items-center gap-1">
                          {s.name} <span className="text-[8px] opacity-60">({s.max_marks})</span>
                          {i < t.subjects.length - 1 && <span className="opacity-30">|</span>}
                       </span>
                    ))}
                  </div>
                </div>
                {(role === "ADMIN" || role === "TEACHER") && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      notifyParents(t._id);
                    }}
                    disabled={!!notifyingTestId}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-[11px] font-bold uppercase tracking-wider rounded-md transition-colors disabled:opacity-50"
                  >
                    <Bell size={13} />
                    {notifyingTestId === t._id ? "Sending..." : "Notify Parents"}
                  </button>
                )}
              </div>
            );
          })}
          {filteredTests.length === 0 && (
            <div className="col-span-full py-16 text-center border-2 border-dashed border-gray-200 rounded-lg">
              <FileText size={32} className="mx-auto text-gray-300 mb-3" />
              <h3 className="text-base font-bold text-gray-700">No tests found</h3>
              <p className="text-sm text-gray-500 mt-1">Create your first test or adjust the filters above.</p>
            </div>
          )}
        </div>
        {testPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <span className="text-sm text-gray-500 font-medium">
              Page {testPage} of {testPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTestPage(p => Math.max(1, p - 1))}
                disabled={testPage === 1}
                className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setTestPage(p => Math.min(testPages, p + 1))}
                disabled={testPage === testPages}
                className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Marks Modal Popup ─── */}
      {selectedTest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            style={{ animation: "slideDown 250ms cubic-bezier(0.16,1,0.3,1)" }}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/60">
              <div>
                <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <ClipboardList size={16} className="text-slate-600" />
                  {selectedTest.name}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {selectedTest.section_id?.class_id?.name ? `${selectedTest.section_id.class_id.name} · ${selectedTest.section_id.name}` : (selectedTest.section_id?.name || "—")} &nbsp;·&nbsp; Total Max: {selectedTest.subjects?.reduce((sum, s) => sum + (s.max_marks || 0), 0) || 0} marks
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors ml-4 flex-shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-x-auto overflow-y-auto flex-1 h-full min-h-[300px]">
              {modalLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
                </div>
              ) : role === "STUDENT" ? (
                <div className="px-6 py-5">
                  {paginatedStudents.map((s) => {
                    const totalScored = selectedTest.subjects?.reduce((sum, sub) => sum + Number(markForm[s._id]?.[sub.name] || 0), 0) || 0;
                    const overallMax = selectedTest.subjects?.reduce((sum, sub) => sum + (sub.max_marks || 0), 0) || 0;
                    const pct = overallMax > 0 ? ((totalScored / overallMax) * 100).toFixed(1) : 0;
                    
                    return (
                       <div key={s._id}>
                         {/* Scorecard Table */}
                         <table className="w-full border-collapse">
                           <thead>
                             <tr className="border-b-2 border-slate-200">
                               <th className="text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3 px-4">Subject</th>
                               <th className="text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3 px-4 w-28">Max Marks</th>
                               <th className="text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3 px-4 w-28">Obtained</th>
                             </tr>
                           </thead>
                           <tbody>
                             {selectedTest.subjects?.map((sub, idx) => {
                               const obtained = markForm[s._id]?.[sub.name];
                               const hasMarks = obtained !== undefined && obtained !== "";
                               return (
                                 <tr key={idx} className={`border-b border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"} hover:bg-slate-50 transition-colors`}>
                                   <td className="py-3.5 px-4 text-sm font-semibold text-slate-800">{sub.name}</td>
                                   <td className="py-3.5 px-4 text-sm text-right text-slate-400 font-mono tabular-nums">{sub.max_marks}</td>
                                   <td className="py-3.5 px-4 text-right">
                                     <span className={`text-sm font-bold font-mono tabular-nums ${hasMarks ? "text-slate-900" : "text-slate-300"}`}>
                                       {hasMarks ? obtained : "—"}
                                     </span>
                                   </td>
                                 </tr>
                               );
                             })}
                           </tbody>
                           <tfoot>
                             <tr className="border-t-2 border-slate-300 bg-gray-900">
                               <td className="py-3.5 px-4 text-sm font-bold text-white uppercase tracking-wide">Total</td>
                               <td className="py-3.5 px-4 text-sm text-right text-slate-400 font-mono font-bold tabular-nums">{overallMax}</td>
                               <td className="py-3.5 px-4 text-right">
                                 <span className="text-lg font-black text-white font-mono tabular-nums">{totalScored}</span>
                               </td>
                             </tr>
                           </tfoot>
                         </table>

                         {/* Percentage Strip */}
                         <div className="mt-4 flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                           <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Score Percentage</span>
                           <span className={`text-lg font-black font-mono tabular-nums ${Number(pct) >= 60 ? "text-emerald-600" : Number(pct) >= 33 ? "text-amber-600" : "text-red-600"}`}>
                             {pct}%
                           </span>
                         </div>

                         {/* Report Issue */}
                         <div className="mt-5 pt-4 flex justify-end border-t border-slate-100">
                            <a href="https://wa.me/919509728788?text=I%20want%20to%20report%20an%20issue%20with%20my%20test%20marks" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-md bg-white text-slate-500 text-[11px] uppercase tracking-wider font-bold hover:bg-slate-50 hover:border-slate-300 hover:text-slate-700 transition-all">
                              Report Issue
                            </a>
                         </div>
                       </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  <table className="data-table min-w-full whitespace-nowrap">
                    <thead>
                    <tr>
                      <th className="sticky left-0 bg-gray-50 border-r border-gray-200">Student Name</th>
                      {selectedTest.subjects?.map((sub, idx) => (
                        <th key={idx} className="text-center">{sub.name} <br/><span className="text-[10px] text-gray-400 font-normal">Max: {sub.max_marks}</span></th>
                      ))}
                      <th className="text-center bg-gray-50 bg-opacity-50 border-l border-gray-200">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStudents.map((s) => {
                      const totalScored = selectedTest.subjects?.reduce((sum, sub) => sum + Number(markForm[s._id]?.[sub.name] || 0), 0) || 0;
                      const overallMax = selectedTest.subjects?.reduce((sum, sub) => sum + (sub.max_marks || 0), 0) || 0;

                      return (
                        <tr key={s._id}>
                          <td className="font-semibold text-gray-700 sticky left-0 bg-white border-r border-gray-50 shadow-[1px_0_0_0_#f3f4f6]">
                            {s.user_id?.name || s.parent_name}
                          </td>
                          {selectedTest.subjects?.map((sub, idx) => (
                             <td key={idx} className="text-center bg-white">
                              <div className="flex items-center justify-center">
                                <input
                                  type="number"
                                  min={0}
                                  value={markForm[s._id]?.[sub.name] ?? ""}
                                  onChange={(e) =>
                                    setMarkForm({ 
                                      ...markForm, 
                                      [s._id]: { ...(markForm[s._id] || {}), [sub.name]: e.target.value } 
                                    })
                                  }
                                  className="w-16 px-2 py-1 text-center border border-gray-300 rounded-md text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-all font-mono shadow-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                  placeholder="—"
                                />
                              </div>
                            </td>
                          ))}
                          <td className="text-center bg-gray-50/30 border-l border-gray-100 font-mono text-sm">
                            <span className="font-bold text-gray-800">{totalScored}</span>
                            <span className="text-gray-400 text-xs ml-1">/ {overallMax}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={(selectedTest.subjects?.length || 0) + 2} className="py-10 text-center text-gray-500 font-medium bg-gray-50/50">
                          No students enrolled in this section.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
              )}
              {studentPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 p-4 bg-white mt-auto sticky bottom-0">
                  <span className="text-xs text-gray-500 font-medium">
                    Showing {(modalPage - 1) * PAGE_SIZE + 1} to {Math.min(modalPage * PAGE_SIZE, students.length)} of {students.length} students
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setModalPage(p => Math.max(1, p - 1))}
                      disabled={modalPage === 1}
                      className="p-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      onClick={() => setModalPage(p => Math.min(studentPages, p + 1))}
                      disabled={modalPage === studentPages}
                      className="p-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {!modalLoading && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  {(role === "ADMIN" || role === "TEACHER") && (
                    <button
                      onClick={() => notifyParents(selectedTest._id)}
                      disabled={!!notifyingTestId || students.length === 0}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-sm font-medium rounded-md transition-colors disabled:opacity-50"
                    >
                      <Send size={14} />
                      {notifyingTestId === selectedTest._id ? "Sending..." : "Notify All Parents"}
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (students.length === 0) return;
                      const sectionLabel = selectedTest.section_id?.class_id?.name
                        ? `${selectedTest.section_id.class_id.name} · ${selectedTest.section_id.name}`
                        : (selectedTest.section_id?.name || "Section");
                      const { doc, startY, addFooter } = await createPdf({
                        title: selectedTest.name,
                        subtitle: `${sectionLabel} · ${new Date(selectedTest.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`,
                        landscape: (selectedTest.subjects?.length || 0) > 3,
                      });
                      const subjectNames = selectedTest.subjects?.map(s => s.name) || [];
                      addTable(doc, {
                        startY,
                        head: ["#", "Student Name", ...subjectNames.map(n => `${n}`), "Total", "%"],
                        body: students.map((s, i) => {
                          const overallMax = selectedTest.subjects?.reduce((sum, sub) => sum + (sub.max_marks || 0), 0) || 0;
                          const totalScored = selectedTest.subjects?.reduce((sum, sub) => sum + Number(markForm[s._id]?.[sub.name] || 0), 0) || 0;
                          const pct = overallMax > 0 ? ((totalScored / overallMax) * 100).toFixed(1) : "0";
                          return [
                            String(i + 1),
                            s.user_id?.name || s.parent_name,
                            ...subjectNames.map(n => String(markForm[s._id]?.[n] ?? "—")),
                            `${totalScored}/${overallMax}`,
                            `${pct}%`,
                          ];
                        }),
                      });
                      downloadPdf(doc, `${selectedTest.name.replace(/\s+/g, "_")}_Marks.pdf`, addFooter);
                    }}
                    className="btn-secondary text-sm"
                  >
                    <Download size={14} /> PDF
                  </button>
                </div>
                {role !== "STUDENT" && (
                  <button
                    onClick={saveMarks}
                    disabled={saving || students.length === 0}
                    className="btn-primary w-full sm:w-auto"
                  >
                    {saving ? "Saving..." : <><Save size={15} /> Save Marks</>}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
