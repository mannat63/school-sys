"use client";

import { useEffect, useState } from "react";
import { Trash2, RotateCcw, AlertTriangle, PackageOpen, RefreshCw, User, Users, GraduationCap, Layers, ChevronLeft, ChevronRight } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

const COLLECTION_META = {
  Student:  { label: "Students",  Icon: GraduationCap, color: "bg-indigo-100 text-indigo-700" },
  Teacher:  { label: "Teachers",  Icon: Users,          color: "bg-blue-100 text-blue-700" },
  Class:    { label: "Courses",   Icon: Layers,         color: "bg-violet-100 text-violet-700" },
};

function getLabel(item) {
  const c = item.original_collection;
  if (c === "Student") return item.data?.student?.user_id?.name || item.data?.user?.name || "Unknown Student";
  if (c === "Teacher") return item.data?.user?.name || "Unknown Teacher";
  if (c === "Class")   return item.data?.class?.name || "Unknown Course";
  return "Record";
}

function getSubLabel(item) {
  const c = item.original_collection;
  if (c === "Student") {
    const secs = item.data?.student?.section_id;
    return secs ? `Section: ${secs}` : "No section";
  }
  if (c === "Teacher") return item.data?.teacher?.user_id ? "Faculty member" : "—";
  if (c === "Class") {
    const secCount = item.data?.sections?.length || 0;
    return secCount ? `${secCount} section${secCount > 1 ? "s" : ""} included` : "No sections";
  }
  return "";
}

export default function RecycleBinPage() {
  const [items, setItems]       = useState([]);
  const [counts, setCounts]     = useState({});
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("ALL");
  const [restoring, setRestoring] = useState(null);
  const [deleting, setDeleting]   = useState(null);

  const PAGE_SIZE = 30;
  const [page, setPage] = useState(1);

  async function load() {
    setLoading(true);
    try {
      const params = filter !== "ALL" ? `?collection=${filter}` : "";
      const res = await fetch(`/api/recycle-bin${params}`);
      const data = await res.json();
      if (!data.error) {
        setItems(data.items || []);
        setCounts(data.counts || {});
      }
    } catch { /* silent */ }
    setLoading(false);
  }

  useEffect(() => { 
    setPage(1);
    load(); 
  }, [filter]);

  async function restore(id, name) {
    if (!confirm(`Restore "${name}"? This will re-add them to the system.`)) return;
    setRestoring(id);
    try {
      const res = await fetch(`/api/recycle-bin/${id}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(`Restored successfully!`);
        setItems(prev => prev.filter(i => i._id !== id));
      } else {
        toast.error(data.error || "Restore failed");
      }
    } catch { toast.error("Network error"); }
    setRestoring(null);
  }

  async function permanentDelete(id, name) {
    if (!confirm(`Permanently delete "${name}"? This CANNOT be undone.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/recycle-bin/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Permanently deleted");
        setItems(prev => prev.filter(i => i._id !== id));
      } else {
        toast.error(data.error || "Delete failed");
      }
    } catch { toast.error("Network error"); }
    setDeleting(null);
  }

  async function emptyBin() {
    if (!confirm("Empty the entire recycle bin? All records will be permanently deleted. This cannot be undone.")) return;
    try {
      const res = await fetch("/api/recycle-bin", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Recycle bin emptied");
        setItems([]);
        setCounts({});
      }
    } catch { toast.error("Failed to empty bin"); }
  }

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  const filterOptions = [
    { key: "ALL", label: `All (${totalCount})` },
    ...Object.entries(COLLECTION_META).map(([key, meta]) => ({
      key,
      label: `${meta.label} (${counts[key] || 0})`
    }))
  ];

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      <Toaster position="top-right" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Trash2 size={22} className="text-red-400" /> Recycle Bin
          </h1>
          <p className="text-sm text-gray-500 mt-1">Deleted records are stored here for 30 days before permanent removal.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          {totalCount > 0 && (
            <button onClick={emptyBin} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 hover:bg-red-100 font-semibold transition-colors">
              <Trash2 size={14} /> Empty Bin
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {filterOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${filter === opt.key ? "bg-gray-900 text-white border-slate-800" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 animate-pulse bg-gray-100 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center shadow-sm">
          <PackageOpen size={36} className="text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-900 font-semibold mb-1">Recycle Bin is Empty</h3>
          <p className="text-gray-400 text-sm">Deleted records will appear here.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(item => {
              const meta = COLLECTION_META[item.original_collection] || {};
            const { Icon } = meta;
            const label = getLabel(item);
            const sub   = getSubLabel(item);
            const deletedAt = new Date(item.createdAt);
            const deletedBy = item.deleted_by?.name || "Admin";
            const isRestoring = restoring === item._id;
            const isDeleting  = deleting  === item._id;

            return (
              <div key={item._id} className="bg-white border border-gray-100 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
                {/* Icon */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color || "bg-gray-100 text-gray-600"}`}>
                  {Icon ? <Icon size={16} /> : <User size={16} />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm truncate">{label}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.color || "bg-gray-100 text-gray-500"}`}>
                      {item.original_collection}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-3">
                    {sub && <span>{sub}</span>}
                    <span>Deleted {deletedAt.toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"2-digit" })} by {deletedBy}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => restore(item._id, label)}
                    disabled={isRestoring || isDeleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw size={12} className={isRestoring ? "animate-spin" : ""} />
                    {isRestoring ? "Restoring…" : "Restore"}
                  </button>
                  <button
                    onClick={() => permanentDelete(item._id, label)}
                    disabled={isRestoring || isDeleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                    {isDeleting ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            );
          })}
          </div>

          {Math.ceil(items.length / PAGE_SIZE) > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-6">
              <span className="text-sm text-gray-500 font-medium">
                Page {page} of {Math.ceil(items.length / PAGE_SIZE)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(Math.ceil(items.length / PAGE_SIZE), p + 1))}
                  disabled={page === Math.ceil(items.length / PAGE_SIZE)}
                  className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {items.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={13} className="flex-shrink-0" />
          Records in the recycle bin still occupy database space. Use "Empty Bin" or permanently delete items when confident they are no longer needed.
        </div>
      )}
    </div>
  );
}
