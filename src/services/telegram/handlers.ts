/**
 * Command handlers — one function per bot command.
 * Receives a Telegram user/chat context and orchestrates services.
 * Uses editMessageText and editMessageReplyMarkup for single-panel in-place UI.
 */

import { db } from "@/lib/db";
import { telegramClient } from "./client";
import { userService, TelegramFromUser } from "./userService";
import { jobBrowseService, invalidateBrowseCache } from "./jobBrowseService";
import { KB, MSG, formatCategoryLabels, formatExperienceLabel, formatLocationLabel } from "./messages";
import { JOB_CATEGORIES, EXPERIENCE_LEVELS, ETHIOPIAN_LOCATIONS } from "@/lib/constants";

type ChatId = string | number;

/**
 * Fast user lookup for callback handlers.
 * Uses findUnique (read-only) when the user already exists — avoids a write on every button tap.
 * Falls back to upsert only if the user is somehow not yet in the DB.
 */
async function getUser(from: TelegramFromUser) {
  const existing = await db.user.findUnique({
    where: { telegramId: String(from.id) },
    include: { preference: true },
  });
  if (existing) return existing;
  // First-contact fallback
  return userService.upsertFromTelegram(from);
}

// ── /start ────────────────────────────────────────────────────────────────────

export async function handleStart(chatId: ChatId, from: TelegramFromUser, messageId?: number) {
  const user = await userService.upsertFromTelegram(from);
  const hasPrefs = !!user.preference;

  if (hasPrefs) {
    if (messageId) {
      await telegramClient.editMessageText({
        chatId,
        messageId,
        text: MSG.returningUser(from.first_name ?? "there"),
        replyMarkup: { inline_keyboard: KB.mainMenu() },
      });
    } else {
      await telegramClient.sendMessage({
        chatId,
        text: MSG.returningUser(from.first_name ?? "there"),
        replyMarkup: { inline_keyboard: KB.mainMenu() },
      });
    }
  } else {
    // First-time onboarding
    await telegramClient.sendMessage({
      chatId,
      text: MSG.welcome(from.first_name ?? "there"),
    });
    // Step 1 — category
    await telegramClient.sendMessage({
      chatId,
      text: MSG.askCategory(),
      replyMarkup: { inline_keyboard: KB.categories() },
    });
  }
}

// ── /preferences ──────────────────────────────────────────────────────────────

export async function handlePreferences(chatId: ChatId, from: TelegramFromUser, messageId?: number) {
  const user = await userService.upsertFromTelegram(from);
  const pref = user.preference;

  if (!pref) {
    if (messageId) {
      await telegramClient.editMessageText({
        chatId,
        messageId,
        text: MSG.askCategory(),
        replyMarkup: { inline_keyboard: KB.categories() },
      });
    } else {
      await telegramClient.sendMessage({
        chatId,
        text: MSG.askCategory(),
        replyMarkup: { inline_keyboard: KB.categories() },
      });
    }
    return;
  }

  const categories = userService.parseArray(pref.categories);
  const expLevels = userService.parseArray(pref.experienceLevels);
  const locations = userService.parseArray(pref.locations);

  const text = MSG.preferences(categories, expLevels, locations, user.notificationsPaused);
  const replyMarkup = { inline_keyboard: KB.preferencesActions(user.notificationsPaused) };

  if (messageId) {
    await telegramClient.editMessageText({
      chatId,
      messageId,
      text,
      replyMarkup,
    });
  } else {
    await telegramClient.sendMessage({
      chatId,
      text,
      replyMarkup,
    });
  }
}

// ── /jobs (Paginated 1 card at a time) ────────────────────────────────────────

