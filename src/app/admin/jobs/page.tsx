"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  PlusCircle, 
  Search, 
  Trash2, 
  FileText, 
  MapPin, 
  AlertCircle,
  CheckCircle2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { JOB_CATEGORIES } from "@/lib/constants";

interface JobItem {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  category: string | null;
  experienceLevel: string | null;
  employmentType: string | null;
  status: "DRAFT" | "PUBLISHED" | "EXPIRED" | "REJECTED";
  deadline: string | null;
  publishedAt: string | null;
  createdAt: string;
  sourceUrl: string | null;
}

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Debounce search query for live searching
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/admin/jobs", window.location.origin);
      if (categoryFilter !== "ALL") url.searchParams.set("category", categoryFilter);
      if (debouncedSearchQuery.trim()) url.searchParams.set("q", debouncedSearchQuery.trim());
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", "12");

      const res = await fetch(url.toString());
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to load jobs");
      setJobs(data.jobs || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [categoryFilter, page, debouncedSearchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearchQuery(searchQuery);
    setPage(1);
  };

  const handleDeleteJob = async (jobId: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${title}"?`)) return;
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete job");
      setActionSuccess(`Job "${title}" deleted successfully.`);
      fetchJobs();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete job");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Live Job Listings Directory
          </h1>
          <p className="text-sm text-slate-400">
            View all published job listings and delete expired or unwanted postings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/jobs/new">
            <Button variant="primary" size="sm" className="gap-2">
              <PlusCircle className="h-4 w-4" />
              <span>Ingest New Job</span>
            </Button>
          </Link>
        </div>
      </div>

      {actionSuccess && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
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
        <div className="flex items-center justify-between gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
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

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="w-full sm:w-64">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter jobs by category"
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
          >
            <option value="ALL">All Job Categories</option>
            {JOB_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full sm:w-72">
          <div className="relative w-full">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search title, company, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2 pl-9 pr-8 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setDebouncedSearchQuery("");
                  setPage(1);
                }}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      {/* Jobs Table */}
      <Card className="border-slate-800 bg-slate-900/70 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading job directory...</div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="h-10 w-10 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-sm font-medium">No job listings found.</p>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">
              Start by pasting a raw job listing to process with AI and broadcast alerts to Telegram users.
            </p>
            <Link href="/admin/jobs/new" className="inline-block pt-2">
              <Button variant="primary" size="sm" className="gap-2">
                <PlusCircle className="h-4 w-4" />
                <span>Ingest First Job</span>
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Job Details</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Category & Level</th>
                  <th className="py-3 px-4">Date / Deadline</th>
                  <th className="py-3 px-4 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-sm text-white">{job.title}</div>
                      {job.location && (
                        <div className="flex items-center gap-1 text-slate-400 mt-0.5">
                          <MapPin className="h-3 w-3 text-sky-400" />
                          <span>{job.location}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-medium">
                      {job.company || <span className="text-slate-600">Unspecified</span>}
                    </td>
                    <td className="py-3.5 px-4 space-y-1">
                      <div>
                        <Badge variant="secondary">{job.category || "General"}</Badge>
                      </div>
                      {job.experienceLevel && (
                        <div className="text-[11px] text-slate-400">{job.experienceLevel}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 space-y-0.5">
                      <div>{job.publishedAt ? formatDate(job.publishedAt) : formatDate(job.createdAt)}</div>
                      {job.deadline && (
                        <div className="text-[10px] text-amber-400/80">
                          Due: {formatDate(job.deadline)}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => handleDeleteJob(job.id, job.title)}
                        title="Delete Job Permanently"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950/40 text-xs">
            <span className="text-slate-400">
              Showing page {page} of {totalPages} ({total} total jobs)
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
