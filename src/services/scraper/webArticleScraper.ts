import * as cheerio from "cheerio";

/**
 * Web Article Scraper
 * Follows teaser links in Telegram posts (e.g. effoysira.com, elelanajobs.com, gizejobs.com)
 * and extracts clean article text.
 */
export async function scrapeWebArticle(url: string): Promise<string | null> {
  try {
    const parsedUrl = new URL(url);

    // Skip non-HTTP(S) and telegram internal links
    if (!["http:", "https:"].includes(parsedUrl.protocol)) return null;
    if (parsedUrl.hostname.includes("t.me") || parsedUrl.hostname.includes("telegram.org")) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12 second timeout

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
      console.warn(`[WebScraper] Failed to fetch article ${url}: status ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove irrelevant elements
    $(
      "script, style, noscript, nav, header, footer, aside, .sidebar, .comments, .related-posts, .share-buttons, .menu, form, iframe"
    ).remove();

    // Look for article containers commonly used by WordPress / job boards
    let content = "";
    const selectors = [
      "article",
      ".entry-content",
      ".post-content",
      ".job-description",
      ".job-details",
      ".single-post",
      "main",
      "#content",
    ];

    for (const sel of selectors) {
      const match = $(sel).first();
      if (match.length > 0) {
        const text = match.text().replace(/\s+/g, " ").trim();
        if (text.length > 200) {
          content = text;
          break;
        }
      }
    }

    // Fallback to body text if no specific article container found
    if (!content) {
      content = $("body").text().replace(/\s+/g, " ").trim();
    }

    // Trim very long texts to reasonable context window (max ~4,000 characters)
    return content.length > 100 ? content.slice(0, 5000) : null;
  } catch (error: any) {
    console.warn(`[WebScraper] Error scraping article ${url}:`, error?.message || error);
    return null;
  }
}
