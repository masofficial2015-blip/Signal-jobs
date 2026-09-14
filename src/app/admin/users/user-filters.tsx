"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { JOB_CATEGORIES, EXPERIENCE_LEVELS, ETHIOPIAN_LOCATIONS } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function UserFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") || "");
  const status = searchParams.get("status") || "all";
  const onboarding = searchParams.get("onboarding") || "all";
  const category = searchParams.get("category") || "all";
  const location = searchParams.get("location") || "all";
  const experience = searchParams.get("experience") || "all";

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      return params.toString();
    },
    [searchParams]
  );

  const handleFilterChange = (name: string, value: string) => {
    router.push(`?${createQueryString(name, value)}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`?${createQueryString("q", q)}`);
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 mb-6 space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            type="text"
            placeholder="Search by name, username or ID..."
            className="pl-9 bg-slate-950 border-slate-800"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary">Search</Button>
        {Array.from(searchParams.keys()).length > 0 && (
          <Button type="button" variant="ghost" onClick={() => { setQ(""); router.push("?"); }}>
            Clear
          </Button>
        )}
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Select value={status} onValueChange={(v) => handleFilterChange("status", v)}>
          <SelectTrigger className="bg-slate-950 border-slate-800 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="inactive">Inactive/Blocked</SelectItem>
          </SelectContent>
        </Select>

        <Select value={onboarding} onValueChange={(v) => handleFilterChange("onboarding", v)}>
          <SelectTrigger className="bg-slate-950 border-slate-800 text-xs">
            <SelectValue placeholder="Onboarding" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Onboarding</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>

        <Select value={category} onValueChange={(v) => handleFilterChange("category", v)}>
          <SelectTrigger className="bg-slate-950 border-slate-800 text-xs">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {JOB_CATEGORIES.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={location} onValueChange={(v) => handleFilterChange("location", v)}>
          <SelectTrigger className="bg-slate-950 border-slate-800 text-xs">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {ETHIOPIAN_LOCATIONS.map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={experience} onValueChange={(v) => handleFilterChange("experience", v)}>
          <SelectTrigger className="bg-slate-950 border-slate-800 text-xs">
            <SelectValue placeholder="Experience" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Experience</SelectItem>
            {EXPERIENCE_LEVELS.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
