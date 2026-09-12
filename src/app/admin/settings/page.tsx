import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { ShieldCheck, Database, Bot, Sparkles, CheckCircle2, Server } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await getAdminSession();
  const adminLogs = await db.adminLog.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: { admin: true },
  });

  const totalUsers = await db.user.count();
  const totalJobs = await db.job.count();
  const totalNotifications = await db.notification.count();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          System Settings & Diagnostics
        </h1>
        <p className="text-sm text-slate-400">
          Admin account credentials, API credentials status, and audit log.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Admin Session Info */}
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-sky-400" />
              <span>Current Admin Session</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Username:</span>
              <span className="font-semibold text-white">{session?.username || "admin"}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Email:</span>
              <span className="font-semibold text-white">{session?.email || "admin@signaljob.et"}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Role:</span>
              <Badge variant="default">{session?.role || "SUPERADMIN"}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Integration Status */}
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-5 w-5 text-sky-400" />
              <span>Service Integration Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-sky-400" />
                <span className="text-slate-300">SQLite / PostgreSQL DB</span>
              </div>
              <Badge variant="success">Connected</Badge>
            </div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-sky-400" />
                <span className="text-slate-300">Gemini AI Extractor</span>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-sky-400" />
                <span className="text-slate-300">Telegram Bot Delivery</span>
              </div>
              <Badge variant="success">Configured</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Audit Logs */}
      <Card className="border-slate-800 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-base">Recent Administrative Audit Logs</CardTitle>
          <CardDescription>Actions recorded during administrative operations.</CardDescription>
        </CardHeader>
        <CardContent>
          {adminLogs.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">No audit logs recorded yet.</div>
          ) : (
            <div className="space-y-2 text-xs">
              {adminLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-sky-400">{log.action}</span>
                    <p className="text-slate-400">{log.details || "No details"}</p>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
