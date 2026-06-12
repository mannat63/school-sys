"use client";

import { useState, useEffect } from "react";
import { Plus, Search, BookOpen, Clock, FileText, CheckCircle, Save, X, Edit3, Trash2, Bell } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
export default function HomeworkPage() {
  const [role, setRole] = useState("");

  const [homeworks, setHomeworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedHw, setSelectedHw] = useState(null); // For viewing submissions/details

  // --- TEACHER MODAL STATE ---
  const [sections, setSections] = useState([]);
  const [formData, setFormData] = useState({ title: "", description: "", subject: "", due_date: "", section_id: "" });
  const [hwSubmissions, setHwSubmissions] = useState([]);
  const [editingGrades, setEditingGrades] = useState({});
  
  // --- STUDENT MODAL STATE ---
  const [studentComment, setStudentComment] = useState("");

  useEffect(() => {
    async function init() {
      const ms = await fetch("/api/me").then(r => r.json());
      const r = ms?.role || "STUDENT";
      setRole(r);
      fetchHomeworks();
      if (r === "TEACHER") {
        fetchSections();
      }
    }
    init();
  }, []);

  async function fetchHomeworks() {
    try {
      const res = await fetch("/api/homework");
      if (res.ok) setHomeworks(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function fetchSections() {
    const res = await fetch("/api/sections");
    if (res.ok) setSections(await res.json());
  }

  // --- TEACHER ACTIONS ---
  async function handleCreate(e) {
    e.preventDefault();
    try {
      const res = await fetch("/api/homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        toast.success("Homework assigned!");
        setShowCreateModal(false);
        setFormData({ title: "", description: "", subject: "", due_date: "", section_id: "" });
        fetchHomeworks();
      } else {
        toast.error((await res.json()).error);
      }
    } catch {
      toast.error("Error creating homework");
    }
  }

  async function loadHwDetails(id) {
    setSelectedHw(null);
    setHwSubmissions([]);
    const res = await fetch(`/api/homework/${id}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedHw(data.homework);
      setHwSubmissions(data.submissions);
    }
  }

  async function deleteHw(id) {
    if (!confirm("Delete this homework?")) return;
    await fetch(`/api/homework/${id}`, { method: "DELETE" });
    toast.success("Deleted!");
    fetchHomeworks();
    if (selectedHw?._id === id) setSelectedHw(null);
  }

  async function gradeSubmission(student_id, grade, teacher_feedback) {
    if (!grade) {
      return toast.error("Please enter a grade first.");
    }
    const res = await fetch(`/api/homework/${selectedHw._id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id, grade, teacher_feedback })
    });
    if (res.ok) {
      toast.success("Graded successfully!");
      setEditingGrades(prev => ({ ...prev, [student_id]: false }));
      loadHwDetails(selectedHw._id);
    }
  }

  async function alertUnsubmitted(id) {
    if(!confirm("Send an alert notification to all students who have not submitted yet?")) return;
    const res = await fetch(`/api/homework/${id}/alert`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      if(data.count === 0) {
        toast.success("All students have submitted!");
      } else {
        toast.success(`Alerted ${data.count} student(s)!`);
      }
    } else {
      toast.error((await res.json()).error || "Failed to send alerts");
    }
  }

  // --- STUDENT ACTIONS ---
  async function handleStudentSubmit() {
    if (!studentComment.trim()) return toast.error("Please provide an answer or link.");
    const res = await fetch(`/api/homework/${selectedHw._id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_comment: studentComment })
    });
    if (res.ok) {
      toast.success("Submitted!");
      setSelectedHw(null);
      fetchHomeworks();
    }
  }

  // -- UI Helpers --
  function statusBadge(status) {
    if (status === "GRADED") return <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">GRADED</span>;
    if (status === "SUBMITTED") return <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-bold">SUBMITTED</span>;
    return <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">PENDING</span>;
  }

  if (loading) return <div className="p-8 text-sm text-gray-500">Loading homework...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <Toaster position="top-right" />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Homework & Assignments</h1>
          <p className="text-sm text-slate-500 mt-1">Manage class assignments and student submissions.</p>
        </div>
        
        {role === "TEACHER" && (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus size={16} /> Assign Homework
          </button>
        )}
      </div>

      {homeworks.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
          <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-900 font-semibold mb-1">No Assignments Yet</h3>
          <p className="text-gray-500 text-sm">When homework is assigned, it will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {homeworks.map(hw => {
            const dueDate = new Date(hw.due_date);
            const isOverdue = dueDate < new Date() && role === "STUDENT" && hw.student_status === "PENDING";

            return (
              <div key={hw._id} 
                onClick={() => {
                  if (role === "TEACHER") loadHwDetails(hw._id);
                  if (role === "STUDENT") {
                    setSelectedHw(hw);
                    setStudentComment(hw.student_comment || "");
                  }
                }}
                className={`bg-white border ${isOverdue ? 'border-red-200 shadow-[0_0_15px_rgba(239,68,68,0.05)]' : 'border-gray-200'} rounded-2xl p-5 hover:shadow-md transition-all cursor-pointer group flex flex-col relative`}
              >
                {/* Due Badge */}
                <div className={`absolute -top-3 -right-2 px-3 py-1 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-1 ${
                  isOverdue ? "bg-red-500 text-white" : "bg-slate-800 text-white"
                }`}>
                  <Clock size={12} />
                  {isOverdue ? "OVERDUE" : `Due ${dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                </div>

                <div className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-500 mb-1">{hw.subject}</div>
                <h3 className="text-base text-gray-900 font-bold mb-2 leading-tight group-hover:text-indigo-600 transition-colors">{hw.title}</h3>
                <p className="text-sm text-gray-500 mb-4 line-clamp-2">{hw.description}</p>
                
                <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                  {role === "TEACHER" ? (
                    <div className="text-xs font-medium text-gray-600">
                      <span className="text-slate-900 font-bold">{hw.submissions}</span> / {hw.total_students} Submitted
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      {statusBadge(hw.student_status)}
                      {hw.grade && <span className="text-xs font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md">Grade: {hw.grade}</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- TEACHER: VIEW SUBMISSIONS MODAL --- */}
      {role === "TEACHER" && selectedHw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">{selectedHw.title}</h2>
                <div className="text-xs text-slate-300 mt-0.5 flex items-center gap-4">
                  <span>{selectedHw.subject}</span>
                  <span>Due: {new Date(selectedHw.due_date).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => alertUnsubmitted(selectedHw._id)} className="bg-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors text-xs font-bold uppercase tracking-wide" title="Alert Missing Students">
                  <Bell size={14} /> Alert Missing/Late
                </button>
                <div className="w-px h-6 bg-slate-700 mx-1 self-center"></div>
                <button onClick={() => deleteHw(selectedHw._id)} className="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white p-2 rounded-lg transition-colors" title="Delete Homework">
                  <Trash2 size={16} />
                </button>
                <button onClick={() => setSelectedHw(null)} className="hover:bg-slate-800 p-2 rounded-lg text-slate-300 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
              <div className="space-y-4">
                {hwSubmissions.map(sub => (
                  <div key={sub.student_id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <div>
                        <div className="font-bold text-gray-900">{sub.student_name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{statusBadge(sub.status)}</div>
                      </div>
                      
                      {/* Grading Controls */}
                      <div className="flex items-center gap-2">
                         {sub.status === "GRADED" && !editingGrades[sub.student_id] ? (
                           <>
                             <div className="bg-emerald-50 text-emerald-800 font-bold px-3 py-1.5 rounded-lg text-sm border border-emerald-200">
                               Grade: {sub.grade}
                             </div>
                             <button
                               onClick={() => setEditingGrades(prev => ({...prev, [sub.student_id]: true}))}
                               className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide uppercase transition-colors"
                             >
                               Edit
                             </button>
                           </>
                         ) : (
                           <>
                             <input 
                                type="text" 
                                id={`grade-${sub.student_id}`}
                                placeholder="Grade (e.g. 10/10)"
                                defaultValue={sub.grade || ""}
                                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-32 focus:ring-1 focus:ring-indigo-500 outline-none"
                             />
                             <button
                               onClick={() => {
                                 const val = document.getElementById(`grade-${sub.student_id}`).value;
                                 gradeSubmission(sub.student_id, val, sub.teacher_feedback);
                               }}
                               className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide uppercase transition-colors"
                             >
                               {sub.status === "GRADED" ? "Update Grade" : "Submit Grade"}
                             </button>
                             {sub.status === "GRADED" && (
                               <button
                                 onClick={() => setEditingGrades(prev => ({...prev, [sub.student_id]: false}))}
                                 className="text-gray-500 hover:text-gray-700 px-2 text-xs font-semibold"
                               >
                                 Cancel
                               </button>
                             )}
                           </>
                         )}
                         <button 
                           onClick={() => {
                             const fb = prompt("Enter feedback:", sub.teacher_feedback);
                             if (fb !== null) {
                               const val = sub.status === "GRADED" && !editingGrades[sub.student_id] 
                                  ? sub.grade 
                                  : document.getElementById(`grade-${sub.student_id}`).value;
                               gradeSubmission(sub.student_id, val, fb);
                             }
                           }}
                           className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide uppercase transition-colors"
                         >
                           Feedback
                         </button>
                      </div>
                    </div>
                    
                    {sub.student_comment ? (
                       <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                         <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Student's Answer/Link</div>
                         <div className="text-sm text-indigo-900 break-words whitespace-pre-wrap">{sub.student_comment}</div>
                       </div>
                    ) : (
                       <div className="text-xs text-gray-400 italic py-2">No submission data yet.</div>
                    )}

                    {sub.teacher_feedback && (
                       <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                         <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">Your Feedback</div>
                         <div className="text-sm text-amber-900 break-words whitespace-pre-wrap">{sub.teacher_feedback}</div>
                       </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- STUDENT: VIEW/SUBMIT MODAL --- */}
      {role === "STUDENT" && selectedHw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
             <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
               <div>
                 <div className="text-xs font-bold text-indigo-600 tracking-wider uppercase mb-0.5">{selectedHw.subject}</div>
                 <h2 className="text-lg font-bold text-gray-900">{selectedHw.title}</h2>
               </div>
               <button onClick={() => setSelectedHw(null)} className="hover:bg-gray-200 p-2 rounded-lg text-gray-500 transition-colors">
                  <X size={20} />
               </button>
             </div>
             
             <div className="p-6 overflow-y-auto space-y-5 flex-1">
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                   <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                     <FileText size={14}/> Assignment Details
                   </div>
                   <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{selectedHw.description}</div>
                </div>

                {selectedHw.teacher_feedback && (
                   <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 shadow-sm">
                      <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Teacher Feedback</div>
                      <div className="text-sm text-emerald-900">{selectedHw.teacher_feedback}</div>
                   </div>
                )}
                
                <div>
                   <label className="block text-xs font-bold text-gray-700 tracking-wider uppercase mb-2">Your Answer or Link</label>
                   <textarea 
                     value={studentComment}
                     onChange={(e) => setStudentComment(e.target.value)}
                     placeholder="Type your answer or paste a Google Drive / Docs link here..."
                     disabled={selectedHw.student_status === "GRADED"}
                     className="w-full border border-gray-300 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all disabled:opacity-50 disabled:bg-gray-50 min-h-[120px] resize-y"
                   />
                </div>
             </div>

             <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {statusBadge(selectedHw.student_status)}
                  {selectedHw.grade && <span className="text-xs font-bold text-gray-900 bg-white border border-gray-200 shadow-sm px-2 py-1 rounded-md">Grade: {selectedHw.grade}</span>}
                </div>
                {selectedHw.student_status !== "GRADED" && (
                  <button 
                    onClick={handleStudentSubmit}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2"
                  >
                    <Save size={16} /> Submit Work
                  </button>
                )}
             </div>
          </div>
        </div>
      )}

      {/* --- TEACHER: CREATE ASSIGNMENT MODAL --- */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Create Assignment</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:bg-gray-100 rounded-lg p-1 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleCreate} id="createHwForm" className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Title</label>
                  <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Chapter 4 Motion Vectors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Description</label>
                  <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px]" placeholder="Instructions or questions..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Subject</label>
                    <input required type="text" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Physics" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Due Date</label>
                    <input required type="datetime-local" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Section</label>
                  <select required value={formData.section_id} onChange={e => setFormData({...formData, section_id: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">Select a section...</option>
                    {sections.map(s => (
                      <option key={s._id} value={s._id}>{s.class_id?.name} - {s.name}</option>
                    ))}
                  </select>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setShowCreateModal(false)} type="button" className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
              <button type="submit" form="createHwForm" className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-md transition-all">Assign Now</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
