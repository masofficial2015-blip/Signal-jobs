/**
 * Message builder — formats all Telegram message texts and inline keyboards.
 * Pure functions, no I/O. Easy to test independently.
 */

import { JOB_CATEGORIES, EXPERIENCE_LEVELS, ETHIOPIAN_LOCATIONS, normalizeCategoryId } from "@/lib/constants";

export type InlineKeyboard = Array<Array<{ text: string; callback_data?: string; url?: string }>>;

// ── Formatting Helpers ────────────────────────────────────────────────────────

function esc(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatCategoryLabels(raw: string | string[] | null | undefined): string {
  if (!raw) return "";
  let items: string[] = [];

  if (Array.isArray(raw)) {
    items = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          items = parsed;
        } else {
          items = [trimmed];
        }
      } catch {
        items = [trimmed];
      }
    } else if (trimmed.includes(",")) {
      items = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      items = [trimmed];
    }
  }

  const categoryMap = new Map<string, string>(JOB_CATEGORIES.map((c) => [c.id, c.label]));
  const labels = items
    .map((item) => {
      const clean = item.replace(/^["']|["']$/g, "").trim();
      const normalized = normalizeCategoryId(clean);
      return categoryMap.get(normalized) || categoryMap.get(clean) || clean;
    })
    .filter(Boolean);

  return labels.join(", ");
}

export function formatExperienceLabel(raw: string | string[] | null | undefined): string {
  if (!raw) return "";
  let items: string[] = [];

  if (Array.isArray(raw)) {
    items = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) items = parsed;
        else items = [trimmed];
      } catch {
        items = [trimmed];
      }
    } else if (trimmed.includes(",")) {
      items = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      items = [trimmed];
    }
  }

  const expMap = new Map<string, string>(EXPERIENCE_LEVELS.map((e) => [e.id, e.label]));
  const labels = items
    .map((item) => {
      const clean = item.replace(/^["']|["']$/g, "").trim();
      return expMap.get(clean) || clean;
    })
    .filter(Boolean);

  return labels.join(", ");
}

export function formatLocationLabel(raw: string | null | undefined): string {
  if (!raw) return "";
  const clean = raw.trim().toLowerCase();
  if (clean === "any" || clean === "anywhere") return "Anywhere in Ethiopia";
  const locMap = new Map<string, string>(ETHIOPIAN_LOCATIONS.map((l) => [l.id, l.label]));
  return locMap.get(raw.trim()) || raw;
}

// ── Keyboard Builders ─────────────────────────────────────────────────────────

export const KB = {
  // ── Onboarding & navigation ──────────────────────────────────────────────

  mainMenu(): InlineKeyboard {
    return [
      [
        { text: "🔍 Browse Jobs", callback_data: "cmd:jobs" },
        { text: "💾 Saved Jobs", callback_data: "cmd:saved" },
      ],
      [
        { text: "⚙️ Preferences", callback_data: "cmd:preferences" },
        { text: "🔔 Alerts", callback_data: "cmd:notifications" },
      ],
      [{ text: "❓ Help", callback_data: "cmd:help" }],
    ];
  },

  // ── Onboarding steps & selection grids (2-column layouts) ─────────────────

  categories(): InlineKeyboard {
    const rows: InlineKeyboard = [];
    for (let i = 0; i < JOB_CATEGORIES.length; i += 2) {
      const row = [{ text: JOB_CATEGORIES[i].label, callback_data: `pref:cat:${JOB_CATEGORIES[i].id}` }];
      if (JOB_CATEGORIES[i + 1]) {
        row.push({ text: JOB_CATEGORIES[i + 1].label, callback_data: `pref:cat:${JOB_CATEGORIES[i + 1].id}` });
      }
      rows.push(row);
    }
    rows.push([{ text: "🔙 Back to Preferences", callback_data: "cmd:preferences" }]);
    return rows;
  },

  experienceLevels(): InlineKeyboard {
    const rows: InlineKeyboard = [];
    for (let i = 0; i < EXPERIENCE_LEVELS.length; i += 2) {
      const row = [{ text: EXPERIENCE_LEVELS[i].label, callback_data: `pref:exp:${EXPERIENCE_LEVELS[i].id}` }];
      if (EXPERIENCE_LEVELS[i + 1]) {
        row.push({ text: EXPERIENCE_LEVELS[i + 1].label, callback_data: `pref:exp:${EXPERIENCE_LEVELS[i + 1].id}` });
      }
      rows.push(row);
    }
    rows.push([{ text: "🔙 Back to Preferences", callback_data: "cmd:preferences" }]);
    return rows;
  },

  locations(): InlineKeyboard {
    const rows: InlineKeyboard = [];
    for (let i = 0; i < ETHIOPIAN_LOCATIONS.length; i += 2) {
      const row = [{ text: ETHIOPIAN_LOCATIONS[i].label, callback_data: `pref:loc:${ETHIOPIAN_LOCATIONS[i].id}` }];
      if (ETHIOPIAN_LOCATIONS[i + 1]) {
        row.push({ text: ETHIOPIAN_LOCATIONS[i + 1].label, callback_data: `pref:loc:${ETHIOPIAN_LOCATIONS[i + 1].id}` });
      }
      rows.push(row);
    }
    rows.push([
      { text: "📍 Anywhere in Ethiopia", callback_data: "pref:loc:any" },
      { text: "🔙 Back", callback_data: "cmd:preferences" },
    ]);
    return rows;
  },

  // ── Preference display & editing (2-column optimized) ────────────────────

  preferencesActions(notificationsPaused: boolean): InlineKeyboard {
    return [
      [
        { text: "✏️ Category", callback_data: "edit:cat" },
        { text: "🎯 Experience", callback_data: "edit:exp" },
      ],
      [
        { text: "📍 Location", callback_data: "edit:loc" },
        notificationsPaused
          ? { text: "🔔 Resume Alerts", callback_data: "cmd:resume" }
          : { text: "🔕 Pause Alerts", callback_data: "cmd:pause" },
      ],
      [{ text: "🏠 Main Menu", callback_data: "cmd:menu" }],
    ];
  },

  // ── Notification actions ──────────────────────────────────────────────────

  notificationToggle(paused: boolean): InlineKeyboard {
    return [
      [
        paused
          ? { text: "🔔 Resume Job Alerts", callback_data: "cmd:resume" }
          : { text: "⏸ Pause Job Alerts", callback_data: "cmd:pause" },
      ],
      [
        { text: "⚙️ Preferences", callback_data: "cmd:preferences" },
        { text: "🏠 Main Menu", callback_data: "cmd:menu" },
      ],
    ];
  },

  // ── Paginated Job Browsing Actions ────────────────────────────────────────

  paginatedJobActions(
    jobId: string,
    sourceUrl: string | null,
    isSaved: boolean,
    page: number,
    total: number
  ): InlineKeyboard {
    const actionRow: Array<{ text: string; callback_data?: string; url?: string }> = [];

    if (sourceUrl) {
      actionRow.push({ text: "🔗 View & Apply", url: sourceUrl });
    }

    if (isSaved) {
      actionRow.push({ text: "Saved ✓", callback_data: `job:unsave:${jobId}:${page}` });
    } else {
      actionRow.push({ text: "💾 Save Job", callback_data: `job:save:${jobId}:${page}` });
    }

    const rows: InlineKeyboard = [actionRow];

    if (total > 1) {
      const paginationRow: Array<{ text: string; callback_data?: string }> = [
        page > 0
          ? { text: "◀️ Prev", callback_data: `job:page:${page - 1}` }
          : { text: "▪️", callback_data: "noop" },
        { text: `${page + 1}/${total}`, callback_data: "noop" },
        page < total - 1
          ? { text: "Next ▶️", callback_data: `job:page:${page + 1}` }
          : { text: "▪️", callback_data: "noop" },
      ];
      rows.push(paginationRow);
    }

    rows.push([{ text: "🏠 Main Menu", callback_data: "cmd:menu" }]);
    return rows;
  },

  paginatedSavedJobActions(
    jobId: string,
    sourceUrl: string | null,
    page: number,
    total: number
  ): InlineKeyboard {
    const actionRow: Array<{ text: string; callback_data?: string; url?: string }> = [];

    if (sourceUrl) {
      actionRow.push({ text: "🔗 View & Apply", url: sourceUrl });
    }

    actionRow.push({ text: "❌ Remove", callback_data: `saved:unsave:${jobId}:${page}` });

    const rows: InlineKeyboard = [actionRow];

    if (total > 1) {
      const paginationRow: Array<{ text: string; callback_data?: string }> = [
        page > 0
          ? { text: "◀️ Prev", callback_data: `saved:page:${page - 1}` }
          : { text: "▪️", callback_data: "noop" },
        { text: `${page + 1}/${total}`, callback_data: "noop" },
        page < total - 1
          ? { text: "Next ▶️", callback_data: `saved:page:${page + 1}` }
          : { text: "▪️", callback_data: "noop" },
      ];
      rows.push(paginationRow);
    }

    rows.push([{ text: "🏠 Main Menu", callback_data: "cmd:menu" }]);
    return rows;
  },

  jobAlertActions(jobId: string, applicationUrl?: string | null, isSaved?: boolean): InlineKeyboard {
    const row: Array<{ text: string; callback_data?: string; url?: string }> = [];
    if (applicationUrl) {
      row.push({ text: "🔗 View & Apply", url: applicationUrl });
    } else {
      row.push({ text: "🔗 View & Apply", callback_data: `job:apply:${jobId}` });
    }

    if (isSaved) {
      row.push({ text: "Saved ✓", callback_data: `job:unsave:${jobId}:alert` });
    } else {
      row.push({ text: "💾 Save", callback_data: `job:save:${jobId}:alert` });
    }
    return [row];
  },

  backToMenu(): InlineKeyboard {
    return [[{ text: "🏠 Main Menu", callback_data: "cmd:menu" }]];
  },
};

// ── Text Formatters ───────────────────────────────────────────────────────────

export const MSG = {
  welcome(firstName: string): string {
    return (
      `👋 Welcome to <b>Signal Job</b>, ${esc(firstName)}!\n\n` +
      `I notify Ethiopian job seekers on Telegram whenever a matching opportunity is published.\n\n` +
      `<b>Let's get started.</b> First, pick the job category that interests you most 👇`
    );
  },

  returningUser(firstName: string): string {
    return (
      `Welcome back, <b>${esc(firstName)}</b>! 👋\n\n` +
      `Your preferences are active. What would you like to do?`
    );
  },

  askCategory(): string {
    return "🗂 <b>Step 1 of 3 — Job Category</b>\n\nChoose the field you're looking for:";
  },

  askExperienceLevel(): string {
    return "🎯 <b>Step 2 of 3 — Experience Level</b>\n\nWhat experience level are you targeting?";
  },

  askLocation(): string {
    return "📍 <b>Step 3 of 3 — Preferred Location</b>\n\nWhere are you looking to work in Ethiopia?";
  },

  onboardingComplete(category: string, experienceLevel: string, location: string): string {
    return (
      `✅ <b>You're all set!</b>\n\n` +
      `Here's your job alert profile:\n` +
      `• Category: <b>${esc(category)}</b>\n` +
      `• Level: <b>${esc(experienceLevel)}</b>\n` +
      `• Location: <b>${esc(location)}</b>\n\n` +
      `You'll now receive Telegram notifications when matching Ethiopian jobs are published.\n\n` +
      `Use /preferences to edit anytime, or /help to see all commands.`
    );
  },

  preferences(
    categories: string[],
    experienceLevels: string[],
    locations: string[],
    notificationsPaused: boolean
  ): string {
    const catLabel = categories.length > 0 ? formatCategoryLabels(categories) : "All Categories";
    const expLabel = experienceLevels.length > 0 ? experienceLevels.map(formatExperienceLabel).join(", ") : "Any Level";
    const locLabel = locations.length > 0 ? locations.map(formatLocationLabel).join(", ") : "Anywhere";

    return (
      `⚙️ <b>Your Job Alert Preferences</b>\n\n` +
      `🗂 Category: <b>${esc(catLabel)}</b>\n` +
      `🎯 Experience: <b>${esc(expLabel)}</b>\n` +
      `📍 Location: <b>${esc(locLabel)}</b>\n` +
      `🔔 Alerts: <b>${notificationsPaused ? "⏸ Paused" : "✅ Active"}</b>`
    );
  },

  jobCard(
    job: {
      id: string;
      title: string;
      company: string | null;
      location: string | null;
      experienceLevel: string | null;
      category: string | null;
      education?: string | null;
      summary: string | null;
    },
    index: number,
    total: number
  ): string {
    const formattedCat = formatCategoryLabels(job.category);
    const formattedExp = formatExperienceLabel(job.experienceLevel);
    const formattedLoc = formatLocationLabel(job.location);

    return (
      `📋 <b>Job ${index}/${total}</b>\n\n` +
      `<b>${esc(job.title)}</b>${job.company ? ` — ${esc(job.company)}` : ""}\n\n` +
      (formattedLoc ? `📍 ${esc(formattedLoc)}\n` : "") +
      (formattedExp ? `💼 ${esc(formattedExp)}\n` : "") +
      (job.education ? `🎓 ${esc(job.education)}\n` : "") +
      (formattedCat ? `🗂 ${esc(formattedCat)}\n` : "") +
      (job.summary ? `\n<i>${esc(job.summary.slice(0, 220))}${job.summary.length > 220 ? "..." : ""}</i>` : "")
    );
  },

  jobMatchAlert(job: {
    title: string;
    company?: string | null;
    location?: string | null;
    experienceLevel?: string | string[] | null;
    education?: string | null;
    summary?: string | null;
    matchScore?: number;
    matchReasons?: string[];
  }): string {
    const formattedLoc = formatLocationLabel(job.location);
    const formattedExp = formatExperienceLabel(job.experienceLevel);

    let text = `🆕 <b>New Job Match</b>\n\n`;
    text += `<b>${esc(job.title)}</b>${job.company ? ` — ${esc(job.company)}` : ""}\n\n`;
    if (formattedLoc) text += `📍 <b>Location:</b> ${esc(formattedLoc)}\n`;
    if (formattedExp) text += `💼 <b>Experience:</b> ${esc(formattedExp)}\n`;
    if (job.education) text += `🎓 <b>Education:</b> ${esc(job.education)}\n`;
    if (job.summary) {
      text += `\n<i>${esc(job.summary.slice(0, 200))}${job.summary.length > 200 ? "..." : ""}</i>`;
    }
    return text;
  },

  noJobsFound(): string {
    return (
      `🔍 <b>No matching jobs found right now.</b>\n\n` +
      `New jobs are added regularly. You'll receive an alert as soon as a job matching your criteria is published.\n\n` +
      `You can update your preferences with /preferences.`
    );
  },

  savedJobs(count: number): string {
    if (count === 0) {
      return "💾 <b>Saved Jobs</b>\n\nYou haven't saved any jobs yet.\n\nBrowse available jobs with /jobs and tap 💾 Save Job to bookmark them.";
    }
    return `💾 <b>Saved Jobs (${count})</b>\n\nHere are your bookmarked Ethiopian job opportunities:`;
  },

  savedJobCard(
    job: {
      id: string;
      title: string;
      company: string | null;
      location: string | null;
      experienceLevel: string | null;
      category: string | null;
      education?: string | null;
      summary: string | null;
    },
    index: number,
    total: number
  ): string {
    const formattedCat = formatCategoryLabels(job.category);
    const formattedExp = formatExperienceLabel(job.experienceLevel);
    const formattedLoc = formatLocationLabel(job.location);

    return (
      `💾 <b>Saved Job ${index}/${total}</b>\n\n` +
      `<b>${esc(job.title)}</b>${job.company ? ` — ${esc(job.company)}` : ""}\n\n` +
      (formattedLoc ? `📍 ${esc(formattedLoc)}\n` : "") +
      (formattedExp ? `💼 ${esc(formattedExp)}\n` : "") +
      (job.education ? `🎓 ${esc(job.education)}\n` : "") +
      (formattedCat ? `🗂 ${esc(formattedCat)}\n` : "") +
      (job.summary ? `\n<i>${esc(job.summary.slice(0, 220))}${job.summary.length > 220 ? "..." : ""}</i>` : "")
    );
  },

  notificationStatus(paused: boolean): string {
    return paused
      ? `🔕 <b>Job Alerts are Paused</b>\n\nYou're not receiving notifications. Press the button below to resume.`
      : `🔔 <b>Job Alerts are Active</b>\n\nYou'll be notified when a matching job is published. Tap below to pause.`;
  },

  pauseConfirm(): string {
    return "⏸ <b>Notifications Paused</b>\n\nYou won't receive job alerts until you resume. Use /resume or /notifications anytime.";
  },

  resumeConfirm(): string {
    return "✅ <b>Notifications Resumed</b>\n\nYou'll now receive alerts for matching Ethiopian job listings.";
  },

  help(): string {
    return (
      `ℹ️ <b>Signal Job — Command Reference</b>\n\n` +
      `/start — Set up your profile & preferences\n` +
      `/jobs — Browse recent matching jobs (paginated)\n` +
      `/preferences — View & update your preferences\n` +
      `/saved — View your saved jobs\n` +
      `/notifications — Manage notification settings\n` +
      `/pause — Pause job alerts temporarily\n` +
      `/resume — Resume job alerts\n` +
      `/help — Show this reference\n\n` +
      `<i>Signal Job is a Telegram-first job discovery assistant for Ethiopian job seekers.</i>`
    );
  },

  editCategory(): string {
    return "🗂 <b>Change Category</b>\n\nChoose your new preferred job category:";
  },

  editExperience(): string {
    return "🎯 <b>Change Experience Level</b>\n\nSelect your target experience level:";
  },

  editLocation(): string {
    return "📍 <b>Change Location</b>\n\nSelect your preferred location in Ethiopia:";
  },

  preferenceUpdated(field: string): string {
    return `✅ <b>${esc(field)}</b> updated!`;
  },

  error(): string {
    return "⚠️ Something went wrong. Please try again in a moment.";
  },
};

