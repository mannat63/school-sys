"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, GraduationCap, BookOpen, Layers, IndianRupee, CalendarCheck, Calendar, FileText, Settings, PieChart, ChevronRight, HelpCircle, Bell } from "lucide-react";

const adminLinks = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/students", label: "Students", Icon: Users },
  { href: "/teachers", label: "Teachers", Icon: GraduationCap },
  { href: "/subjects", label: "Subjects", Icon: BookOpen },
  { href: "/sections", label: "Classes & Sections", Icon: Layers },
  { href: "/timetable", label: "Timetable", Icon: Calendar },
  { href: "/fees", label: "Fees", Icon: IndianRupee },
  { href: "/attendance", label: "Attendance", Icon: CalendarCheck },
  { href: "/tests", label: "Tests & Results", Icon: FileText },
  { href: "/reports", label: "Reports", Icon: PieChart },
  { href: "/automation", label: "Settings", Icon: Settings },
];

const teacherLinks = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/sections", label: "My Sections", Icon: Layers },
  { href: "/timetable", label: "Timetable", Icon: Calendar },
  { href: "/attendance", label: "Attendance", Icon: CalendarCheck },
  { href: "/attendance-calendar", label: "Calendar", Icon: Calendar },
  { href: "/homework", label: "Homework", Icon: FileText },
  { href: "/tests", label: "Results", Icon: FileText },
];

const studentLinks = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/timetable", label: "Timetable", Icon: Calendar },
  { href: "/attendance", label: "Attendance", Icon: CalendarCheck },
  { href: "/homework", label: "Homework", Icon: FileText },
  { href: "/fees", label: "Fees", Icon: IndianRupee },
  { href: "/tests", label: "Results", Icon: FileText },
  { href: "/reports", label: "My Report", Icon: PieChart },
];

const roleLinksMap = {
  ADMIN: adminLinks,
  TEACHER: teacherLinks,
  STUDENT: studentLinks,
};

export default function Sidebar({ role, userName, onClose, onOpenNotification }) {
  const pathname = usePathname();
  const links = roleLinksMap[role] || studentLinks;

  return (
    <aside className="w-[240px] bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 z-10 print:hidden">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm overflow-hidden border border-gray-100">
            <img src="/logo.png" alt="Alpha School" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-[#111827] text-[15px] leading-tight tracking-tight">Alpha School</span>
            <span className="text-[9px] font-bold text-[#6B7280] uppercase tracking-[0.2em] mt-0.5">Academic Excellence</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">Navigation</div>
        {links.map((link) => {
          const isActive = pathname === link.href;
          const { Icon } = link;
          
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={(e) => {
                if (link.href === "#notifications") {
                  e.preventDefault();
                  if (onOpenNotification) onOpenNotification();
                }
                if (onClose) onClose();
              }}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-all duration-150 group relative ${
                isActive
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-slate-800 rounded-r-sm" />
              )}
              <Icon size={16} className={isActive ? "text-slate-700" : "text-gray-400 group-hover:text-gray-600"} strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="flex-1">{link.label}</span>
              {isActive && <ChevronRight size={13} className="text-slate-400" />}
            </Link>
          );
        })}
      </nav>

      {/* Help */}
      {role !== "STUDENT" && (
        <div className="px-3 pb-2 flex-shrink-0">
          <a
            href="https://wa.me/919509728788?text=Hi%2C%20I%20need%20help%20with%20Alpha%20Coaching%20System"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium text-gray-400 hover:text-[#1e3a5f] hover:bg-blue-50/50 transition-all duration-150"
          >
            <HelpCircle size={16} strokeWidth={1.8} />
            <span>Help & Support</span>
          </a>
        </div>
      )}

      {/* User Info */}
      <div className="p-3 border-t border-gray-100 flex-shrink-0">
        <div className="bg-gray-50 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
              {(userName || "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-800 truncate" title={userName}>{userName}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{role}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
