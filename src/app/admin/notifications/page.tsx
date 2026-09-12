"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RotateCw, 
  Users, 
  Briefcase, 
  Filter, 
  ArrowRight,
  ShieldAlert,
  X
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

interface NotificationItem {
  id: string;
  userId: string;
  jobId: string;
  matchScore: number | null;
  matchReasons: string | null;
  status: "PENDING" | "SENT" | "FAILED";
  retryCount: number;
  sentAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  user: {
    telegramId: string;
    telegramUsername: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  job: {
    id: string;
    title: string;
    company: string | null;
    category: string | null;
    location: string | null;
  };
}

interface NotificationStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [stats, setStats] = useState<NotificationStats>({ total: 0, sent: 0, failed: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/admin/notifications", window.location.origin);
      if (statusFilter !== "ALL") url.searchParams.set("status", statusFilter);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", "15");

      const res = await fetch(url.toString());
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to load notifications");
      setNotifications(data.notifications || []);
      setStats(data.stats || { total: 0, sent: 0, failed: 0, pending: 0 });
      setTotalPages(data.totalPages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [statusFilter, page]);

  const handleRetryFailed = async () => {
    setRetrying(true);
    setError(null);
    setActionSuccess(null);
    try {
      const res = await fetch("/api/admin/notifications/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxRetries: 3 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to retry notifications");

      setActionSuccess(
        `Retry complete: ${data.result.totalSent} sent, ${data.result.totalFailed} still failing out of ${data.result.totalProcessed} processed.`
      );
      fetchNotifications();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error retrying failed notifications");
    } finally {
      setRetrying(false);
    }
  };

  const parseReasons = (jsonStr: string | null): string[] => {
    if (!jsonStr) return [];
    try {
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Telegram Notification Dispatcher
          </h1>
          <p className="text-sm text-slate-400">
            Monitor match alerts, delivery statuses, error reports, and retry queues.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={handleRetryFailed}
            disabled={retrying || stats.failed === 0}
            className="gap-2"
          >
            <RotateCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
            <span>{retrying ? "Retrying..." : `Retry Failed (${stats.failed})`}</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Total Alerts Generated</span>
            <Badge variant="secondary">All Time</Badge>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-extrabold text-white">{stats.total}</div>
            <div className="p-2 rounded-lg bg-slate-800 text-sky-400">
              <Send className="h-4 w-4" />
            </div>
          </div>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-950/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-emerald-400">Successfully Sent</span>
            <Badge variant="success">Delivered</Badge>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-extrabold text-emerald-400">{stats.sent}</div>
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
        </Card>

        <Card className="border-amber-500/20 bg-amber-950/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-amber-400">Pending Dispatch</span>
            <Badge variant="warning">In Queue</Badge>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-extrabold text-amber-400">{stats.pending}</div>
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
        </Card>

        <Card className="border-rose-500/20 bg-rose-950/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-rose-400">Failed / Blocked</span>
            <Badge variant="destructive">Errors</Badge>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-extrabold text-rose-400">{stats.failed}</div>
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
        </Card>
      </div>

      {actionSuccess && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-400/80 hover:text-emerald-200 transition-colors p-1"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400/80 hover:text-red-200 transition-colors p-1"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 w-fit">
        {["ALL", "SENT", "PENDING", "FAILED"].map((st) => (
          <button
            key={st}
            onClick={() => {
              setStatusFilter(st);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              statusFilter === st
                ? "bg-sky-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Notifications Table */}
      <Card className="border-slate-800 bg-slate-900/70 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading notifications log...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Send className="h-10 w-10 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-sm font-medium">No notification records found.</p>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">
              When jobs are published, notifications generated and sent to matching Telegram subscribers will be listed here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Job Posting</th>
                  <th className="py-3 px-4">Match Details</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Retries</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {notifications.map((n) => {
                  const reasons = parseReasons(n.matchReasons);
                  return (
                    <tr key={n.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">
                          {n.user?.firstName || "Telegram User"} {n.user?.lastName || ""}
                        </div>
                        <div className="text-[11px] text-sky-400">
                          {n.user?.telegramUsername ? `@${n.user.telegramUsername}` : `ID: ${n.user?.telegramId}`}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-white line-clamp-1">{n.job?.title}</div>
                        <div className="text-[11px] text-slate-400">
                          {n.job?.company || "Unspecified"} • {n.job?.location || "Addis Ababa"}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sky-400">{n.matchScore ?? 0}%</span>
                          <span className="text-slate-500">score</span>
                        </div>
                        {reasons.length > 0 && (
                          <div className="text-[10px] text-slate-400 line-clamp-1">
                            {reasons.slice(0, 2).join(" • ")}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {n.status === "SENT" && <Badge variant="success">SENT</Badge>}
                        {n.status === "PENDING" && <Badge variant="warning">PENDING</Badge>}
                        {n.status === "FAILED" && (
                          <div>
                            <Badge variant="destructive">FAILED</Badge>
                            {n.errorMessage && (
                              <div className="text-[10px] text-red-400 mt-1 max-w-xs truncate" title={n.errorMessage}>
                                {n.errorMessage}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono">
                        {n.retryCount}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {n.sentAt ? formatDate(n.sentAt) : formatDate(n.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950/40 text-xs">
            <span className="text-slate-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
