"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  AlertCircle,
  CheckCircle2,
  Wand2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { JOB_CATEGORIES, EXPERIENCE_LEVELS } from "@/lib/constants";

interface JobFormData {
  title: string;
  company: string;
  location: string;
  categories: string[];
  experienceLevels: string[];
  education: string;
  deadline: string;
  profession: string;
  summary: string;
  description: string;
  applicationUrl: string;
}

type PositionStatus = "unsaved" | "published";

interface ExtractedPosition {
  formData: JobFormData;
  status: PositionStatus;
  savedJobId?: string;
}

export default function AdminNewJobPage() {
  const router = useRouter();

  const [rawText, setRawText] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const [extracting, setExtracting] = useState(false);
  const [positions, setPositions] = useState<ExtractedPosition[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positionMsg, setPositionMsg] = useState<Record<number, string>>({});
  const [showAllDoneBanner, setShowAllDoneBanner] = useState(true);

  const extracted = positions.length > 0;
  const current = positions[currentIdx];

  const handleProcessAI = async () => {
    if (!rawText.trim() || rawText.trim().length < 10) {
      setError("Please paste raw job listing text (at least 10 characters).");
      return;
    }
    setExtracting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/jobs/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, sourceName, sourceUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI processing failed.");

      const normalizeExp = (val: unknown): string[] => {
        if (!val) return ["entry_level"];
        if (Array.isArray(val)) {
          const mapped = val
            .map((v) => {
              const str = String(v).toLowerCase();
              if (str.includes("grad") || str.includes("fresh") || str === "0") return "graduate";
              if (str.includes("entry") || str.includes("junior") || str === "1" || str === "2") return "entry_level";
              if (str.includes("mid") || str === "3" || str === "4" || str === "5") return "mid_level";
              if (str.includes("senior") || str.includes("lead")) return "senior_level";
              return str;
            })
            .filter((id) => EXPERIENCE_LEVELS.some((e) => e.id === id));
          return mapped.length > 0 ? mapped : ["entry_level"];
        }
        const str = String(val).toLowerCase();
        const results: string[] = [];
        if (str.includes("grad") || str.includes("fresh") || str.includes("0 year") || str.includes("0-")) results.push("graduate");
        if (str.includes("entry") || str.includes("junior") || str.includes("1-2") || str.includes("0-2") || str.includes("1 year") || str.includes("2 year")) results.push("entry_level");
        if (str.includes("mid") || str.includes("3-5") || str.includes("3 year")) results.push("mid_level");
        if (str.includes("senior") || str.includes("5+") || str.includes("5 year")) results.push("senior_level");
        return results.length > 0 ? results : ["entry_level"];
      };

      const normalizeDateStr = (val: unknown): string => {
        if (!val || typeof val !== "string") return "";
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split("T")[0];
        }
        return "";
      };

      const jobs: JobFormData[] = (data.extractedJobs as Record<string, unknown>[]).map((ext) => ({
        title: (ext.title as string) || "",
        company: (ext.company as string) || "",
        location: (ext.location as string) || "Addis Ababa",
        categories: Array.isArray(ext.category)
          ? (ext.category as string[])
          : ext.category
          ? [(ext.category as string)]
          : [],
        experienceLevels: normalizeExp(ext.experienceLevel),
        education: (ext.education as string) || "",
        deadline: normalizeDateStr(ext.deadline),
        profession: (ext.profession as string) || "",
        summary: (ext.summary as string) || "",
        description: (ext.description as string) || rawText,
        applicationUrl: (ext.applicationUrl as string) || sourceUrl || "",
      }));

      setPositions(jobs.map((formData) => ({ formData, status: "unsaved" })));
      setCurrentIdx(0);
      setPositionMsg({});
      setShowAllDoneBanner(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "AI extraction error");
    } finally {
      setExtracting(false);
    }
  };

  const updateField = (field: keyof JobFormData, value: unknown) => {
    setPositions((prev) =>
      prev.map((p, i) =>
        i === currentIdx ? { ...p, formData: { ...p.formData, [field]: value } } : p
      )
    );
  };

  const handlePublishPosition = async () => {
    if (!current?.formData.title.trim()) {
      setError("Job title is required.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...current.formData,
          category: current.formData.categories,
          experienceLevel: current.formData.experienceLevels,
          education: current.formData.education,
          deadline: current.formData.deadline || null,
          rawText,
          sourceName,
          sourceUrl,
          status: "PUBLISHED",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to publish job.");

      setPositions((prev) =>
        prev.map((p, i) =>
          i === currentIdx ? { ...p, status: "published", savedJobId: (data.job as { id?: string })?.id } : p
        )
      );
      setPositionMsg((prev) => ({
        ...prev,
        [currentIdx]: "Published! Matching Telegram job seekers are being alerted.",
      }));

      const nextUnsaved = positions.findIndex((p, i) => i > currentIdx && p.status === "unsaved");
      if (nextUnsaved !== -1) setTimeout(() => setCurrentIdx(nextUnsaved), 800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Publish error");
    } finally {
      setSaving(false);
    }
  };

  const allDone = extracted && positions.every((p) => p.status === "published");
  const publishedCount = positions.filter((p) => p.status === "published").length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.push("/admin/jobs")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">Ingest New Job</h1>
              <Badge variant="default">AI Pipeline</Badge>
            </div>
            <p className="text-xs text-slate-400">
              Paste post (single or multi-position) → AI extracts → Review details & categories → Publish & Alert
            </p>
          </div>
        </div>
      </div>

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

      {allDone && showAllDoneBanner && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>All {positions.length} positions published and broadcasted!</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/admin/jobs")}>
              View Live Jobs Directory →
            </Button>
            <button
              type="button"
              onClick={() => setShowAllDoneBanner(false)}
              className="text-emerald-400/80 hover:text-emerald-200 transition-colors p-1"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <Card className="border-slate-800 bg-slate-900/80">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-slate-950">1</div>
              <span>Paste Raw Job Post</span>
            </div>
            {extracted && (
              <span className="text-xs font-normal text-emerald-400">
                ✓ {positions.length} position{positions.length > 1 ? "s" : ""} extracted
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Copy and paste the vacancy text from Telegram or job portals. AI will split multi-position postings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            rows={7}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste complete vacancy text here..."
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-white placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Source Name <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="e.g. Telegram Channel / EthioJobs"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Source / Application Link <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://t.me/... or https://..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="primary" onClick={handleProcessAI} disabled={extracting} className="gap-2">
              <Wand2 className="h-4 w-4" />
              <span>{extracting ? "Processing..." : extracted ? "Re-extract" : "Process with AI"}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {extracted && current && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-1">
            <Card className="border-slate-800 bg-slate-900/70 sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">All Positions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 p-3 pt-0">
                {positions.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIdx(i)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-all ${
                      i === currentIdx
                        ? "border-sky-500/50 bg-sky-500/10 text-white"
                        : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-semibold truncate">{p.formData.title || `Position ${i + 1}`}</span>
                      <CircleDot className={`h-3 w-3 shrink-0 ${p.status === "published" ? "text-emerald-400" : "text-slate-500"}`} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={p.status === "published" ? "success" : "secondary"} className="text-[9px] py-0">
                        {p.status === "published" ? "Published" : "Pending"}
                      </Badge>
                      <span className="text-[10px] text-slate-500 truncate">
                        {p.formData.experienceLevels.join(", ")}
                      </span>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card className="border-sky-500/30 bg-slate-900/90 shadow-2xl">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <span>Position {currentIdx + 1} of {positions.length}</span>
                    <Badge variant={current.status === "published" ? "success" : "secondary"}>
                      {current.status === "published" ? "Published" : "Pending Review"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" disabled={currentIdx === 0} onClick={() => setCurrentIdx((i) => i - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={currentIdx === positions.length - 1} onClick={() => setCurrentIdx((i) => i + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {positionMsg[currentIdx] && (
                  <div className="flex items-center justify-between gap-2 p-3 text-xs bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/30">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>{positionMsg[currentIdx]}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...positionMsg };
                        delete next[currentIdx];
                        setPositionMsg(next);
                      }}
                      className="text-emerald-400/80 hover:text-emerald-200 transition-colors p-1"
                      aria-label="Dismiss notification"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Job Title *</label>
                    <input type="text" required value={current.formData.title} onChange={(e) => updateField("title", e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Company / Organization</label>
                    <input type="text" value={current.formData.company} onChange={(e) => updateField("company", e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Location</label>
                    <input type="text" value={current.formData.location} onChange={(e) => updateField("location", e.target.value)} placeholder="e.g. Addis Ababa or Remote" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Application URL (or Original Post Link)</label>
                    <input type="url" value={current.formData.applicationUrl} onChange={(e) => updateField("applicationUrl", e.target.value)} placeholder="https://example.com/apply" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none" />
                  </div>
                </div>

                {/* Education Requirement & Deadline Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Education Requirement <span className="text-slate-500 font-normal normal-case">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={current.formData.education}
                      onChange={(e) => updateField("education", e.target.value)}
                      placeholder="e.g. BSc in Computer Science, BA in Accounting"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Application Deadline <span className="text-slate-500 font-normal normal-case">(optional)</span>
                    </label>
                    <input
                      type="date"
                      value={current.formData.deadline}
                      onChange={(e) => updateField("deadline", e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Categories <span className="text-slate-500 font-normal normal-case">(select all that apply)</span>
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                      {JOB_CATEGORIES.map((c) => {
                        const selected = current.formData.categories.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              const next = selected ? current.formData.categories.filter((x) => x !== c.id) : [...current.formData.categories, c.id];
                              updateField("categories", next);
                            }}
                            className={`text-left px-2.5 py-1.5 rounded-lg border text-[11px] transition-all ${selected ? "border-sky-500/60 bg-sky-500/15 text-sky-300 font-semibold" : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600"}`}
                          >
                            {selected ? "✓ " : ""}{c.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Target Experience Levels <span className="text-slate-500 font-normal normal-case">(select all that apply)</span>
                    </label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {EXPERIENCE_LEVELS.map((e) => {
                        const selected = current.formData.experienceLevels.includes(e.id);
                        return (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => {
                              const next = selected ? current.formData.experienceLevels.filter((x) => x !== e.id) : [...current.formData.experienceLevels, e.id];
                              updateField("experienceLevels", next.length > 0 ? next : ["entry_level"]);
                            }}
                            className={`text-left px-2.5 py-2 rounded-lg border text-xs transition-all ${selected ? "border-sky-500/60 bg-sky-500/15 text-sky-300 font-semibold" : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600"}`}
                          >
                            {selected ? "✓ " : ""}{e.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Telegram Notification Summary</label>
                  <textarea rows={2} value={current.formData.summary} onChange={(e) => updateField("summary", e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-white focus:border-sky-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Full Description</label>
                  <textarea rows={5} value={current.formData.description} onChange={(e) => updateField("description", e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 font-mono text-xs text-white focus:border-sky-500 focus:outline-none" />
                </div>
                <div className="flex items-center justify-between border-t border-slate-800 pt-5">
                  <span className="text-xs text-slate-500">{publishedCount} of {positions.length} positions published</span>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handlePublishPosition}
                      disabled={saving || current.status === "published"}
                      className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {current.status === "published" ? "Published ✓" : "Publish & Alert"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
