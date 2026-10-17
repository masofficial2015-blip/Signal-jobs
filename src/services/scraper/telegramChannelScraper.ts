import * as cheerio from "cheerio";

export interface ScrapedTelegramPost {
  messageId: string;
  channelUsername: string;
  channelTitle: string;
  postUrl: string;
  text: string;
  externalLinks: string[];
  imageUrls: string[];
  publishedAt: Date;
}

export interface MonitoredChannel {
  username: string;
  displayName: string;
  enabled: boolean;
  type: "text" | "mixed" | "image";
}

export const MONITORED_CHANNELS: MonitoredChannel[] = [
  { username: "effoyjobs", displayName: "EffoyJobs", enabled: true, type: "mixed" },
  { username: "elelanajobs", displayName: "Elelanajobs", enabled: true, type: "mixed" },
  { username: "hahujobs", displayName: "HaHuJobs", enabled: true, type: "text" },
  { username: "gizejobs", displayName: "Gize Jobs", enabled: true, type: "mixed" },
  { username: "ethiojobsofficial", displayName: "Ethiojobs", enabled: true, type: "text" },
];

/**
 * Filter out obvious non-job posts (channel ads, crypto, forex, spam)
 */
export function isSpamOrNonJob(text: string): boolean {
  if (!text || text.trim().length < 20) return true;

  const lower = text.toLowerCase();

  const spamKeywords = [
    "forex",
    "crypto",
    "bitcoin",
    "trading signal",
    "earn money online",
    "vip channel",
    "ማስታወቂያ ለማስነገር",
    "contact admin for ad",
    "paid promo",
    "giveaway",
    "betting",
    "1xbet",
    "invest",
  ];

  for (const kw of spamKeywords) {
    if (lower.includes(kw)) return true;
  }

  // Must have at least one job-related signal
  const jobSignals = [
    "job",
    "vacancy",
    "position",
    "hiring",
    "deadline",
    "requirement",
    "qualification",
    "experience",
    "salary",
    "apply",
    "ደሞዝ",
    "የስራ",
    "ማስታወቂያ",
    "ተፈላጊ",
    "ክፍት",
    "ቦታ",
    "ድርጅት",
    "የምዝገባ",
    "ቀን",
  ];

  const hasSignal = jobSignals.some((sig) => lower.includes(sig));
  return !hasSignal;
}

/**
 * Scrapes the public web preview (t.me/s/<channel>) for a given Telegram channel.
 */
export async function scrapeTelegramChannel(
  channelUsername: string,
  limit: number = 10
): Promise<ScrapedTelegramPost[]> {
  try {
    const cleanUsername = channelUsername.replace(/^@/, "");
    const url = `https://t.me/s/${cleanUsername}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[TelegramScraper] Failed to fetch channel @${cleanUsername}: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const channelTitle =
      $('meta[property="og:title"]').attr("content") ||
      $(".tgme_channel_info_header_title").text().trim() ||
      cleanUsername;

    const posts: ScrapedTelegramPost[] = [];

    $(".tgme_widget_message_wrap").each((_, wrap) => {
      const $wrap = $(wrap);
      const $msg = $wrap.find(".tgme_widget_message");
      const dataPost = $msg.attr("data-post");
      if (!dataPost) return;

      const [channel, messageId] = dataPost.split("/");
      const postUrl = `https://t.me/${dataPost}`;

      const $textElem = $msg.find(".tgme_widget_message_text");
      const text = $textElem.text().trim();

      // Extract external links (exclude internal t.me links)
      const externalLinks: string[] = [];
      $textElem.find("a").each((_, a) => {
        const href = $(a).attr("href");
        if (href && !href.includes("t.me/") && !href.includes("telegram.org")) {
          externalLinks.push(href);
        }
      });

      // Extract image background URLs
      const imageUrls: string[] = [];
      $msg.find(".tgme_widget_message_photo_wrap").each((_, photo) => {
        const style = $(photo).attr("style") || "";
        const match = style.match(/background-image:url\('([^']+)'\)/);
        if (match && match[1]) {
          imageUrls.push(match[1]);
        }
      });

      const timeStr = $msg.find("time").attr("datetime");
      const publishedAt = timeStr ? new Date(timeStr) : new Date();

      // Skip empty or pure spam
      if (text.length > 0 && isSpamOrNonJob(text) && imageUrls.length === 0) {
        return;
      }

      if (text.length > 0 || imageUrls.length > 0) {
        posts.push({
          messageId,
          channelUsername: cleanUsername,
          channelTitle,
          postUrl,
          text,
          externalLinks,
          imageUrls,
          publishedAt,
        });
      }
    });

    // Return the latest N posts (Telegram lists them in chronological order)
    return posts.slice(-limit);
  } catch (error: any) {
    console.error(`[TelegramScraper] Error scraping @${channelUsername}:`, error?.message || error);
    return [];
  }
}
