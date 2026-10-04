import Link from "next/link";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { Users, Send, MapPin, CheckCircle, PauseCircle, Briefcase, Bookmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { formatCategoryLabels, normalizeTaxonomyId, getSubcategoriesForCategory } from "@/lib/constants";
import { UserFilters } from "./user-filters";

export const dynamic = "force-dynamic";

function parseJsonArray(jsonStr?: string | null): string[] {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const params = await searchParams; // Next.js 15+ searchParams is a Promise
  const q = (params.q as string) || "";
  const status = (params.status as string) || "all";
  const onboarding = (params.onboarding as string) || "all";
  const category = (params.category as string) || "all";
  const location = (params.location as string) || "all";
  const experience = (params.experience as string) || "all";

  const page = Math.max(1, parseInt((params.page as string) || "1", 10));
  const limit = 15;
  const skip = (page - 1) * limit;

  // Build the Prisma Where clause dynamically
  const where: Prisma.UserWhereInput = {};

  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { telegramUsername: { contains: q, mode: "insensitive" } },
      { telegramId: { contains: q } },
    ];
  }

  if (status === "active") {
    where.isActive = true;
    where.notificationsPaused = false;
  } else if (status === "paused") {
    where.isActive = true;
    where.notificationsPaused = true;
  } else if (status === "inactive") {
    where.isActive = false;
  }

  const prefConditions: Prisma.UserPreferenceWhereInput[] = [];

  if (category !== "all") {
    const norm = normalizeTaxonomyId(category);
    const subs = getSubcategoriesForCategory(norm).map((s) => s.id);
    const matchedTokens = [norm, ...subs];
    prefConditions.push({
      OR: matchedTokens.map((t) => ({
        categories: { contains: `"${t}"` },
      })),
    });
  }

  if (location !== "all") {
    prefConditions.push({
      locations: { contains: `"${location}"` },
    });
  }

  if (experience !== "all") {
    prefConditions.push({
      experienceLevels: { contains: `"${experience}"` },
    });
  }

  if (onboarding === "completed") {
    prefConditions.push({
      OR: [
        { categories: { not: "[]" } },
        { experienceLevels: { not: "[]" } },
        { locations: { not: "[]" } },
      ],
    });
  } else if (onboarding === "pending") {
    where.OR = [
      { preference: null },
      {
        preference: {
          categories: "[]",
          experienceLevels: "[]",
          locations: "[]",
        },
      },
    ];
  }

  if (prefConditions.length > 0 && onboarding !== "pending") {
    where.preference = {
      AND: prefConditions,
    };
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      include: {
        preference: true,
        _count: {
          select: { notifications: true, savedJobs: true, interactions: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.user.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  function buildPageUrl(targetPage: number) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status !== "all") p.set("status", status);
    if (onboarding !== "all") p.set("onboarding", onboarding);
    if (category !== "all") p.set("category", category);
    if (location !== "all") p.set("location", location);
    if (experience !== "all") p.set("experience", experience);
    p.set("page", String(targetPage));
    return `?${p.toString()}`;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            User Management
          </h1>
          <p className="text-sm text-slate-400">
            View, search, and filter registered job seekers.
          </p>
        </div>
        <Badge variant="default" className="text-xs">
          {total} Users Found
        </Badge>
      </div>

      <UserFilters />

      <Card className="border-slate-800 bg-slate-900/70 overflow-hidden">
        {users.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users className="h-10 w-10 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-sm font-medium">No users match your filters.</p>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">
              Try adjusting your search query or clearing some filters to see more results.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Subscriber Identity</th>
                  <th className="py-3 px-4">Status & Onboarding</th>
                  <th className="py-3 px-4">Preferred Categories & Profession</th>
                  <th className="py-3 px-4">Location & Level</th>
                  <th className="py-3 px-4">Engagement</th>
                  <th className="py-3 px-4">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => {
                  const userCategories = parseJsonArray(u.preference?.categories);
                  const userProfessions = parseJsonArray(u.preference?.professions);
                  const userLocations = parseJsonArray(u.preference?.locations);
                  const userExpLevels = parseJsonArray(u.preference?.experienceLevels);
                  const isOnboarded = userCategories.length > 0 || userExpLevels.length > 0 || userLocations.length > 0;

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-sm text-white">
                          {u.firstName || "Telegram User"} {u.lastName || ""}
                        </div>
                        <div className="text-xs text-sky-400">
                          {u.telegramUsername ? `@${u.telegramUsername}` : `ID: ${u.telegramId}`}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 space-y-1.5">
                        <div>
                          {u.notificationsPaused ? (
                            <Badge variant="warning" className="gap-1">
                              <PauseCircle className="h-3 w-3" />
                              <span>Paused</span>
                            </Badge>
                          ) : u.isActive ? (
                            <Badge variant="success" className="gap-1">
                              <CheckCircle className="h-3 w-3" />
                              <span>Active</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {isOnboarded ? (
                            <span className="text-emerald-400 font-medium">✓ Profile Configured</span>
                          ) : (
                            <span className="text-amber-400 font-medium">⏳ Onboarding Pending</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 space-y-1">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {userCategories.length > 0 ? (
                            userCategories.map((c) => (
                              <Badge key={c} variant="secondary" className="text-[10px]">
                                {formatCategoryLabels(c)}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-slate-600 text-[11px]">All Categories</span>
                          )}
                        </div>
                        {userProfessions.length > 0 && (
                          <div className="text-[10px] text-slate-300 truncate max-w-xs">
                            Prof: {userProfessions.join(", ")}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 space-y-1">
                        <div className="flex items-center gap-1 text-slate-300">
                          <MapPin className="h-3 w-3 text-sky-400" />
                          <span>{userLocations.join(", ") || "Any Location"}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                          <Briefcase className="h-3 w-3 text-slate-500" />
                          <span>{userExpLevels.join(", ") || "Any Experience"}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 space-y-1">
                        <div className="text-slate-200 font-semibold flex items-center gap-1">
                          <Send className="h-3 w-3 text-sky-400" />
                          <span>{u._count.notifications} alerts</span>
                        </div>
                        <div className="text-slate-400 text-[11px] flex items-center gap-1">
                          <Bookmark className="h-3 w-3 text-amber-400" />
                          <span>{u._count.savedJobs} saved</span>
                          <span className="text-slate-600">•</span>
                          <span>{u._count.interactions} events</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {formatDate(u.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950/40 text-xs">
            <span className="text-slate-400">
              Showing page {page} of {totalPages} ({total} total users)
            </span>
            <div className="flex gap-2">
              <Link
                href={buildPageUrl(Math.max(1, page - 1))}
                className={`px-3 py-1.5 rounded border border-slate-800 bg-slate-900 text-slate-300 transition-colors ${
                  page <= 1 ? "opacity-50 pointer-events-none" : "hover:bg-slate-800"
                }`}
              >
                Previous
              </Link>
              <Link
                href={buildPageUrl(Math.min(totalPages, page + 1))}
                className={`px-3 py-1.5 rounded border border-slate-800 bg-slate-900 text-slate-300 transition-colors ${
                  page >= totalPages ? "opacity-50 pointer-events-none" : "hover:bg-slate-800"
                }`}
              >
                Next
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
