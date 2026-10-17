"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Inbox,
  RefreshCw,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Edit3,
  Calendar,
  Building2,
  MapPin,
  Sparkles,
  AlertCircle,
  Radio,
  ArrowRight,
  PlusCircle,
  X,
  Layers,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { TAXONOMY, formatCategoryLabels } from "@/lib/constants";

interface ScrapedDraftJob {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  category: string | null;
  profession: string | null;
  employmentType: string | null;
  experienceLevel: string | null;
  education: string | null;
  deadline: string | null;
  summary: string | null;
  description: string | null;
  applicationUrl: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  createdAt: string;
}

interface IngestionSummary {
  completedAt: string;
  channelsScanned: number;
  postsExamined: number;
  newDraftsCreated: number;
  duplicatesSkipped: number;
  channelResults: {
    channel: string;
    postsFound: number;
    draftsCreated: number;
    duplicates: number;
    error?: string;
  }[];
}

export default function AdminScraperInboxPage() {
  const [drafts, setDrafts] = useState<ScrapedDraftJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncSummary, setSyncSummary] = useState<IngestionSummary | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [channelFilter, setChannelFilter] = useState<string>("ALL");

  // Edit Modal State
  const [editingJob, setEditingJob] = useState<ScrapedDraftJob | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    company: string;
    location: string;
    deadline: string;
    education: string;
  }>({
    title: "",
    company: "",
    location: "",
    deadline: "",
    education: "",
  });

  const fetchDrafts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/jobs?status=DRAFT&limit=50");
      const data = await res.json();
      if (res.ok) {
        setDrafts(data.jobs || []);
      }
    } catch (err) {
      console.error("Failed to fetch drafts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, []);

  const handleSyncChannels = async () => {
    setSyncing(true);
    setNotification(null);
    setSyncSummary(null);

    try {
      const res = await fetch("/api/admin/scraper/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 6 }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Scraper execution failed");
      }

      setSyncSummary(data.summary);
      setNotification({
        type: "success",
        message: `Sync complete! Scanned ${data.summary.postsExamined} posts, created ${data.summary.newDraftsCreated} new drafts.`,
      });
      await fetchDrafts();
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Failed to sync channels",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handlePublishJob = async (job: ScrapedDraftJob) => {
    setPublishingId(job.id);
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}/publish`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to publish job");
      }

      setNotification({
        type: "success",
        message: `Published "${job.title}"! Notifications are dispatching to matched Telegram subscribers.`,
      });

      // Remove from local drafts state
      setDrafts((prev) => prev.filter((d) => d.id !== job.id));
    } catch (err: any) {
      alert(err.message || "Failed to publish job");
    } finally {
      setPublishingId(null);
    }
  };

  const handleDeleteDraft = async (id: string, title: string) => {
    if (!confirm(`Dismiss & delete "${title}"?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/jobs/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDrafts((prev) => prev.filter((d) => d.id !== id));
      }
    } catch (err) {
      alert("Failed to delete draft");
    } finally {
      setDeletingId(null);
    }
  };

  const openEditModal = (job: ScrapedDraftJob) => {
    setEditingJob(job);
    setEditForm({
      title: job.title || "",
      company: job.company || "",
      location: job.location || "",
      deadline: job.deadline ? job.deadline.slice(0, 10) : "",
      education: job.education || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingJob) return;
    try {
      const res = await fetch(`/api/admin/jobs/${editingJob.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          company: editForm.company || null,
          location: editForm.location || null,
          deadline: editForm.deadline ? new Date(editForm.deadline) : null,
          education: editForm.education || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to update draft");

      setDrafts((prev) =>
        prev.map((d) =>
          d.id === editingJob.id
            ? {
                ...d,
                title: editForm.title,
                company: editForm.company || null,
                location: editForm.location || null,
                deadline: editForm.deadline || null,
                education: editForm.education || null,
              }
            : d
        )
      );

      setEditingJob(null);
    } catch (err: any) {
      alert(err.message || "Failed to update draft");
    }
  };

  // Filter drafts by source channel
  const filteredDrafts =
    channelFilter === "ALL"
      ? drafts
      : drafts.filter((d) =>
          d.sourceName?.toLowerCase().includes(channelFilter.toLowerCase())
        );

  const availableChannels = Array.from(
    new Set(drafts.map((d) => d.sourceName).filter(Boolean))
  ) as string[];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-lg shadow-sky-500/20">
              <Inbox className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl flex items-center gap-2">
                Scraper Ingestion Inbox
                <Badge variant="outline" className="border-sky-500/40 text-sky-400 text-xs px-2 py-0.5">
                  1-Click Review
                </Badge>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically monitors Ethiopian Telegram channels, enriches website links, and prepares normalized drafts for instant approval.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            id="sync-channels-btn"
            onClick={handleSyncChannels}
            disabled={syncing}
            className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-medium shadow-md shadow-sky-500/20 flex items-center gap-2 h-9 px-4"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Scanning Channels..." : "Sync Channels Now"}</span>
          </Button>

          <Link href="/admin/jobs/new">
            <Button variant="outline" size="sm" className="border-slate-800 hover:bg-slate-800 text-slate-300 h-9">
              <PlusCircle className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
              Manual Paste
            </Button>
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
            notification.type === "success"
              ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
              : "bg-rose-950/40 border-rose-800/60 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Sync Summary Details Modal / Collapsible */}
      {syncSummary && (
        <Card className="border-slate-800 bg-slate-900/60 p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-sky-400" />
              Latest Channel Scan Breakdown
            </span>
            <span className="text-[11px] text-slate-400">
              {new Date(syncSummary.completedAt).toLocaleTimeString()}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {syncSummary.channelResults.map((r, idx) => (
              <div key={idx} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/70 space-y-1">
                <div className="font-semibold text-slate-200 truncate">{r.channel}</div>
                <div className="text-[11px] text-slate-400 flex justify-between">
                  <span>Found: {r.postsFound}</span>
                  <span className="text-emerald-400 font-medium">+{r.draftsCreated} drafts</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Control Bar: Filter by Channel & Count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/40 border border-slate-800/80 p-3 rounded-xl">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Source Channel:</span>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="h-8 rounded-lg border border-slate-800 bg-slate-950 px-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="ALL">All Sources ({drafts.length})</option>
            {availableChannels.map((ch) => (
              <option key={ch} value={ch}>
                {ch} ({drafts.filter((d) => d.sourceName === ch).length})
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-400">
          Showing <span className="font-semibold text-sky-400">{filteredDrafts.length}</span> pending drafts
        </div>
      </div>

      {/* Drafts List / Cards Feed */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-sky-400" />
          <p className="text-xs text-slate-400">Loading pending scraped job drafts...</p>
        </div>
      ) : filteredDrafts.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/30 p-12 text-center rounded-2xl border-dashed">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-sky-400 border border-slate-800 shadow-inner mb-4">
            <CheckCircle2 className="h-7 w-7 text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold text-white">Inbox Zero!</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-6">
            All scraped jobs have been reviewed and published. Click the button below to check monitored Telegram channels for new vacancy posts.
          </p>
          <Button
            onClick={handleSyncChannels}
            disabled={syncing}
            className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Scanning..." : "Check Channels Now"}</span>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDrafts.map((job) => {
            const isPublishing = publishingId === job.id;
            const isDeleting = deletingId === job.id;

            return (
              <Card
                key={job.id}
                className="border-slate-800/90 bg-slate-900/70 hover:bg-slate-900 hover:border-slate-700/80 transition-all p-5 rounded-2xl shadow-sm relative overflow-hidden group"
              >
                {/* Source channel tag ribbon */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-sky-950/40 text-sky-400 border-sky-800/50 text-[11px] font-semibold py-0.5">
                      <Radio className="h-2.5 w-2.5 mr-1 animate-pulse text-sky-400" />
                      {job.sourceName || "Telegram Channel"}
                    </Badge>
                    <span className="text-[11px] text-slate-400">
                      Scraped {formatDate(job.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {job.sourceUrl && (
                      <a
                        href={job.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-slate-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
                      >
                        <span>Original Post</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <Badge variant="outline" className="bg-amber-950/30 text-amber-300 border-amber-800/40 text-[10px]">
                      DRAFT PENDING
                    </Badge>
                  </div>
                </div>

                {/* Main Job Information */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                  <div className="md:col-span-3 space-y-2">
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight group-hover:text-sky-300 transition-colors">
                        {job.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                        {job.company && (
                          <span className="flex items-center gap-1 font-medium text-slate-300">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            {job.company}
                          </span>
                        )}
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            {job.location}
                          </span>
                        )}
                        {job.deadline && (
                          <span className="flex items-center gap-1 font-medium text-amber-400/90">
                            <Calendar className="h-3.5 w-3.5 text-amber-400" />
                            Deadline: {formatDate(job.deadline)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Taxonomy Category Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {formatCategoryLabels(job.category)
                        .split(", ")
                        .filter(Boolean)
                        .map((label: string, idx: number) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800/80 text-sky-300 border border-slate-700/60"
                          >
                            {label}
                          </span>
                        ))}

                      {job.education && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800/60 text-slate-300 border border-slate-700/40">
                          🎓 {job.education}
                        </span>
                      )}
                    </div>

                    {/* Summary / Description */}
                    {job.summary && (
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed pt-1">
                        {job.summary}
                      </p>
                    )}
                  </div>

                  {/* Actions Column (1-Click Approve, Edit, Reject) */}
                  <div className="md:col-span-1 flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                    <Button
                      id={`approve-job-${job.id}`}
                      onClick={() => handlePublishJob(job)}
                      disabled={isPublishing || isDeleting}
                      className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs h-9 shadow-md shadow-emerald-950 flex items-center justify-center gap-1.5"
                    >
                      {isPublishing ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Publishing...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Approve & Broadcast</span>
                        </>
                      )}
                    </Button>

                    <div className="flex items-center gap-1.5 w-full">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(job)}
                        className="flex-1 border-slate-800 hover:bg-slate-800 text-slate-300 h-8 text-[11px]"
                      >
                        <Edit3 className="h-3 w-3 mr-1 text-slate-400" />
                        Edit
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteDraft(job.id, job.title)}
                        disabled={isDeleting}
                        className="border-slate-800 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-900 text-slate-400 h-8 px-2.5"
                        title="Dismiss & Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Quick Edit Modal */}
      {editingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-sky-400" />
                Quick Edit Draft
              </h3>
              <button onClick={() => setEditingJob(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Job Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Company</label>
                  <input
                    type="text"
                    value={editForm.company}
                    onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Location</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Application Deadline</label>
                  <input
                    type="date"
                    value={editForm.deadline}
                    onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Education / Degree</label>
                  <input
                    type="text"
                    value={editForm.education}
                    onChange={(e) => setEditForm({ ...editForm, education: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingJob(null)}
                className="border-slate-800 text-slate-300 h-8"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold h-8"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
