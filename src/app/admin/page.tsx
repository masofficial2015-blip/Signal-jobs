import Link from "next/link";
import { db } from "@/lib/db";
import { 
  PlusCircle, 
  Users, 
  Send, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  Bookmark, 
  Activity
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    activeUsers,
    publishedJobs,
    jobsToday,
    notificationsSent,
    notificationsFailed,
    notificationsPending,
    totalSavedJobs,
    recentJobs,
    recentInteractions,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { isActive: true, notificationsPaused: false } }),
    db.job.count({ where: { status: "PUBLISHED" } }),
    db.job.count({ where: { createdAt: { gte: todayStart } } }),
    db.notification.count({ where: { status: "SENT" } }),
    db.notification.count({ where: { status: "FAILED" } }),
    db.notification.count({ where: { status: "PENDING" } }),
    db.savedJob.count(),
    db.job.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
    }),
    db.userJobInteraction.findMany({
      take: 6,
      include: { user: true, job: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const kpis = [
    {
      title: "Telegram Subscribers",
      value: String(totalUsers),
      subtext: `${activeUsers} active / receiving alerts`,
      icon: Users,
      badge: "Audience",
      color: "text-sky-400",
      bg: "bg-sky-500/10",
      border: "border-sky-500/20",
    },
    {
      title: "Live Published Jobs",
      value: String(publishedJobs),
      subtext: `${jobsToday} posted today`,
      icon: CheckCircle2,
      badge: "Live Listings",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      title: "Delivered Alerts",
      value: String(notificationsSent),
      subtext: `${notificationsFailed} failed • ${notificationsPending} queued`,
      icon: Send,
      badge: "Dispatched",
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20",
    },
    {
      title: "Bookmarks & Saved",
      value: String(totalSavedJobs),
      subtext: "User saved opportunities",
      icon: Bookmark,
      badge: "Engagement",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-5 w-5 text-sky-400" />
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Signal Admin Control Center
            </h1>
            <Badge variant="default">Ethiopian Job Matcher</Badge>
          </div>
          <p className="text-sm text-slate-400">
            Job Ingestion, Deterministic Match Engine, Telegram Alerts & User Analytics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/admin/jobs/new">
            <Button variant="primary" className="gap-2 shadow-lg shadow-sky-500/20">
              <PlusCircle className="h-4 w-4" />
              <span>Ingest New Job</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <Card key={i} className={`border ${kpi.border} bg-slate-900/60`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-400">{kpi.title}</span>
                <Badge variant="secondary" className="text-[10px]">{kpi.badge}</Badge>
              </div>
              <div className="flex items-baseline justify-between">
                <div className={`text-3xl font-extrabold ${kpi.color}`}>{kpi.value}</div>
                <div className={`p-2 rounded-lg ${kpi.bg} ${kpi.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">{kpi.subtext}</p>
            </Card>
          );
        })}
      </div>

      {/* Manual Ingestion Quickstart Banner */}
      <Card className="border-sky-500/20 bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sky-400 text-sm font-semibold">
              <Sparkles className="h-4 w-4" />
              <span>AI Job Ingestion & Broadcast Workflow</span>
            </div>
            <Link href="/admin/jobs/new">
              <Button variant="primary" size="sm" className="gap-1.5 text-xs">
                <span>Start Ingestion</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          <CardTitle className="text-xl">Fast Job Collection to Telegram Delivery</CardTitle>
          <CardDescription>
            Copy Ethiopian job posts from Telegram channels or websites → Paste in admin → Gemini extracts structured data → Review & Publish → Instant matching Telegram notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 text-xs">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
              <span className="font-bold text-sky-400">1</span>
              <span>Copy Raw Post</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
              <span className="font-bold text-sky-400">2</span>
              <span>Paste & AI Extract</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
              <span className="font-bold text-sky-400">3</span>
              <span>Review Details</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-300 font-semibold">
              <span className="font-bold">4</span>
              <span>Publish & Alert</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Jobs Listings (2 cols on lg) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-800 bg-slate-900/70">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Recent Ethiopian Job Listings</CardTitle>
                  <CardDescription>Latest published vacancies.</CardDescription>
                </div>
                <Link href="/admin/jobs" className="text-xs text-sky-400 hover:underline flex items-center gap-1">
                  <span>View Directory ({publishedJobs})</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentJobs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
                  No jobs created yet. Click "Ingest New Job" above to paste your first Ethiopian listing.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60 text-xs">
                  {recentJobs.map((j) => (
                    <div key={j.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-white">
                          {j.title}
                        </span>
                        <div className="text-slate-400 text-[11px]">
                          {j.company || "Unspecified"} • {j.location || "Addis Ababa"} • {j.category || "General"}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="success">PUBLISHED</Badge>
                        <span className="text-slate-500 text-[10px] hidden sm:inline">
                          {formatDate(j.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live Interaction & Notification Activity (1 col on lg) */}
        <div className="space-y-6">
          <Card className="border-slate-800 bg-slate-900/70">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-sky-400" />
                    <span>Recent Interactions</span>
                  </CardTitle>
                  <CardDescription>User activity events on Telegram.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {recentInteractions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No user interaction events recorded yet.
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {recentInteractions.map((act) => (
                    <div key={act.id} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-[10px]">
                          {act.action.replace("JOB_", "").replace("_", " ")}
                        </Badge>
                        <span className="text-[10px] text-slate-500">
                          {formatDate(act.createdAt)}
                        </span>
                      </div>
                      <div className="text-white text-[11px] truncate">
                        {act.user.firstName || "Seeker"} {act.user.lastName || ""}
                        {act.job ? ` • ${act.job.title}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/70">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4 text-sky-400" />
                <span>Notification Center</span>
              </CardTitle>
              <CardDescription>Telegram notification status summary.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-emerald-400 font-medium">
                <span>Delivered Successfully</span>
                <span className="font-bold">{notificationsSent}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-rose-950/20 border border-rose-500/20 text-rose-400 font-medium">
                <span>Failed / Blocked</span>
                <span className="font-bold">{notificationsFailed}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-amber-950/20 border border-amber-500/20 text-amber-400 font-medium">
                <span>Pending in Queue</span>
                <span className="font-bold">{notificationsPending}</span>
              </div>
              <Link href="/admin/notifications" className="block pt-2">
                <Button variant="outline" size="sm" className="w-full text-xs gap-1.5">
                  <span>Open Notification Dispatcher</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