export async function handleJobs(
  chatId: ChatId,
  from: TelegramFromUser,
  options?: { messageId?: number; page?: number }
) {
  // Use fast read-only lookup — /jobs is triggered frequently via pagination buttons
  const user = await getUser(from);
  const pref = user.preference;

  const preferences = {
    categories: userService.parseArray(pref?.categories),
    experienceLevels: userService.parseArray(pref?.experienceLevels),
    locations: userService.parseArray(pref?.locations),
  };

  const jobs = await jobBrowseService.getRelevantJobs(preferences, 10);
  const messageId = options?.messageId;

  if (jobs.length === 0) {
    if (messageId) {
      await telegramClient.editMessageText({
        chatId,
        messageId,
        text: MSG.noJobsFound(),
        replyMarkup: { inline_keyboard: KB.backToMenu() },
      });
    } else {
      await telegramClient.sendMessage({
        chatId,
        text: MSG.noJobsFound(),
        replyMarkup: { inline_keyboard: KB.backToMenu() },
      });
    }
    return;
  }

  const page = Math.max(0, Math.min(options?.page ?? 0, jobs.length - 1));
  const currentJob = jobs[page];

  // Track interaction asynchronously
  userService.trackInteraction(user.id, currentJob.id, "JOB_VIEWED").catch(() => null);

  const isSaved = !!(await db.savedJob.findFirst({
    where: { userId: user.id, jobId: currentJob.id },
  }));

  const applyUrl = currentJob.applicationUrl || currentJob.sourceUrl;
  const text = MSG.jobCard(currentJob, page + 1, jobs.length);
  const replyMarkup = {
    inline_keyboard: KB.paginatedJobActions(currentJob.id, applyUrl, isSaved, page, jobs.length),
  };

  if (messageId) {
    await telegramClient.editMessageText({
      chatId,
      messageId,
      text,
      replyMarkup,
    });
  } else {
    await telegramClient.sendMessage({
      chatId,
      text,
      replyMarkup,
    });
  }
}

// ── /saved (Paginated 1 card at a time) ───────────────────────────────────────

export async function handleSaved(
  chatId: ChatId,
  from: TelegramFromUser,
  options?: { messageId?: number; page?: number }
) {
  // Use fast read-only lookup — /saved is triggered frequently via pagination buttons
  const user = await getUser(from);
  const saved = await userService.getSavedJobs(user.id);
  const messageId = options?.messageId;

  if (saved.length === 0) {
    if (messageId) {
      await telegramClient.editMessageText({
        chatId,
        messageId,
        text: MSG.savedJobs(0),
        replyMarkup: { inline_keyboard: KB.backToMenu() },
      });
    } else {
      await telegramClient.sendMessage({
        chatId,
        text: MSG.savedJobs(0),
        replyMarkup: { inline_keyboard: KB.backToMenu() },
      });
    }
    return;
  }

  const page = Math.max(0, Math.min(options?.page ?? 0, saved.length - 1));
  const currentItem = saved[page];
  const currentJob = currentItem.job;

  const applyUrl = currentJob.applicationUrl || currentJob.sourceUrl;
  const text = MSG.savedJobCard(currentJob, page + 1, saved.length);
  const replyMarkup = {
    inline_keyboard: KB.paginatedSavedJobActions(currentJob.id, applyUrl, page, saved.length),
  };

  if (messageId) {
    await telegramClient.editMessageText({
      chatId,
      messageId,
      text,
      replyMarkup,
    });
  } else {
    await telegramClient.sendMessage({
      chatId,
      text,
      replyMarkup,
    });
  }
}

// ── /notifications ────────────────────────────────────────────────────────────

export async function handleNotifications(chatId: ChatId, from: TelegramFromUser, messageId?: number) {
  const user = await userService.upsertFromTelegram(from);
  const text = MSG.notificationStatus(user.notificationsPaused);
  const replyMarkup = { inline_keyboard: KB.notificationToggle(user.notificationsPaused) };

  if (messageId) {
    await telegramClient.editMessageText({
      chatId,
      messageId,
      text,
      replyMarkup,
    });
  } else {
    await telegramClient.sendMessage({
      chatId,
      text,
      replyMarkup,
    });
  }
}

// ── /pause ────────────────────────────────────────────────────────────────────

export async function handlePause(chatId: ChatId, from: TelegramFromUser, messageId?: number) {
  const user = await userService.upsertFromTelegram(from);
  await userService.pauseNotifications(user.id);
  const text = MSG.pauseConfirm();
  const replyMarkup = { inline_keyboard: KB.notificationToggle(true) };

  if (messageId) {
    await telegramClient.editMessageText({
      chatId,
      messageId,
      text,
      replyMarkup,
    });
  } else {
    await telegramClient.sendMessage({
      chatId,
      text,
      replyMarkup,
    });
  }
}

// ── /resume ───────────────────────────────────────────────────────────────────

