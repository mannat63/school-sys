"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Settings, Bell, CalendarCheck, Zap, Send,
  GraduationCap, AlertTriangle, CheckCircle, Layers, ArrowRight
} from "lucide-react";

export default function AutomationPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const [promoting, setPromoting] = useState(false);
  const [promotionResult, setPromotionResult] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .finally(() => setLoading(false));
  }, []);

  async function handlePromotion() {
    setShowConfirm(false);
    setPromoting(true);
    setPromotionResult(null);
    const id = toast.loading("Promoting all students…");
    try {
      const res = await fetch("/api/promote-students", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setPromotionResult(data);
        toast.success(`${data.promoted} students promoted!`, { id });
      } else {
        toast.error(data.error || "Promotion failed", { id });
      }
    } catch {
      toast.error("Network error during promotion", { id });
    }
    setPromoting(false);
  }

  async function saveRazorpay() {
    const id = toast.loading("Saving…");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razorpay_link: settings?.razorpay_link }),
      });
      if (res.ok) toast.success("Saved!", { id });
      else toast.error("Failed to save", { id });
    } catch {
      toast.error("Network error", { id });
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="h-8 w-40 animate-shimmer rounded-lg" />
        {[1, 2, 3].map((i) => <div key={i} className="h-28 animate-shimmer rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-2.5">
          <Settings size={20} className="text-slate-500" strokeWidth={1.8} />
          Settings
        </h1>
        <p className="page-subtitle mt-1">System configuration, automation controls, and academic workflows.</p>
      </div>

      {/* ── Academic Year Promotion ── */}
      <div className="card border border-gray-200 shadow-sm">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-2.5 bg-slate-100 text-slate-600 rounded-md flex-shrink-0">
            <GraduationCap size={20} strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-800">Academic Year Promotion</div>
            <div className="text-sm text-gray-500 mt-0.5">
              Promote all students to the next class at end of academic year. Students in Class 12 will be graduated.
            </div>
          </div>
        </div>

        {/* Flow indicator */}
        <div className="flex items-center gap-1.5 flex-wrap mb-5 pl-16">
          {["Class 8", "9", "10", "11", "12", "Graduated"].map((step, i, arr) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">
                {step}
              </span>
              {i < arr.length - 1 && <ArrowRight size={10} className="text-gray-300 flex-shrink-0" />}
            </span>
          ))}
        </div>

        <div className="pl-16 space-y-3">
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={promoting}
              className="btn-primary disabled:opacity-50"
            >
              <GraduationCap size={15} strokeWidth={2} />
              {promoting ? "Promoting…" : "Promote All Students"}
            </button>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle size={15} className="text-amber-500 flex-shrink-0" />
              <span className="text-sm font-medium text-amber-800 flex-1">
                This will move every student up one class. Confirm?
              </span>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => setShowConfirm(false)} className="btn-secondary text-xs !py-1.5">Cancel</button>
                <button onClick={handlePromotion} className="btn-primary text-xs !py-1.5">Confirm</button>
              </div>
            </div>
          )}

          {/* Result */}
          {promotionResult && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <CheckCircle size={14} className="text-emerald-500" />
                <span className="text-xs font-semibold text-gray-700">Promotion complete</span>
                <span className="ml-auto text-xs text-gray-500">
                  {promotionResult.promoted} promoted · {promotionResult.graduated} graduated
                </span>
              </div>
              <div className="divide-y divide-gray-100 max-h-40 overflow-y-auto">
                {promotionResult.report.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2 text-xs">
                    <span className="text-gray-700 font-medium">{r.class} {r.section ? `· ${r.section}` : ""}</span>
                    <span className={`font-semibold ${r.action === "graduated" ? "text-amber-600" : "text-emerald-600"}`}>
                      {r.action === "graduated" ? `${r.count} graduated` : `${r.count} promoted`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Payment Gateway Link ── */}
      <div className="card border border-gray-200 shadow-sm">
        <div className="flex items-start gap-4 mb-5">
          <div className="p-2.5 bg-slate-100 text-slate-600 rounded-md flex-shrink-0">
            <Send size={20} strokeWidth={1.8} />
          </div>
          <div>
            <div className="font-semibold text-gray-800">Payment Gateway Link</div>
            <div className="text-sm text-gray-500 mt-0.5">Razorpay link sent to students in fee reminder notifications.</div>
          </div>
        </div>
        <div className="pl-16 flex gap-3">
          <input
            type="url"
            placeholder="https://rzp.io/your-link"
            value={settings?.razorpay_link || ""}
            onChange={(e) => setSettings({ ...settings, razorpay_link: e.target.value })}
            className="input-field flex-1"
          />
          <button onClick={saveRazorpay} className="btn-primary whitespace-nowrap">Save</button>
        </div>
      </div>

      {/* ── Demo Data ── */}
      <div className="card border border-gray-200 shadow-sm">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-2.5 bg-slate-100 text-slate-600 rounded-md flex-shrink-0">
            <CalendarCheck size={20} strokeWidth={1.8} />
          </div>
          <div>
            <div className="font-semibold text-gray-800">System Demo Control</div>
            <div className="text-sm text-gray-500 mt-0.5">Pre-fill the system with 40 demo students across Classes 8–12.</div>
          </div>
        </div>
        <div className="pl-16">
          <button
            onClick={async () => {
              if (confirm("This will wipe existing data and seed 40 demo students. Proceed?")) {
                const id = toast.loading("Seeding demo data…");
                try {
                  const res = await fetch("/api/seed", { method: "POST" });
                  const data = await res.json();
                  if (res.ok) { toast.success("Demo data seeded!", { id }); window.location.href = "/dashboard"; }
                  else toast.error(data.error || "Seed failed", { id });
                } catch { toast.error("Network error", { id }); }
              }
            }}
            className="btn-primary"
          >
            <Layers size={15} /> Seed Demo Data
          </button>
        </div>
      </div>

      {/* ── Recycle Bin ── */}
      <div className="card border border-orange-100 bg-orange-50/20">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-2.5 bg-orange-100 text-orange-600 rounded-md flex-shrink-0">
            <AlertTriangle size={20} strokeWidth={1.8} />
          </div>
          <div>
            <div className="font-semibold text-gray-800">Recycle Bin</div>
            <div className="text-sm text-gray-500 mt-0.5">Deleted teachers, classes, and sections are kept here. Emptying the bin permanently removes them.</div>
          </div>
        </div>
        <div className="pl-16">
          <button
            onClick={async () => {
              if (confirm("Are you sure you want to permanently empty the recycle bin?")) {
                const id = toast.loading("Emptying recycle bin…");
                try {
                  const res = await fetch("/api/recycle-bin", { method: "DELETE" });
                  const data = await res.json();
                  if (res.ok) { toast.success("Recycle Bin emptied!", { id }); }
                  else toast.error(data.error || "Failed to empty bin", { id });
                } catch { toast.error("Network error", { id }); }
              }
            }}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-md shadow-sm transition-colors flex items-center gap-2"
          >
            <AlertTriangle size={13} /> Empty Recycle Bin
          </button>
        </div>
      </div>

      {/* ── Danger Zone ── */}
      <div className="card border border-red-100 bg-red-50/20">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-2.5 bg-red-100 text-red-600 rounded-md flex-shrink-0">
            <Zap size={20} strokeWidth={1.8} />
          </div>
          <div>
            <div className="font-semibold text-gray-800">Factory Reset</div>
            <div className="text-sm text-gray-500 mt-0.5">Completely wipe all data for this institute. This is irreversible.</div>
          </div>
        </div>
        <div className="pl-16">
          <button
            onClick={async () => {
              if (confirm("DANGER: Permanently delete ALL students, teachers, results, and records? This cannot be undone.")) {
                const id = toast.loading("Wiping all data…");
                try {
                  const res = await fetch("/api/factory-reset", { method: "POST" });
                  const data = await res.json();
                  if (res.ok) { toast.success("Factory Reset complete", { id }); window.location.reload(); }
                  else toast.error(data.error || "Reset failed", { id });
                } catch { toast.error("Network error", { id }); }
              }
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-md shadow-sm transition-colors flex items-center gap-2"
          >
            <Zap size={13} /> Full Factory Reset
          </button>
          <p className="text-[10px] text-red-400 mt-2 font-medium">⚠️ Warning: ALL records will be erased forever.</p>
        </div>
      </div>

      {/* ── Roadmap ── */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <Bell size={16} className="text-gray-400" strokeWidth={1.8} />
          <h3 className="font-semibold text-gray-700 text-sm">Automation Roadmap</h3>
        </div>
        <div className="space-y-2 opacity-60 pointer-events-none">
          {[
            { label: "WhatsApp Fee Reminders", tag: "Coming Soon" },
            { label: "Auto Attendance Alerts to Parents", tag: "Q3 2025" },
            { label: "AI-Powered Performance Insights", tag: "Future" },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-md">
              <span className="text-sm font-medium text-gray-700">{item.label}</span>
              <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded font-bold">{item.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
