"use client";

import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import AdminChatbot from "./AdminChatbot";
import NotificationPanel from "./NotificationPanel";
import { UserButton } from "@clerk/nextjs";
import { Toaster } from "react-hot-toast";
import { Menu, Bell } from "lucide-react";
import { usePathname } from "next/navigation";

// Global Fetch Cache to reduce loading times across all panels
if (typeof window !== "undefined" && !window.__fetch_patched) {
  const originalFetch = window.fetch;
  const cache = new Map();
  window.fetch = async (url, options) => {
    const isGet = !options || !options.method || options.method.toUpperCase() === 'GET';
    const isApi = typeof url === 'string' && (url.startsWith('/api/') || url.includes('/api/'));
    const skipCache = typeof url === 'string' && (url.includes('/api/me') || url.includes('/api/chatbot'));

    if (isGet && isApi && !skipCache && (!options || options.cache !== 'no-store')) {
      if (cache.has(url)) {
        return new Response(new Blob([cache.get(url)]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      const res = await originalFetch(url, options);
      if (res.ok) {
        const cloned = res.clone();
        try {
          const text = await cloned.text();
          cache.set(url, text);
        } catch(e){}
      }
      return res;
    }
    
    // Invalidate cache on mutations to keep data fresh
    if (!isGet && isApi) {
      cache.clear();
    }
    
    return originalFetch(url, options);
  };
  window.__fetch_patched = true;
}

export default function DashboardLayoutClient({ children, role, userName }) {
  const pathname = usePathname();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // ALWAYS start collapsed — will open on desktop after mount
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Fetch unread count
  useEffect(() => {
    fetch('/api/notifications/unread-count')
      .then(r => r.json())
      .then(d => { if (d.unread_count) setUnreadCount(d.unread_count); })
      .catch(console.error);
  }, []);

  // After hydration, open sidebar only on desktop
  useEffect(() => {
    if (window.innerWidth >= 768) {
      setIsSidebarOpen(true);
    }
  }, []);

  const pageLabels = {
    "/dashboard": "Dashboard",
    "/students": "Students",
    "/teachers": "Teachers",
    "/courses": "Courses",
    "/sections": "Sections",
    "/fees": "Fees",
    "/attendance": "Attendance",
    "/attendance-calendar": "Calendar",
    "/tests": "Tests & Results",
    "/reports": "Reports",
    "/automation": "Settings",
  };
  const currentPageLabel = pageLabels[pathname] || "Dashboard";

  // On mobile, close sidebar when route changes
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [pathname]);

  return (
    <div className="flex h-screen bg-[#f5f6f8] overflow-hidden">
      {/* Sidebar Overlay */}
      <div 
        className={`fixed inset-0 bg-black/40 z-30 md:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`} 
        onClick={() => setIsSidebarOpen(false)} 
      />
      
      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-40 bg-white md:bg-transparent md:relative md:z-auto flex-shrink-0 transition-transform duration-300 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <Sidebar
          role={role}
          userName={userName}
          onClose={() => {
            if (typeof window !== "undefined" && window.innerWidth < 768) {
              setIsSidebarOpen(false);
            }
          }}
          onOpenNotification={() => {
            setIsNotifOpen(true);
            setIsSidebarOpen(false);
          }}
        />
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <Toaster position="top-right" toastOptions={{
          style: { borderRadius: '8px', padding: '12px 16px', fontSize: '13px', fontWeight: '500', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', color: '#1f2937' },
        }} />

        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200/80 px-4 md:px-8 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger — visible on mobile */}
            <button
              onClick={() => setIsSidebarOpen(prev => !prev)}
              className="p-2 -ml-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors md:hidden"
              aria-label="Toggle menu"
            >
              <Menu size={20} strokeWidth={2} />
            </button>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse hidden md:block" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:inline">Live Dashboard</span>
            <span className="text-sm font-bold text-gray-800 md:hidden">{currentPageLabel}</span>
          </div>
          <div className="flex items-center gap-3">
              <button
                onClick={() => setIsNotifOpen(true)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors border border-gray-200/80 relative"
              >
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse flex items-center justify-center">
                    NEW
                  </span>
                )}
                <Bell size={15} strokeWidth={2} className={unreadCount > 0 ? "text-red-500" : ""} />
                <span className={`text-[10px] font-bold uppercase tracking-wider hidden sm:inline ${unreadCount > 0 ? "text-red-600" : ""}`}>Alerts</span>
              </button>
            <div className="text-xs font-medium text-gray-400 hidden sm:block">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        <main className="flex-1 px-4 md:px-8 py-6 w-full max-w-full overflow-x-hidden overflow-y-auto">
          {children}
        </main>

        <AdminChatbot role={role} />
        <NotificationPanel isOpen={isNotifOpen} onClose={() => { setIsNotifOpen(false); setUnreadCount(0); }} />
      </div>
    </div>
  );
}
