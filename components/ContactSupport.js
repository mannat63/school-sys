"use client";

import { useState } from "react";
import { MessageCircle, X, Phone, Mail, Send } from "lucide-react";

export default function ContactSupport() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 z-50 w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-105 border ${
          open
            ? "bg-gray-800 text-white border-gray-700"
            : "bg-[#1e3a5f] text-white border-[#162d4a]"
        }`}
        aria-label="Help Center"
      >
        {open ? <X size={18} /> : <MessageCircle size={18} />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-slideUp">
          {/* Header */}
          <div className="bg-[#1e3a5f] px-5 py-4">
            <h3 className="text-white font-bold text-base">Help Center</h3>
            <p className="text-[#94a3b8] text-xs mt-0.5">Reach us on WhatsApp, call or email</p>
          </div>

          {/* Options */}
          <div className="p-4 space-y-3">
            <a
              href="https://wa.me/919509728788?text=Hi%2C%20I%20need%20help%20with%20Alpha%20School%20System"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100 hover:border-emerald-200 hover:shadow-sm transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <Send size={18} />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">WhatsApp Support</div>
                <div className="text-[11px] text-gray-500">Chat with us instantly</div>
              </div>
            </a>

            <a
              href="tel:+919509728788"
              className="flex items-center gap-3 p-3 rounded-xl bg-sky-50 border border-sky-100 hover:border-sky-200 hover:shadow-sm transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-[#1e3a5f] text-white flex items-center justify-center shrink-0">
                <Phone size={18} />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900 group-hover:text-sky-700 transition-colors">Call Us</div>
                <div className="text-[11px] text-gray-500">+91 95097 28788</div>
              </div>
            </a>

            <a
              href="mailto:support@alphaschool.in"
              className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 border border-violet-100 hover:border-violet-200 hover:shadow-sm transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-violet-500 text-white flex items-center justify-center shrink-0">
                <Mail size={18} />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900 group-hover:text-violet-700 transition-colors">Email Us</div>
                <div className="text-[11px] text-gray-500">support@alphaschool.in</div>
              </div>
            </a>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 text-center font-medium">Alpha School • Institute Management System</p>
          </div>
        </div>
      )}
    </>
  );
}
