import { db } from "@/lib/db";
import { Users, Send, MapPin, CheckCircle, PauseCircle, Briefcase, Bookmark, Activity } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

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

export default async function AdminUsersPage() {
  const users = await db.user.findMany({
    include: {
      preference: true,
      _count: {
        select: { notifications: true, savedJobs: true, interactions: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Telegram Subscribers & Preferences
          </h1>
          <p className="text-sm text-slate-400">
            View registered job seekers, onboarding completion, configured match preferences, and activity metrics.
          </p>
        </div>
        <Badge variant="default" className="text-xs">
          {users.length} Total Registered Users
        </Badge>
      </div>

      <Card className="border-slate-800 bg-slate-900/70 overflow-hidden">
        {users.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users className="h-10 w-10 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-sm font-medium">No Telegram subscribers yet.</p>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">
              Job seekers who press /start on the Telegram bot will automatically appear here along with their preferences.
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
                  const categories = parseJsonArray(u.preference?.categories);
                  const professions = parseJsonArray(u.preference?.professions);
                  const locations = parseJsonArray(u.preference?.locations);
                  const expLevels = parseJsonArray(u.preference?.experienceLevels);
                  const isOnboarded = categories.length > 0 || expLevels.length > 0 || locations.length > 0;

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
                          {categories.length > 0 ? (
                            categories.map((c) => (
                              <Badge key={c} variant="secondary" className="text-[10px]">
                                {c}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-slate-600 text-[11px]">All Categories</span>
                          )}
                        </div>
                        {professions.length > 0 && (
                          <div className="text-[10px] text-slate-300 truncate max-w-xs">
                            Prof: {professions.join(", ")}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 space-y-1">
                        <div className="flex items-center gap-1 text-slate-300">
                          <MapPin className="h-3 w-3 text-sky-400" />
                          <span>{locations.join(", ") || "Any Location"}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                          <Briefcase className="h-3 w-3 text-slate-500" />
                          <span>{expLevels.join(", ") || "Any Experience"}</span>
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
      </Card>
    </div>
  );
}
