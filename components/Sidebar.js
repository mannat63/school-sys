"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, GraduationCap, BookOpen, Layers, IndianRupee, CalendarCheck, Calendar, FileText, Settings, PieChart, ChevronRight, HelpCircle, Bell, UserPlus, Trash2 } from "lucide-react";

const adminLinks = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard, badge: "icon-badge-orange" },
  { href: "/leads", label: "Leads & CRM", Icon: UserPlus, badge: "icon-badge-pink" },
  { href: "/students", label: "Students", Icon: Users, badge: "icon-badge-blue" },
  { href: "/teachers", label: "Teachers", Icon: GraduationCap, badge: "icon-badge-purple" },
  { href: "/subjects", label: "Courses & Subjects", Icon: BookOpen, badge: "icon-badge-amber" },
  { href: "/sections", label: "Classes & Sections", Icon: Layers, badge: "icon-badge-teal" },
  { href: "/timetable", label: "Timetable", Icon: Calendar, badge: "icon-badge-indigo" },
  { href: "/fees", label: "Fees", Icon: IndianRupee, badge: "icon-badge-green" },
  { href: "/attendance", label: "Attendance", Icon: CalendarCheck, badge: "icon-badge-blue" },
  { href: "/tests", label: "Tests & Results", Icon: FileText, badge: "icon-badge-purple" },
  { href: "/reports", label: "Reports", Icon: PieChart, badge: "icon-badge-orange" },
  { href: "/recycle-bin", label: "Recycle Bin", Icon: Trash2, badge: "icon-badge-red" },
  { href: "/automation", label: "Settings", Icon: Settings, badge: "icon-badge-slate" },
];

const teacherLinks = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard, badge: "icon-badge-orange" },
  { href: "/sections", label: "My Sections", Icon: Layers, badge: "icon-badge-teal" },
  { href: "/timetable", label: "Timetable", Icon: Calendar, badge: "icon-badge-indigo" },
  { href: "/attendance", label: "Attendance", Icon: CalendarCheck, badge: "icon-badge-blue" },
  { href: "/attendance-calendar", label: "Calendar", Icon: Calendar, badge: "icon-badge-purple" },
  { href: "/homework", label: "Homework", Icon: FileText, badge: "icon-badge-amber" },
  { href: "/tests", label: "Results", Icon: FileText, badge: "icon-badge-green" },
];

const studentLinks = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard, badge: "icon-badge-orange" },
  { href: "/timetable", label: "Timetable", Icon: Calendar, badge: "icon-badge-indigo" },
  { href: "/attendance", label: "Attendance", Icon: CalendarCheck, badge: "icon-badge-blue" },
  { href: "/homework", label: "Homework", Icon: FileText, badge: "icon-badge-amber" },
  { href: "/fees", label: "Fees", Icon: IndianRupee, badge: "icon-badge-green" },
  { href: "/tests", label: "Results", Icon: FileText, badge: "icon-badge-purple" },
  { href: "/reports", label: "My Report", Icon: PieChart, badge: "icon-badge-orange" },
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
    <aside 
      className="group bg-white flex flex-col m-4 rounded-[32px] transition-all duration-300 ease-in-out border border-white/50 z-50 print:hidden overflow-hidden" 
      style={{ 
        width: '80px', 
        height: 'calc(100vh - 32px)', 
        boxShadow: '0 10px 40px rgba(0,0,0,0.08), 0 2px 10px rgba(0,0,0,0.03)' 
      }}
      onMouseEnter={(e) => e.currentTarget.style.width = '240px'}
      onMouseLeave={(e) => e.currentTarget.style.width = '80px'}
    >
      {/* Brand */}
      <div className="py-6 flex-shrink-0 flex items-center px-[16px]">
        <div className="w-12 h-12 rounded-[20px] bg-white flex flex-shrink-0 items-center justify-center overflow-hidden border border-gray-100 shadow-sm">
          <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
        </div>
        <div className="flex-col ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-32 overflow-hidden whitespace-nowrap">
          <span className="block font-extrabold text-gray-900 text-[15px] leading-tight tracking-tight uppercase">Intellogy</span>
          <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-0.5">Coaching</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 flex flex-col gap-2 overflow-y-auto overflow-x-hidden no-scrollbar w-full px-[12px]">
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
              className={`flex items-center w-[216px] p-2 rounded-2xl transition-all duration-200 relative ${
                isActive
                  ? "bg-gray-900 text-white shadow-md"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}
              title={link.label}
            >
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl">
                <Icon size={20} className={isActive ? "text-white" : ""} strokeWidth={isActive ? 2 : 1.8} />
              </div>
              <span className="ml-3 font-medium text-[13px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap flex-1">
                {link.label}
              </span>
              {isActive && (
                <div className="absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <ChevronRight size={14} className="text-white/50" />
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Area */}
      <div className="pb-6 pt-2 flex-shrink-0 flex flex-col gap-2 w-full px-[12px]">
        {role !== "STUDENT" && (
          <a
            href="https://wa.me/919509728788?text=Hi"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center w-[216px] p-2 rounded-2xl text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-all duration-200"
            title="Help & Support"
          >
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl">
              <HelpCircle size={20} strokeWidth={1.8} />
            </div>
            <span className="ml-3 font-medium text-[13px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
              Help & Support
            </span>
          </a>
        )}
        
        <div className="flex items-center p-2 rounded-2xl bg-gray-50 border border-gray-100 w-[216px]">
          <div className="flex-shrink-0 w-10 h-10 rounded-[16px] bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
            {(userName || "U")[0].toUpperCase()}
          </div>
          <div className="ml-3 flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden whitespace-nowrap min-w-0">
            <div className="text-[13px] font-bold text-gray-800 truncate w-24" title={userName}>{userName}</div>
            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">{role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
