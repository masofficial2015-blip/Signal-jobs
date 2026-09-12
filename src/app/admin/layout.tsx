"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  PlusCircle, 
  Briefcase, 
  Users, 
  Settings, 
  LogOut, 
  Radio, 
  ChevronRight,
  ShieldCheck,
  Send
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // If on login page, render without sidebar layout
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const navItems = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Ingest New Job", href: "/admin/jobs/new", icon: PlusCircle, highlight: true },
    { label: "Jobs Manager", href: "/admin/jobs", icon: Briefcase },
    { label: "Telegram Users", href: "/admin/users", icon: Users },
    { label: "Notifications", href: "/admin/notifications", icon: Send },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950 text-slate-100">
      {/* Admin Sidebar */}
      <aside className="w-full md:w-64 border-r border-slate-800 bg-slate-900/60 backdrop-blur-md flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20">
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <span className="text-base font-bold text-white tracking-tight">Signal Admin</span>
              <div className="flex items-center gap-1 text-[10px] font-semibold text-sky-400">
                <ShieldCheck className="h-3 w-3" />
                <span>ETHIOPIA MVP</span>
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sky-500/10 text-sky-400 border border-sky-500/30"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white",
                  item.highlight && !isActive && "text-sky-300 font-semibold bg-sky-500/5 hover:bg-sky-500/10"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn("h-4 w-4", isActive ? "text-sky-400" : item.highlight ? "text-sky-400" : "text-slate-400")} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="h-4 w-4 text-sky-400" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-lg px-3.5 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Admin Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