export async function handleResume(chatId: ChatId, from: TelegramFromUser, messageId?: number) {
  const user = await userService.upsertFromTelegram(from);
  await userService.resumeNotifications(user.id);
  const text = MSG.resumeConfirm();
  const replyMarkup = { inline_keyboard: KB.notificationToggle(false) };

  if (messageId) {
    await telegramClient.editMessageText({
      chatId,
      messageId,
      text,
      replyMarkup,
    });
  } else {
    await telegramClient.sendMessage({
      chatId,
      text,
      replyMarkup,
    });
  }
}

// ── /help ─────────────────────────────────────────────────────────────────────

export async function handleHelp(chatId: ChatId, messageId?: number) {
  const text = MSG.help();
  const replyMarkup = { inline_keyboard: KB.backToMenu() };

  if (messageId) {
    await telegramClient.editMessageText({
      chatId,
      messageId,
      text,
      replyMarkup,
    });
  } else {
    await telegramClient.sendMessage({
      chatId,
      text,
      replyMarkup,
    });
  }
}

// ── Callback Query Dispatcher ──────────────────────────────────────────────────

export async function handleCallbackQuery(
  callbackQueryId: string,
  chatId: ChatId,
  from: TelegramFromUser,
  data: string,
  messageId?: number
) {
  // ── No-op callbacks (e.g. pagination label "2/5") ──
  if (data === "noop") {
    await telegramClient.answerCallbackQuery({ callbackQueryId });
    return;
  }

  // ── Command shortcuts via buttons ──
  if (data === "cmd:jobs") {
    await telegramClient.answerCallbackQuery({ callbackQueryId });
    return handleJobs(chatId, from, { messageId });
  }
  if (data === "cmd:preferences") {
    await telegramClient.answerCallbackQuery({ callbackQueryId });
    return handlePreferences(chatId, from, messageId);
  }
  if (data === "cmd:saved") {
    await telegramClient.answerCallbackQuery({ callbackQueryId });
    return handleSaved(chatId, from, { messageId });
  }
  if (data === "cmd:notifications") {
    await telegramClient.answerCallbackQuery({ callbackQueryId });
    return handleNotifications(chatId, from, messageId);
  }
  if (data === "cmd:pause") {
    await telegramClient.answerCallbackQuery({
      callbackQueryId,
      text: "Job alerts paused ⏸",
      showAlert: false,
    });
    return handlePause(chatId, from, messageId);
  }
  if (data === "cmd:resume") {
    await telegramClient.answerCallbackQuery({
      callbackQueryId,
      text: "Job alerts resumed 🔔",
      showAlert: false,
    });
    return handleResume(chatId, from, messageId);
  }
  if (data === "cmd:help") {
    await telegramClient.answerCallbackQuery({ callbackQueryId });
    return handleHelp(chatId, messageId);
  }
  if (data === "cmd:menu") {
    await telegramClient.answerCallbackQuery({ callbackQueryId });
    return handleStart(chatId, from, messageId);
  }

  // ── Preference editing screens ──
  if (data === "edit:cat") {
    await telegramClient.answerCallbackQuery({ callbackQueryId });
    if (messageId) {
      await telegramClient.editMessageText({
        chatId,
        messageId,
        text: MSG.editCategory(),
        replyMarkup: { inline_keyboard: KB.categories() },
      });
    } else {
      await telegramClient.sendMessage({
        chatId,
        text: MSG.editCategory(),
        replyMarkup: { inline_keyboard: KB.categories() },
      });
    }
    return;
  }
  if (data === "edit:exp") {
    await telegramClient.answerCallbackQuery({ callbackQueryId });
    if (messageId) {
      await telegramClient.editMessageText({
        chatId,
        messageId,
        text: MSG.editExperience(),
        replyMarkup: { inline_keyboard: KB.experienceLevels() },
      });
    } else {
      await telegramClient.sendMessage({
        chatId,
        text: MSG.editExperience(),
        replyMarkup: { inline_keyboard: KB.experienceLevels() },
      });
    }
    return;
  }
  if (data === "edit:loc") {
    await telegramClient.answerCallbackQuery({ callbackQueryId });
    if (messageId) {
      await telegramClient.editMessageText({
        chatId,
        messageId,
        text: MSG.editLocation(),
        replyMarkup: { inline_keyboard: KB.locations() },
      });
    } else {
      await telegramClient.sendMessage({
        chatId,
        text: MSG.editLocation(),
        replyMarkup: { inline_keyboard: KB.locations() },
      });
    }
    return;
  }

  // ── Pagination navigation ──
  if (data.startsWith("job:page:")) {
    const page = parseInt(data.replace("job:page:", ""), 10);
    await telegramClient.answerCallbackQuery({ callbackQueryId });
    return handleJobs(chatId, from, { messageId, page });
  }

  if (data.startsWith("saved:page:")) {
    const page = parseInt(data.replace("saved:page:", ""), 10);
    await telegramClient.answerCallbackQuery({ callbackQueryId });
    return handleSaved(chatId, from, { messageId, page });
  }

  // ── Save Job action (Toggle state in-place + native toast banner) ──
  if (data.startsWith("job:save:")) {
    const parts = data.split(":");
    const jobId = parts[2];
    const pageStr = parts[3] ?? "0";

    const user = await getUser(from);
    const alreadySaved = await db.savedJob.findFirst({ where: { userId: user.id, jobId } });
    if (!alreadySaved) {
      await userService.saveJob(user.id, jobId);
    }

    // Show brief subtle native toast popup
    await telegramClient.answerCallbackQuery({
      callbackQueryId,
      text: "Job saved! 💾",
      showAlert: false,
    });

    // Update button in place to "Saved ✓"
    if (messageId) {
      if (pageStr === "alert") {
        const job = await db.job.findUnique({ where: { id: jobId } });
        const appUrl = job?.applicationUrl || job?.sourceUrl;
        await telegramClient.editMessageReplyMarkup({
          chatId,
          messageId,
          replyMarkup: { inline_keyboard: KB.jobAlertActions(jobId, appUrl, true) },
        });
      } else {
        const page = parseInt(pageStr, 10) || 0;
        const pref = user.preference;
        const preferences = {
          categories: userService.parseArray(pref?.categories),
          experienceLevels: userService.parseArray(pref?.experienceLevels),
          locations: userService.parseArray(pref?.locations),
        };
        const jobs = await jobBrowseService.getRelevantJobs(preferences, 10);
        const job = jobs[page] || (await db.job.findUnique({ where: { id: jobId } }));
        const applyUrl = job?.applicationUrl || job?.sourceUrl;
        await telegramClient.editMessageReplyMarkup({
          chatId,
          messageId,
          replyMarkup: {
            inline_keyboard: KB.paginatedJobActions(jobId, applyUrl, true, page, jobs.length || 1),
          },
        });
      }
    }
    return;
  }

  // ── Unsave Job from browse card / alert (Toggle state in-place + native toast banner) ──
  if (data.startsWith("job:unsave:")) {
    const parts = data.split(":");
    const jobId = parts[2];
    const pageStr = parts[3] ?? "0";

    const user = await getUser(from);
    await userService.unsaveJob(user.id, jobId);

    // Show brief subtle native toast popup
    await telegramClient.answerCallbackQuery({
      callbackQueryId,
      text: "Removed from saved list ❌",
      showAlert: false,
    });

    // Update button in place to "💾 Save Job"
    if (messageId) {
      if (pageStr === "alert") {
        const job = await db.job.findUnique({ where: { id: jobId } });
        const appUrl = job?.applicationUrl || job?.sourceUrl;
        await telegramClient.editMessageReplyMarkup({
          chatId,
          messageId,
          replyMarkup: { inline_keyboard: KB.jobAlertActions(jobId, appUrl, false) },
        });
      } else {
        const page = parseInt(pageStr, 10) || 0;
        const pref = user.preference;
        const preferences = {
          categories: userService.parseArray(pref?.categories),
          experienceLevels: userService.parseArray(pref?.experienceLevels),
          locations: userService.parseArray(pref?.locations),
        };
        const jobs = await jobBrowseService.getRelevantJobs(preferences, 10);
        const job = jobs[page] || (await db.job.findUnique({ where: { id: jobId } }));
        const applyUrl = job?.applicationUrl || job?.sourceUrl;
        await telegramClient.editMessageReplyMarkup({
          chatId,
          messageId,
          replyMarkup: {
            inline_keyboard: KB.paginatedJobActions(jobId, applyUrl, false, page, jobs.length || 1),
          },
        });
      }
    }
    return;
  }

  // ── Unsave Job from Saved Jobs view ──
  if (data.startsWith("saved:unsave:")) {
    const parts = data.split(":");
    const jobId = parts[2];
    const page = parseInt(parts[3] ?? "0", 10);

    const user = await getUser(from);
    await userService.unsaveJob(user.id, jobId);

    await telegramClient.answerCallbackQuery({
      callbackQueryId,
      text: "Removed from saved list ❌",
      showAlert: false,
    });

    // Refresh the paginated saved list in place
    return handleSaved(chatId, from, { messageId, page });
  }

  // ── Preference setting callbacks: pref:cat:<id> | pref:exp:<id> | pref:loc:<id> ──
  if (data.startsWith("pref:")) {
    await handlePreferenceCallback(chatId, from, data, messageId, callbackQueryId);
    return;
  }
}

