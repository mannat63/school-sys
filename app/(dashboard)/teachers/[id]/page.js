"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, BookOpen, Users, AlertTriangle, GraduationCap, Clock, FolderOpen, ExternalLink } from "lucide-react";

const COLORS = ["bg-indigo-600", "bg-violet-600", "bg-blue-600", "bg-teal-600", "bg-rose-600", "bg-amber-600", "bg-slate-700"];
const aColor = (name) => COLORS[(name?.charCodeAt(0) || 0) % COLORS.length];

export default function TeacherProfilePage() {
  const { id } = useParams();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    fetch(`/api/teachers/${id}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="h-8 w-32 animate-shimmer rounded-lg" />
      <div className="card !p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl animate-shimmer" />
        <div className="space-y-2 flex-1"><div className="h-5 w-40 animate-shimmer rounded" /><div className="h-3 w-28 animate-shimmer rounded" /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[1, 2].map(i => <div key={i} className="card !p-5 h-24 animate-shimmer" />)}
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-3xl mx-auto">
      <Link href="/teachers" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6"><ArrowLeft size={16} /> Back</Link>
      <div className="card py-16 text-center"><AlertTriangle size={32} className="mx-auto mb-3 text-red-400" /><p className="text-red-600 font-semibold">{error}</p></div>
    </div>
  );

  const { teacher, sections, totalStudents, homeworks } = data;
  const name    = teacher.user_id?.name || "Unknown";
  const contact = teacher.user_id?.phoneOrEmail || "—";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/teachers" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft size={16} /> Back to Teachers
      </Link>

      {/* Hero */}
      <div className="card !p-6">
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl ${aColor(name)} flex items-center justify-center text-white font-bold text-2xl flex-shrink-0`}>
            {name[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{name}</h1>
            <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Phone size={12} />{contact}</span>
              <span className="flex items-center gap-1"><Users size={12} />{totalStudents} students</span>
              <span className="flex items-center gap-1"><GraduationCap size={12} />{sections.length} section{sections.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Subjects */}
      {(teacher.subjects || []).length > 0 && (
        <div className="card !p-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Subjects</h3>
          <div className="flex flex-wrap gap-2">
            {teacher.subjects.map(s => (
              <span key={s._id} className="flex items-center gap-1.5 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg">
                <BookOpen size={13} /> {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card !p-4">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Sections</span>
          <span className="text-2xl font-bold text-gray-900 block mt-1">{sections.length}</span>
        </div>
        <div className="card !p-4">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Students</span>
          <span className="text-2xl font-bold text-gray-900 block mt-1">{totalStudents}</span>
        </div>
        <div className="card !p-4">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Subjects</span>
          <span className="text-2xl font-bold text-gray-900 block mt-1">{(teacher.subjects || []).length}</span>
        </div>
      </div>

      {/* Sections */}
      {sections.length > 0 && (
        <div className="card !p-0">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-700">Assigned Sections</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {sections.map(sec => (
              <div key={sec._id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <div className="text-sm font-semibold text-gray-800">
                    {sec.class_id?.name ? `${sec.class_id.name} · ` : ""}{sec.name}
                  </div>
                  {sec.class_id?.name && <div className="text-xs text-gray-400">{sec.class_id.name}</div>}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
                  <Users size={12} /> {sec.studentCount} students
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sections.length === 0 && (
        <div className="card py-10 text-center border-dashed">
          <GraduationCap size={24} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500">Not assigned to any sections yet</p>
        </div>
      )}

      {/* Homeworks */}
      <div className="card !p-0 mt-6">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-700">Homework Given by {name}</h3>
        </div>
        <div className="p-5">
          {(!homeworks || homeworks.length === 0) ? (
            <div className="text-center py-8">
              <BookOpen size={24} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">No homework assigned yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {homeworks.map(hw => {
                const dueDate = new Date(hw.due_date);
                const isOverdue = dueDate < new Date();

                return (
                  <div key={hw._id} 
                    className={`bg-white border ${isOverdue ? 'border-red-200' : 'border-gray-200'} rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col relative`}
                  >
                    {/* Due Badge */}
                    <div className={`absolute -top-3 -right-2 px-3 py-1 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-1 ${
                      isOverdue ? "bg-red-500 text-white" : "bg-slate-800 text-white"
                    }`}>
                      <Clock size={12} />
                      {isOverdue ? "OVERDUE" : `Due ${dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                    </div>

                    <div className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-500 mb-1">{hw.subject}</div>
                    <h3 className="text-base text-gray-900 font-bold mb-2 leading-tight">{hw.title}</h3>
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">{hw.description}</p>
                    
                    <div className="text-xs font-semibold text-gray-600 bg-gray-50 px-2 py-1 rounded-md self-start mb-3 border border-gray-100">
                      {hw.section_id?.class_id?.name ? `${hw.section_id.class_id.name} · ` : ""}{hw.section_id?.name}
                    </div>

                    {hw.drive_link && (
                      <a href={hw.drive_link} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg px-2.5 py-1 mb-3 transition-colors self-start">
                        <FolderOpen size={11} /> View Link
                      </a>
                    )}

                    <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                      <div className="text-xs font-medium text-gray-600">
                        <span className="text-slate-900 font-bold">{hw.submissions || 0}</span> / {hw.total_students || 0} Submitted
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
