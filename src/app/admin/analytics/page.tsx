import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JOB_CATEGORIES, EXPERIENCE_LEVELS, ETHIOPIAN_LOCATIONS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay()); // Sunday as start of week

  // --- 1. USER METRICS ---
  const totalUsers = await db.user.count();
  const newUsersToday = await db.user.count({ where: { createdAt: { gte: startOfToday } } });
  const newUsersThisWeek = await db.user.count({ where: { createdAt: { gte: startOfWeek } } });
  const activeUsers = await db.user.count({ where: { isActive: true } });
  const blockedUsers = await db.user.count({ where: { isActive: false } });
  const onboardedUsers = await db.userPreference.count(); // if they have preferences, they completed onboarding

  // --- 2. PREFERENCES DISTRIBUTION ---
  const allPreferences = await db.userPreference.findMany({
    select: { categories: true, experienceLevels: true, locations: true }
  });

  const categoryCounts: Record<string, number> = {};
  const experienceCounts: Record<string, number> = {};
  const locationCounts: Record<string, number> = {};

  allPreferences.forEach(pref => {
    try {
      const cats = JSON.parse(pref.categories);
      const exps = JSON.parse(pref.experienceLevels);
      const locs = JSON.parse(pref.locations);

      cats.forEach((c: string) => { categoryCounts[c] = (categoryCounts[c] || 0) + 1; });
      exps.forEach((e: string) => { experienceCounts[e] = (experienceCounts[e] || 0) + 1; });
      locs.forEach((l: string) => { locationCounts[l] = (locationCounts[l] || 0) + 1; });
    } catch (e) {
      // Ignore parse errors for old malformed data
    }
  });

  // Sort and format for display
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({
      label: JOB_CATEGORIES.find(c => c.id === id)?.label || id,
      count
    }));

  const topExperiences = Object.entries(experienceCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({
      label: EXPERIENCE_LEVELS.find(e => e.id === id)?.label || id,
      count
    }));

  const topLocations = Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({
      label: ETHIOPIAN_LOCATIONS.find(l => l.id === id)?.label || id,
      count
    }));

  // --- 3. BOT INTERACTIONS ---
  const interactionGroups = await db.userJobInteraction.groupBy({
    by: ['action'],
    _count: {
      action: true,
    }
  });

  const getInteractionCount = (action: string) => {
    return interactionGroups.find(g => g.action === action)?._count.action || 0;
  };

  const jobDetailsClicked = getInteractionCount("JOB_VIEWED");
  const jobsSaved = getInteractionCount("JOB_SAVED");
  const notificationsSent = await db.notification.count({ where: { status: "SENT" } });


  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Monitor user growth, preferences, and bot usage.</p>
      </div>

      {/* Users Section */}
      <h2 className="text-xl font-semibold mt-8 mb-4">👥 Users</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Users" value={totalUsers.toLocaleString()} />
        <MetricCard title="New Today" value={newUsersToday.toLocaleString()} />
        <MetricCard title="New This Week" value={newUsersThisWeek.toLocaleString()} />
        <MetricCard title="Active Users" value={activeUsers.toLocaleString()} />
        <MetricCard title="Onboarded Users" value={onboardedUsers.toLocaleString()} />
        <MetricCard title="Stopped/Blocked Bot" value={blockedUsers.toLocaleString()} />
      </div>

      {/* Bot Interactions Section */}
      <h2 className="text-xl font-semibold mt-12 mb-4">🤖 Bot Interactions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Onboarding Completed" value={onboardedUsers.toLocaleString()} />
        <MetricCard title="Job Details Clicked" value={jobDetailsClicked.toLocaleString()} />
        <MetricCard title="Jobs Saved" value={jobsSaved.toLocaleString()} />
        <MetricCard title="Notifications Sent" value={notificationsSent.toLocaleString()} />
      </div>

      {/* Preferences Section */}
      <h2 className="text-xl font-semibold mt-12 mb-4">🎯 User Preferences</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {topCategories.slice(0, 8).map((item, i) => (
                <li key={i} className="flex justify-between items-center text-sm">
                  <span className="truncate mr-4 text-muted-foreground">{item.label}</span>
                  <span className="font-semibold">{item.count}</span>
                </li>
              ))}
              {topCategories.length === 0 && <li className="text-sm text-muted-foreground">No data yet</li>}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Experience Levels</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {topExperiences.map((item, i) => (
                <li key={i} className="flex justify-between items-center text-sm">
                  <span className="truncate mr-4 text-muted-foreground">{item.label}</span>
                  <span className="font-semibold">{item.count}</span>
                </li>
              ))}
              {topExperiences.length === 0 && <li className="text-sm text-muted-foreground">No data yet</li>}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {topLocations.slice(0, 8).map((item, i) => (
                <li key={i} className="flex justify-between items-center text-sm">
                  <span className="truncate mr-4 text-muted-foreground">{item.label}</span>
                  <span className="font-semibold">{item.count}</span>
                </li>
              ))}
              {topLocations.length === 0 && <li className="text-sm text-muted-foreground">No data yet</li>}
            </ul>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