// ── Preference Selection Handlers (Clean in-place state transitions) ───────────

async function handlePreferenceCallback(
  chatId: ChatId,
  from: TelegramFromUser,
  data: string,
  messageId?: number,
  callbackQueryId?: string
) {
  const user = await userService.upsertFromTelegram(from);
  const parts = data.split(":");
  const axis = parts[1];
  const value = parts[2];

  if (callbackQueryId) {
    await telegramClient.answerCallbackQuery({
      callbackQueryId,
      text: "Preference updated! ✅",
      showAlert: false,
    });
  }

  if (axis === "cat") {
    await userService.upsertPreference(user.id, { categories: [value] });
    const freshUser = await userService.getByTelegramId(String(from.id));
    const hasExp = !!userService.parseArray(freshUser?.preference?.experienceLevels).length;

    if (!hasExp) {
      // Continuing onboarding: transition to step 2
      const stepText = `🗂 Category set to <b>${formatCategoryLabels(value)}</b>\n\n${MSG.askExperienceLevel()}`;
      const replyMarkup = { inline_keyboard: KB.experienceLevels() };
      if (messageId) {
        await telegramClient.editMessageText({ chatId, messageId, text: stepText, replyMarkup });
      } else {
        await telegramClient.sendMessage({ chatId, text: stepText, replyMarkup });
      }
    } else {
      // Return to full preferences menu in place
      await handlePreferences(chatId, from, messageId);
    }
    return;
  }

  if (axis === "exp") {
    await userService.upsertPreference(user.id, { experienceLevels: [value] });
    const freshUser = await userService.getByTelegramId(String(from.id));
    const hasLoc = !!userService.parseArray(freshUser?.preference?.locations).length;

    if (!hasLoc) {
      // Continuing onboarding: transition to step 3
      const stepText = `🎯 Experience set to <b>${formatExperienceLabel(value)}</b>\n\n${MSG.askLocation()}`;
      const replyMarkup = { inline_keyboard: KB.locations() };
      if (messageId) {
        await telegramClient.editMessageText({ chatId, messageId, text: stepText, replyMarkup });
      } else {
        await telegramClient.sendMessage({ chatId, text: stepText, replyMarkup });
      }
    } else {
      // Return to full preferences menu in place
      await handlePreferences(chatId, from, messageId);
    }
    return;
  }

  if (axis === "loc") {
    const locationsToSave = value === "any" ? [] : [value];
    await userService.upsertPreference(user.id, { locations: locationsToSave });

    const freshUser = await userService.getByTelegramId(String(from.id));
    const cats = userService.parseArray(freshUser?.preference?.categories);
    const exps = userService.parseArray(freshUser?.preference?.experienceLevels);
    const completedOnboarding = cats.length > 0 && exps.length > 0;

    if (completedOnboarding) {
      const categoryLabel = formatCategoryLabels(cats);
      const expLabel = formatExperienceLabel(exps[0]);
      const locationLabel = value === "any" ? "Anywhere in Ethiopia" : formatLocationLabel(value);

      const completeText = MSG.onboardingComplete(categoryLabel, expLabel, locationLabel);
      const replyMarkup = { inline_keyboard: KB.mainMenu() };

      if (messageId) {
        await telegramClient.editMessageText({ chatId, messageId, text: completeText, replyMarkup });
      } else {
        await telegramClient.sendMessage({ chatId, text: completeText, replyMarkup });
      }
    } else {
      await handlePreferences(chatId, from, messageId);
    }
    return;
  }
}

