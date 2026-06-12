"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, X, AlertTriangle, GraduationCap, ChevronRight,
  BookOpen, Clock, ShieldAlert, Loader2, Download, Settings as SettingsIcon, Trash2
} from "lucide-react";
import toast from "react-hot-toast";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function TimetablePage() {
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [timetableLoading, setTimetableLoading] = useState(false);

  // Master data
  const [classes, setClasses] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  
  // Timetable settings
  const [periods, setPeriods] = useState([]);
  const [configModal, setConfigModal] = useState(false);
  const [editablePeriods, setEditablePeriods] = useState([]);

  // Selection
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");

  // Timetable entries for the selected section
  const [timetable, setTimetable] = useState([]);

  // Modal for adding a slot
  const [modal, setModal] = useState(null); // { day, period_no }
  const [slotSubject, setSlotSubject] = useState("");
  const [slotTeacher, setSlotTeacher] = useState("");
  const [saving, setSaving] = useState(false);

  // Teacher report issue
  const [reportModal, setReportModal] = useState(false);
  const [issueMsg, setIssueMsg] = useState("");

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const meRes = await fetch("/api/me");
        const me = await meRes.json();
        setRole(me?.role || "STUDENT");

        const promises = [
          fetch("/api/classes").then(r => r.ok ? r.json() : []),
          fetch("/api/sections").then(r => r.ok ? r.json() : []),
          fetch("/api/subjects").then(r => r.ok ? r.json() : []),
          me?.role === "ADMIN" ? fetch("/api/teachers").then(r => r.ok ? r.json() : []) : Promise.resolve([]),
          fetch("/api/timetable/config").then(r => r.ok ? r.json() : [])
        ];

        const [clsData, secData, subData, tData, configData] = await Promise.all(promises);



        setClasses(Array.isArray(clsData) ? clsData : []);
        setAllSections(Array.isArray(secData) ? secData : []);
        setSubjects(Array.isArray(subData) ? subData : []);
        setTeachers(Array.isArray(tData) ? tData : []);
        
        const periodData = Array.isArray(configData) ? configData : [];
        setPeriods(periodData);

        // For students/teachers: auto-select their section
        if (me?.role === "STUDENT" || me?.role === "TEACHER") {
          const secs = Array.isArray(secData) ? secData : [];
          if (secs.length > 0) {
            const sec = secs[0];
            setSelectedSection(sec._id);
            const classId = sec.class_id?._id || sec.class_id;
            if (classId) setSelectedClass(classId);
          }
        }
      } catch (e) {
        toast.error("Failed to load data");
      }
      setLoading(false);
    }
    init();
  }, []);

  // ── Fetch timetable when section changes ───────────────────────────────────
  const fetchTimetable = useCallback(async (secId, currentRole) => {
    if (!secId && currentRole !== "TEACHER") { setTimetable([]); return; }
    setTimetableLoading(true);
    try {
      const url = currentRole === "TEACHER" ? `/api/timetable` : `/api/timetable?section_id=${secId}`;
      const res = await fetch(url);
      const data = await res.json();
      setTimetable(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load timetable");
    }
    setTimetableLoading(false);
  }, []);

  useEffect(() => {
    if (role === "TEACHER") fetchTimetable(null, role);
    else if (selectedSection) fetchTimetable(selectedSection, role);
    else setTimetable([]);
  }, [selectedSection, role, fetchTimetable]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const filteredSections = allSections.filter((s) => {
    const cid = s.class_id?._id || s.class_id;
    return !selectedClass || cid === selectedClass || cid?.toString() === selectedClass;
  });

  // Teachers free at a given day+period (no conflict)
  function freeTeachers(day, period_no) {
    const busyTeacherIds = timetable
      .filter((e) => e.day === day && e.period_no === period_no)
      .map((e) => (e.teacher_id?._id || e.teacher_id)?.toString());

    // Also check globally-loaded entries aren't used elsewhere (server does the real check)
    return teachers.filter((t) => !busyTeacherIds.includes(t._id?.toString()));
  }

  function getEntry(day, period_no) {
    return timetable.find((e) => e.day === day && e.period_no === period_no);
  }

  // ── Add slot ───────────────────────────────────────────────────────────────
  async function handleAddSlot() {
    if (!slotSubject || !slotTeacher) return toast.error("Select subject and teacher.");
    setSaving(true);
    try {
      const res = await fetch("/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section_id: selectedSection,
          subject_id: slotSubject,
          teacher_id: slotTeacher,
          day: modal.day,
          period_no: modal.period_no,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Slot added!");
        setModal(null);
        setSlotSubject(""); setSlotTeacher("");
        fetchTimetable(selectedSection);
      } else {
        toast.error(data.error || "Conflict detected");
      }
    } catch {
      toast.error("Network error");
    }
    setSaving(false);
  }

  // ── Delete slot ────────────────────────────────────────────────────────────
  async function handleDeleteSlot(id) {
    if (!confirm("Remove this slot?")) return;
    const res = await fetch(`/api/timetable?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Slot removed");
      fetchTimetable(selectedSection);
    }
  }

  // ── Report issue (teacher) ─────────────────────────────────────────────────
  async function reportIssue() {
    if (!issueMsg.trim()) return toast.error("Describe the issue first.");
    const res = await fetch("/api/notifications/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: `Timetable Issue: ${issueMsg}`, type: "TIMETABLE_ISSUE" }),
    });
    if (res.ok) {
      toast.success("Issue reported to admin!");
      setReportModal(false); setIssueMsg("");
    } else {
      toast.error("Failed to report");
    }
  }

  // ── Configuration (Admin) ──────────────────────────────────────────────────
  async function saveConfig() {
    setSaving(true);
    try {
      const res = await fetch("/api/timetable/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editablePeriods),
      });
      if (res.ok) {
        toast.success("Timetable Structure Updated!");
        setPeriods(await res.json());
        setConfigModal(false);
      } else {
        toast.error("Failed to update structure.");
      }
    } catch {
      toast.error("Network error");
    }
    setSaving(false);
  }

  function addPeriod() {
    const nextNo = Math.max(0, ...editablePeriods.map(p => p.no || 0)) + 1;
    setEditablePeriods([...editablePeriods, { no: nextNo, label: "00:00-00:00", isBreak: false }]);
  }

  function addBreak() {
    setEditablePeriods([...editablePeriods, { no: null, label: "00:00-00:00", isBreak: true, breakTitle: "Lunch Break" }]);
  }

  function updateEditable(idx, patch) {
    const arr = [...editablePeriods];
    arr[idx] = { ...arr[idx], ...patch };
    setEditablePeriods(arr);
  }

  function removeEditable(idx) {
    setEditablePeriods(editablePeriods.filter((_, i) => i !== idx));
  }

  // ── Print ──────────────────────────────────────────────────────────────────
  function handleDownload() {
    window.print();
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-slate-400" size={32} />
    </div>
  );

  const availableTeachersForSlot = modal ? freeTeachers(modal.day, modal.period_no) : [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="page-title">Timetable</h1>
          <p className="page-subtitle">
            {role === "ADMIN" ? "Select a class and section to view or build the timetable." : "Your class timetable."}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {(selectedSection || role === "TEACHER") && (
             <button onClick={handleDownload}
               className="btn-secondary !bg-indigo-50 !text-indigo-700 !border-indigo-200 hover:!bg-indigo-100 flex items-center gap-2">
               <Download size={14} /> Download PDF
             </button>
          )}

          {role === "TEACHER" && (
            <button onClick={() => setReportModal(true)}
              className="btn-secondary !text-amber-700 !bg-amber-50 !border-amber-200 hover:!bg-amber-100 flex items-center gap-2">
              <AlertTriangle size={14} /> Report Issue
            </button>
          )}

          {role === "ADMIN" && (
             <button onClick={() => { setEditablePeriods([...periods]); setConfigModal(true); }}
                className="btn-secondary flex items-center gap-2">
                <SettingsIcon size={14} /> Configure Timetable
             </button>
          )}
        </div>
      </div>

      {/* Step 1 & 2: Class → Section selector (admin only) */}
      {role === "ADMIN" && (
        <div className="card bg-slate-800/5 border-slate-200 print:hidden">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Step 1 · Select Class
              </label>
              <select
                value={selectedClass}
                onChange={(e) => { setSelectedClass(e.target.value); setSelectedSection(""); }}
                className="input-field font-medium"
              >
                <option value="">— Choose a Class —</option>
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center self-end mb-2 text-slate-300">
              <ChevronRight size={18} />
            </div>

            <div className="flex-1 min-w-[180px]">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Step 2 · Select Section
              </label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="input-field font-medium"
                disabled={!selectedClass}
              >
                <option value="">— Choose a Section —</option>
                {filteredSections.map((s) => (
                  <option key={s._id} value={s._id}>Section {s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedClass && filteredSections.length === 0 && (
            <p className="mt-3 text-xs text-red-500 font-medium">
              No sections found for this class. Create sections first.
            </p>
          )}
        </div>
      )}

      {/* Print Only Header */}
      <div className="hidden print:block mb-4 text-center">
         <h1 className="text-2xl font-bold bg-white text-black mb-1">Class Timetable</h1>
         <p className="text-sm font-semibold text-gray-600">
           {role === "TEACHER" ? "My Timetable" : `${classes.find(c => c._id === selectedClass || c._id?.toString() === selectedClass)?.name} · Section ${allSections.find(s => s._id === selectedSection || s._id?.toString() === selectedSection)?.name}`}
         </p>
      </div>

      {/* Timetable Grid */}
      {selectedSection || role === "TEACHER" ? (
        timetableLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="animate-spin text-slate-400" size={24} />
          </div>
        ) : (
          <div className="card !p-0 overflow-x-auto shadow-md relative z-0">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 bg-slate-800 print:hidden shrink-0">
              <BookOpen size={14} className="text-slate-300" />
              <span className="text-xs font-bold uppercase tracking-widest text-slate-300 whitespace-nowrap">
                {role === "TEACHER" ? "My Timetable Overview" : `${classes.find(c => c._id === selectedClass || c._id?.toString() === selectedClass)?.name} · Section ${allSections.find(s => s._id === selectedSection || s._id?.toString() === selectedSection)?.name}`}
              </span>
            </div>

            <table className="w-full text-sm border-collapse min-w-[800px] table-fixed">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200">
                  <th className="py-3 px-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest border-r border-gray-200 w-28 sticky left-0 bg-slate-50 z-20">
                    Day
                  </th>
                  {periods.map((p, i) => (
                    <th key={i} className="py-3 px-2 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest border-r border-gray-200" style={{ width: p.isBreak ? '60px' : 'auto' }}>
                      {p.isBreak ? (
                         <div className="text-amber-600 flex flex-col items-center">
                           <span>Break</span>
                           <div className="text-[9px] font-normal mt-0.5">{p.label}</div>
                         </div>
                      ) : (
                         <div>
                            <div>Period {p.no}</div>
                            <div className="text-[9px] font-normal text-slate-400 flex items-center justify-center gap-0.5 mt-0.5">
                              <Clock size={8} /> {p.label}
                            </div>
                         </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day, di) => (
                  <tr key={day} className={`border-b border-gray-100 ${di % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                    <td className="py-2 px-4 font-bold text-slate-700 text-xs border-r border-gray-100 sticky left-0 z-10 bg-inherit shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      {day}
                    </td>
                    {periods.map((p, i) => {
                      if (p.isBreak) {
                        if (di === 0) {
                           return (
                             <td key={i} rowSpan={DAYS.length} className="bg-amber-50 border-r border-gray-100 text-center align-middle pointer-events-none print:!bg-gray-100 p-0 m-0 relative">
                               <div className="flex items-center justify-center min-h-[300px]">
                                 <span 
                                   className="font-extrabold text-[12px] uppercase tracking-[0.3em] text-amber-500 whitespace-nowrap print:!text-gray-400"
                                   style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                                 >
                                   {p.breakTitle || "LUNCH"}
                                 </span>
                               </div>
                             </td>
                           );
                        } else {
                           return null;
                        }
                      }

                      const entry = getEntry(day, p.no);
                      return (
                        <td key={i} className="py-1.5 px-1.5 border-r border-gray-100 align-middle group">
                          {entry ? (
                            <div className="relative bg-emerald-50 border border-emerald-200 rounded-lg p-2 shadow-sm min-h-[50px] print:border-gray-300 print:bg-white print:shadow-none">
                              <div className="text-[11px] font-bold text-emerald-800 leading-snug print:text-black">
                                {entry.subject_id?.name || "Subject"}
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 print:text-gray-600">
                                <GraduationCap size={9} />
                                {role === "TEACHER" ? (
                                  entry.section_id ? `Class ${entry.section_id.class_id?.name || ''} - Sec ${entry.section_id.name}` : "Unknown Section"
                                ) : (
                                  entry.teacher_id?.user_id?.name || "Teacher"
                                )}
                              </div>
                              {role === "ADMIN" && (
                                <button
                                  onClick={() => handleDeleteSlot(entry._id)}
                                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md print:hidden"
                                >
                                  <X size={9} />
                                </button>
                              )}
                            </div>
                          ) : role === "ADMIN" ? (
                            <button
                              onClick={() => { setModal({ day, period_no: p.no }); setSlotSubject(""); setSlotTeacher(""); }}
                              className="w-full h-12 rounded-lg border border-dashed border-gray-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-gray-400 hover:text-slate-600 transition-all flex items-center justify-center group/btn shadow-sm print:hidden"
                            >
                              <Plus size={14} className="mr-1" /> <span className="text-[10px] font-bold uppercase tracking-wider">Add</span>
                            </button>
                          ) : (
                            <div className="h-10 flex items-center justify-center text-gray-200 text-[10px]">&mdash;</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        role !== "ADMIN" ? null : (
          <div className="card py-16 text-center border-dashed border-2 print:hidden">
            <BookOpen size={32} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm font-semibold text-gray-400">Select a class and section above to view the timetable.</p>
          </div>
        )
      )}

      {/* Add Slot Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden"
          onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
             ... {/* kept compact below */}
            <div className="px-5 py-4 border-b border-gray-100 bg-slate-800 flex justify-between items-center">
               <div>
                 <h3 className="font-bold text-white text-sm">Assign Slot</h3>
                 <p className="text-slate-400 text-xs mt-0.5">{modal.day} · Period {modal.period_no}</p>
               </div>
               <button onClick={() => setModal(null)} className="text-slate-400 hover:text-white transition-colors">
                 <X size={18} />
               </button>
            </div>
            <div className="p-5 space-y-4">
               <div>
                 <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Subject</label>
                 <select value={slotSubject} onChange={(e) => setSlotSubject(e.target.value)} className="input-field w-full">
                   <option value="">Select a subject</option>
                   {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                 </select>
               </div>
               <div>
                 <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                   Teacher <span className="text-emerald-600 font-normal normal-case ml-1">— only free teachers shown</span>
                 </label>
                 {availableTeachersForSlot.length === 0 ? (
                   <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg p-3">
                     <ShieldAlert size={14} /> All teachers are busy at {modal.day} Period {modal.period_no}.
                   </div>
                 ) : (
                   <select value={slotTeacher} onChange={(e) => setSlotTeacher(e.target.value)} className="input-field w-full">
                     <option value="">Select a teacher</option>
                     {availableTeachersForSlot.map((t) => (
                       <option key={t._id} value={t._id}>
                         {t.user_id?.name || "Teacher"}
                         {t.subjects?.length > 0 ? ` (${t.subjects.map(s => s.name || s).join(", ")})` : ""}
                       </option>
                     ))}
                   </select>
                 )}
               </div>
               <button onClick={handleAddSlot} disabled={saving || !slotSubject || !slotTeacher} className="btn-primary w-full disabled:opacity-50">
                 {saving ? <Loader2 size={15} className="animate-spin" /> : <><Plus size={15} /> Confirm Slot</>}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Config Period Modal */}
      {configModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden"
          onClick={(e) => e.target === e.currentTarget && setConfigModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
             <div className="px-5 py-4 border-b border-gray-100 bg-slate-800 flex justify-between items-center shrink-0">
               <h3 className="font-bold text-white text-sm flex items-center gap-2"><SettingsIcon size={16}/> Configure Timetable</h3>
               <button onClick={() => setConfigModal(false)} className="text-slate-400 hover:text-white transition-colors">
                 <X size={18} />
               </button>
             </div>
             
             <div className="p-5 overflow-y-auto flex-1 space-y-4">
                <p className="text-xs text-gray-500 font-medium">Reorder periods, set timings, or add breaks. Structural changes apply to all classes globally.</p>
                
                {editablePeriods.map((p, i) => (
                   <div key={i} className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                     <div className="flex-1 space-y-2">
                       <div className="flex items-center gap-2">
                         <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 w-16">{p.isBreak ? "Break" : "Period"}</div>
                         {!p.isBreak ? (
                           <input type="number" min="1" value={p.no || ""} onChange={e => updateEditable(i, {no: Number(e.target.value)})} className="border border-gray-300 rounded px-2 py-1 text-xs w-16" placeholder="No." />
                         ) : (
                           <input type="text" value={p.breakTitle || ""} onChange={e => updateEditable(i, {breakTitle: e.target.value})} className="border border-gray-300 rounded px-2 py-1 text-xs flex-1" placeholder="Break Title (e.g. Lunch)" />
                         )}
                       </div>
                       <div className="flex items-center gap-2">
                         <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 w-16">Time</div>
                         <input type="text" value={p.label || ""} onChange={e => updateEditable(i, {label: e.target.value})} className="border border-gray-300 rounded px-2 py-1 text-xs flex-1" placeholder="e.g. 9:00 - 9:45" />
                       </div>
                     </div>
                     <button onClick={() => removeEditable(i)} className="text-red-400 hover:text-red-600 bg-white border border-red-100 shadow-sm p-2 rounded-lg transition-colors">
                       <Trash2 size={16} />
                     </button>
                   </div>
                ))}
             </div>

             <div className="px-5 py-4 border-t border-gray-100 bg-white flex items-center justify-between shrink-0">
               <div className="flex gap-2">
                 <button onClick={addPeriod} className="btn-secondary !text-xs !py-1.5"><Plus size={14}/> Class</button>
                 <button onClick={addBreak} className="btn-secondary !text-xs !py-1.5 !bg-amber-50 !text-amber-700 !border-amber-200 hover:!bg-amber-100"><Plus size={14}/> Break</button>
               </div>
               <button onClick={saveConfig} disabled={saving} className="btn-primary flex items-center gap-2">
                 {saving ? <Loader2 className="animate-spin" size={16}/> : <>Save Layout</>}
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Report Issue Modal (teacher) */}
      {reportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
              <AlertTriangle size={16} className="text-red-500" /> Report Timetable Issue
            </h3>
            <textarea
              value={issueMsg} onChange={(e) => setIssueMsg(e.target.value)}
              className="input-field w-full h-24 resize-none mb-4"
              placeholder="Describe the conflict or issue..."
            />
            <div className="flex gap-3">
              <button onClick={() => setReportModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={reportIssue} className="btn-primary flex-1 !bg-red-600 hover:!bg-red-700 !border-red-700">
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
