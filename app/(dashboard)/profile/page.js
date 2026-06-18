"use client";

import { useEffect, useState } from "react";
import { User, Phone, Mail, GraduationCap, Layers, BookOpen, Calendar, Shield, Pencil, Check, X } from "lucide-react";

const COLORS = ["bg-indigo-600", "bg-violet-600", "bg-blue-600", "bg-teal-600", "bg-rose-600", "bg-amber-600", "bg-slate-700"];
const aColor = (name) => COLORS[(name?.charCodeAt(0) || 0) % COLORS.length];

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Icon size={15} className="text-gray-500" />
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-gray-800 mt-0.5">{value || "—"}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(false);
  const [form, setForm]         = useState({ name: "" });
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState(null);

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const me = await fetch("/api/me").then(r => r.json());
      setProfile(me);
      setForm({ name: me.name || "" });
    } catch { setMsg({ type: "error", text: "Failed to load profile" }); }
    setLoading(false);
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch("/api/me", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name }) });
      if (res.ok) { setMsg({ type: "success", text: "Name updated!" }); setEditing(false); loadProfile(); }
      else { const d = await res.json(); setMsg({ type: "error", text: d.error || "Failed to save" }); }
    } catch { setMsg({ type: "error", text: "Network error" }); }
    setSaving(false);
    setTimeout(() => setMsg(null), 3000);
  }

  if (loading) return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="h-8 w-32 animate-shimmer rounded-lg" />
      <div className="card !p-6 space-y-4">
        <div className="flex items-center gap-4"><div className="w-20 h-20 rounded-2xl animate-shimmer" /><div className="space-y-2 flex-1"><div className="h-5 w-36 animate-shimmer rounded" /><div className="h-3 w-24 animate-shimmer rounded" /></div></div>
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 animate-shimmer rounded-lg" />)}</div>
      </div>
    </div>
  );

  const name    = profile?.name || "Unknown";
  const role    = profile?.role || "";
  const contact = profile?.phoneOrEmail || "";

  const roleIcon = role === "ADMIN" ? Shield : role === "TEACHER" ? GraduationCap : User;
  const RoleIcon = roleIcon;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">My Profile</h1>
        <p className="page-subtitle">Your account details and information</p>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm font-semibold border ${msg.type === "error" ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
          {msg.text}
        </div>
      )}

      {/* Hero card */}
      <div className="card !p-6">
        <div className="flex items-center gap-4">
          <div className={`w-20 h-20 rounded-2xl ${aColor(name)} flex items-center justify-center text-white font-bold text-3xl flex-shrink-0`}>
            {name[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <form onSubmit={handleSave} className="flex items-center gap-2">
                <input autoFocus value={form.name} onChange={(e) => setForm({ name: e.target.value })} className="input-field flex-1 !py-1.5 text-sm font-semibold" placeholder="Your name" />
                <button type="submit" disabled={saving} className="p-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"><Check size={16} /></button>
                <button type="button" onClick={() => setEditing(false)} className="p-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"><X size={16} /></button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900">{name}</h2>
                <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors"><Pencil size={14} /></button>
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg ${role === "ADMIN" ? "bg-indigo-50 text-indigo-700 border border-indigo-100" : role === "TEACHER" ? "bg-teal-50 text-teal-700 border border-teal-100" : "bg-slate-50 text-slate-700 border border-slate-200"}`}>
                <RoleIcon size={11} /> {role}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="card !p-5">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Account Details</h3>
        <div>
          <InfoRow icon={contact?.includes("@") ? Mail : Phone} label="Email / Phone" value={contact} />
          <InfoRow icon={RoleIcon} label="Role" value={role} />
          {profile?.sectionName && <InfoRow icon={Layers} label="Section" value={profile.sectionName} />}
          {profile?.className && <InfoRow icon={GraduationCap} label="Class" value={profile.className} />}
          {profile?.subjectNames && <InfoRow icon={BookOpen} label="Subjects" value={Array.isArray(profile.subjectNames) ? profile.subjectNames.join(", ") : profile.subjectNames} />}
          {profile?.sectionsCount !== undefined && <InfoRow icon={Layers} label="Sections" value={String(profile.sectionsCount)} />}
          {profile?.studentCount !== undefined && <InfoRow icon={User} label="Students" value={String(profile.studentCount)} />}
        </div>
      </div>

      {/* Role-specific quick links */}
      <div className="card !p-5">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          {role === "ADMIN" && <>
            <a href="/students" className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm font-semibold text-gray-700 transition-colors"><User size={14} className="text-indigo-500" /> Students</a>
            <a href="/teachers" className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm font-semibold text-gray-700 transition-colors"><GraduationCap size={14} className="text-teal-500" /> Teachers</a>
            <a href="/fees" className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm font-semibold text-gray-700 transition-colors"><BookOpen size={14} className="text-amber-500" /> Fees</a>
            <a href="/automation" className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm font-semibold text-gray-700 transition-colors"><Shield size={14} className="text-violet-500" /> Settings</a>
          </>}
          {role === "TEACHER" && <>
            <a href="/students" className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm font-semibold text-gray-700 transition-colors"><User size={14} className="text-indigo-500" /> My Students</a>
            <a href="/attendance" className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm font-semibold text-gray-700 transition-colors"><Calendar size={14} className="text-teal-500" /> Attendance</a>
            <a href="/tests" className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm font-semibold text-gray-700 transition-colors"><BookOpen size={14} className="text-amber-500" /> Tests</a>
            <a href="/timetable" className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm font-semibold text-gray-700 transition-colors"><Layers size={14} className="text-violet-500" /> Timetable</a>
          </>}
          {role === "STUDENT" && <>
            <a href="/attendance" className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm font-semibold text-gray-700 transition-colors"><Calendar size={14} className="text-teal-500" /> My Attendance</a>
            <a href="/tests" className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm font-semibold text-gray-700 transition-colors"><BookOpen size={14} className="text-amber-500" /> My Results</a>
            <a href="/fees" className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm font-semibold text-gray-700 transition-colors"><User size={14} className="text-rose-500" /> My Fees</a>
            <a href="/timetable" className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm font-semibold text-gray-700 transition-colors"><Layers size={14} className="text-violet-500" /> Timetable</a>
          </>}
        </div>
      </div>
    </div>
  );
}
