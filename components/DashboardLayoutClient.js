"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "./Sidebar";
import AdminChatbot from "./AdminChatbot";
import NotificationPanel from "./NotificationPanel";
import { SignOutButton } from "@clerk/nextjs";
import { Toaster } from "react-hot-toast";
import { Menu, Bell, User, Settings, LogOut } from "lucide-react";
import Link from "next/link";
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

function AvatarDropdown({ userName, role }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const initial = (userName || "U")[0].toUpperCase();
  const colors = ["bg-indigo-600", "bg-violet-600", "bg-blue-600", "bg-teal-600", "bg-rose-600", "bg-amber-600", "bg-slate-700"];
  const bg = colors[(userName?.charCodeAt(0) || 0) % colors.length];

  useEffect(() => {
    function click(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)} className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 hover:opacity-90 transition-opacity shadow-sm`}>
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-10 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-900 truncate">{userName}</p>
            <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider mt-0.5">{role}</p>
          </div>
          <Link href="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
            <User size={14} className="text-gray-400" /> My Profile
          </Link>
          <Link href="/automation" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
            <Settings size={14} className="text-gray-400" /> Settings
          </Link>
          <div className="border-t border-gray-100 mt-1 pt-1">
            <SignOutButton redirectUrl="/">
              <button className="flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left">
                <LogOut size={14} /> Sign Out
              </button>
            </SignOutButton>
          </div>
        </div>
      )}
    </div>
  );
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
    "/recycle-bin": "Recycle Bin",
    "/automation": "Settings",
    "/homework": "Homework",
    "/leads": "Leads & CRM",
    "/timetable": "Timetable",
    "/subjects": "Courses & Subjects",
    "/profile": "Profile",
  };
  const getDashboardLabel = () => {
    if (pathname === "/dashboard") {
      if (role === "ADMIN" || role === "DIRECTOR") return "Director Dashboard";
      if (role === "TEACHER") return "Faculty Dashboard";
      if (role === "STUDENT") return "My Dashboard";
      return "Dashboard";
    }
    return pageLabels[pathname] || "Dashboard";
  };
  const currentPageLabel = getDashboardLabel();

  // On mobile, close sidebar when route changes
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [pathname]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-transparent">
      {/* Sidebar Overlay */}
      <div 
        className={`fixed inset-0 bg-black/40 z-30 md:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`} 
        onClick={() => setIsSidebarOpen(false)} 
      />
      
      {/* Sidebar Spacer for desktop to prevent content from going under the collapsed sidebar */}
      <div className="hidden md:block w-[112px] flex-shrink-0" />
      
      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-40 bg-transparent flex-shrink-0 transition-transform duration-300 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
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
          style: { borderRadius: '14px', padding: '12px 18px', fontSize: '13px', fontWeight: '500', border: '1px solid #eae8e4', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', color: '#1a1a1a' },
        }} />

        <header className="sticky top-0 z-20 bg-transparent px-6 md:px-10 py-5 flex items-center justify-between flex-shrink-0 pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
            {/* Hamburger — visible on mobile */}
            <button
              onClick={() => setIsSidebarOpen(prev => !prev)}
              className="p-2 -ml-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors md:hidden"
              aria-label="Toggle menu"
            >
              <Menu size={20} strokeWidth={2} />
            </button>
            <h1 className="text-3xl md:text-[32px] leading-none font-extrabold text-gray-900 tracking-tight">{currentPageLabel}</h1>
          </div>
          <div className="flex items-center gap-4 pointer-events-auto">
              <button
                onClick={() => setIsNotifOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-500 transition-all duration-200 border border-gray-100 relative"
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
            <AvatarDropdown userName={userName} role={role} />
          </div>
        </header>

        <main className="flex-1 px-4 md:px-10 py-2 w-full max-w-full overflow-x-hidden overflow-y-auto bg-transparent">
          {children}
        </main>

        <AdminChatbot role={role} />
        <NotificationPanel isOpen={isNotifOpen} onClose={() => { setIsNotifOpen(false); setUnreadCount(0); }} />
      </div>
    </div>
  );
}
