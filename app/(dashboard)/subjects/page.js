"use client";

import { useEffect, useState } from "react";
import { BookOpen, Plus, X } from "lucide-react";
import toast from "react-hot-toast";

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "" });

  useEffect(() => {
    fetch("/api/subjects")
      .then((r) => r.json())
      .then((d) => setSubjects(Array.isArray(d) ? d : []))
      .catch(() => toast.error("Failed to load subjects"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/subjects", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(form) 
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ name: "" });
        const updated = await fetch("/api/subjects").then((r) => r.json());
        setSubjects(Array.isArray(updated) ? updated : []);
        toast.success("Subject added");
      } else {
        toast.error("Failed to add subject");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="h-8 w-48 animate-shimmer rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-shimmer rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Subjects</h1>
          <p className="page-subtitle">{subjects.length} subject{subjects.length !== 1 ? "s" : ""} currently available.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className={`btn-primary ${showForm ? "bg-gray-500 hover:bg-gray-600 !shadow-none" : ""}`}>
          {showForm ? <><X size={16}/> Cancel</> : <><Plus size={16}/> Add Subject</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card bg-gray-50/50 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Subject Name</label>
            <input placeholder="e.g. Mathematics" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" disabled={creating} />
          </div>
          <div className="md:col-span-2 flex justify-start">
             <button type="submit" className="btn-primary" disabled={creating}>{creating ? "Saving..." : "Save Subject"}</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {subjects.map((s) => (
          <div key={s._id} className="card hover:shadow-md transition-all group flex flex-col p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-100 text-slate-600 rounded-md group-hover:bg-slate-200 transition-colors">
                <BookOpen size={20} />
              </div>
              <h3 className="text-sm font-bold text-gray-900">{s.name}</h3>
            </div>
          </div>
        ))}
        {subjects.length === 0 && (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-gray-200 rounded-lg">
            <div className="w-12 h-12 bg-gray-100 text-gray-300 rounded-lg flex items-center justify-center mx-auto mb-3">
              <BookOpen size={28} />
            </div>
            <h3 className="text-base font-bold text-gray-700">No subjects created</h3>
            <p className="text-sm text-gray-500 mt-1">Add your first subject to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
