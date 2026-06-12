"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";

export default function OnboardPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    institute_name: "",
    owner_name: "",
    phone: "",
    admin_email: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to onboard");
      }
      
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc] flex flex-col items-center justify-center p-6 relative">
      {/* Background Decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-10 right-20 w-80 h-80 bg-slate-100/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-20 w-96 h-96 bg-gray-100/20 rounded-full blur-3xl"></div>
      </div>

      <div className="absolute top-6 right-6">
        <UserButton />
      </div>

      <div className="max-w-md w-full bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-gray-200/70 p-8 relative z-10">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-md bg-slate-800 text-white flex items-center justify-center font-bold text-sm tracking-wide">
            AS
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Welcome!</h1>
            <p className="text-xs text-gray-400 font-medium">Alpha School Platform</p>
          </div>
        </div>
        
        <p className="text-gray-500 text-sm mb-6">Let's set up your institute profile to get started.</p>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200 font-medium">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Institute Name</label>
            <input type="text" required placeholder="e.g. Bright Future Academy" value={form.institute_name} onChange={(e) => setForm({ ...form, institute_name: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Your Name</label>
            <input type="text" required placeholder="e.g. Rajesh Kumar" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Phone Number</label>
            <input type="tel" required placeholder="+91 9876543210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
            <input type="email" placeholder="you@example.com" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} className="input-field" />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-6 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? "Setting up..." : (
              <>
                Complete Setup <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
