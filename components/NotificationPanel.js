"use client";

import { useState, useEffect } from "react";
import { MessageSquare, X, Bell, Calendar, IndianRupee, FileText, CheckCircle } from "lucide-react";

export default function NotificationPanel({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  async function fetchNotifications() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        setNotifications(await res.json());
      }
      await fetch("/api/notifications/read", { method: "POST" });
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/40 z-[60] transition-opacity ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <div 
        className={`fixed top-0 right-0 bottom-0 w-80 sm:w-96 bg-white shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50 relative">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-slate-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Sent Alerts Log</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-md transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-24 animate-shimmer rounded-xl bg-gray-100" />)}
            </div>
          ) : notifications.length === 0 ? (
             <div className="py-10 text-center opacity-50 flex flex-col items-center">
                 <Bell size={24} className="text-gray-400 mb-2"/>
                 <p className="text-sm text-gray-500 font-medium">No alerts sent yet.</p>
             </div>
          ) : (
            notifications.map((n) => {
              const iconMap = {
                "FEE_REMINDER": <IndianRupee size={14} className="text-amber-600" />,
                "ATTENDANCE_ALERT": <Calendar size={14} className="text-red-600" />,
                "REPORT_CARD": <FileText size={14} className="text-blue-600" />,
                "TEST_RESULT_ALERT": <CheckCircle size={14} className="text-purple-600" />,
              };
              const bgMap = {
                "FEE_REMINDER": "bg-amber-50 border-amber-100",
                "ATTENDANCE_ALERT": "bg-red-50 border-red-100",
                "REPORT_CARD": "bg-blue-50 border-blue-100",
                "TEST_RESULT_ALERT": "bg-purple-50 border-purple-100",
              };

              return (
                <div key={n._id} className={`p-3 rounded-lg border ${bgMap[n.type] || "bg-gray-50 border-gray-100"}`}>
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-black/5">
                     <span className="p-1.5 bg-white rounded-md shadow-sm">
                       {iconMap[n.type] || <Bell size={14} className="text-gray-600"/>}
                     </span>
                     <div className="flex-1 min-w-0 flex items-center gap-2">
                       <h4 className="text-xs font-bold text-gray-800 truncate">{n.recipient_name}</h4>
                       {!n.is_read && (
                         <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm shadow-sm leading-none">
                           NEW
                         </span>
                       )}
                     </div>
                     <div className="text-[10px] text-gray-400 font-medium whitespace-nowrap flex flex-col items-end">
                       <span>{new Date(n.created_at).toLocaleDateString()}</span>
                       <span className="font-mono text-[9px] opacity-70 mt-0.5">{n.recipient_phone}</span>
                     </div>
                  </div>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed mb-2">
                    {n.message}
                  </p>
                  {(() => {
                    const isFee = n.type === 'FEE_REMINDER';
                    const isAcademic = n.type === 'TEST_RESULT_ALERT' || n.type === 'ATTENDANCE_ALERT' || n.type === 'REPORT_CARD';
                    if (!isFee && !isAcademic) return null;
                    return (
                      <div className="mt-2 pt-2 border-t border-black/5 flex justify-end">
                        {isFee && (
                          <a 
                            href={n.action_link || "/fees"}
                            target={n.action_link ? "_blank" : "_self"}
                            rel="noopener noreferrer"
                            className="text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded flex items-center gap-1 transition-all shadow-sm bg-slate-800 hover:bg-slate-900 text-white"
                          >
                            Pay Now
                          </a>
                        )}
                        {isAcademic && (
                          <a 
                            href="https://wa.me/919509728788?text=I%20want%20to%20report%20an%20issue%20with%20my%20records"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded flex items-center gap-1 transition-all border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          >
                            Report Issue
                          </a>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

