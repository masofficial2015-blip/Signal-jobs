import { db } from "@/lib/db";
import {
  MONITORED_CHANNELS,
  MonitoredChannel,
  ScrapedTelegramPost,
  scrapeTelegramChannel,
} from "./telegramChannelScraper";
import { scrapeWebArticle } from "./webArticleScraper";
import { jobDeduplicator } from "./deduplicator";
import { aiJobExtractor } from "@/services/ai/gemini";
import { normalizeTaxonomyId } from "@/lib/taxonomy";

export interface IngestionRunSummary {
  startedAt: string;
  completedAt: string;
  channelsScanned: number;
  postsExamined: number;
  newDraftsCreated: number;
  duplicatesSkipped: number;
  channelResults: {
    channel: string;
    postsFound: number;
    draftsCreated: number;
    duplicates: number;
    error?: string;
  }[];
}

export class IngestionService {
  /**
   * Runs the ingestion pipeline across all enabled channels or a specific channel.
   */
  async runIngestion(
    targetChannels?: string[],
    postsPerChannel: number = 6
  ): Promise<IngestionRunSummary> {
    const startedAt = new Date().toISOString();
    let totalPostsExamined = 0;
    let totalNewDrafts = 0;
    let totalDuplicates = 0;

    const channelsToScan = MONITORED_CHANNELS.filter(
      (ch) => !targetChannels || targetChannels.includes(ch.username)
    );

    const channelResults: IngestionRunSummary["channelResults"] = [];

    for (const channel of channelsToScan) {
      console.log(`[Ingestion] Scanning @${channel.username}...`);
      let postsFound = 0;
      let draftsCreated = 0;
      let duplicates = 0;

      try {
        const posts = await scrapeTelegramChannel(channel.username, postsPerChannel);
        postsFound = posts.length;
        totalPostsExamined += postsFound;

        for (const post of posts) {
          const outcome = await this.processPost(post, channel);
          if (outcome.status === "created") {
            draftsCreated += outcome.count;
            totalNewDrafts += outcome.count;
          } else if (outcome.status === "duplicate") {
            duplicates++;
            totalDuplicates++;
          }
        }

        channelResults.push({
          channel: channel.displayName,
          postsFound,
          draftsCreated,
          duplicates,
        });
      } catch (err: any) {
        console.error(`[Ingestion] Error processing channel @${channel.username}:`, err);
        channelResults.push({
          channel: channel.displayName,
          postsFound,
          draftsCreated,
          duplicates,
          error: err?.message || "Unknown error",
        });
      }
    }

    return {
      startedAt,
      completedAt: new Date().toISOString(),
      channelsScanned: channelsToScan.length,
      postsExamined: totalPostsExamined,
      newDraftsCreated: totalNewDrafts,
      duplicatesSkipped: totalDuplicates,
      channelResults,
    };
  }

  /**
   * Processes a single scraped Telegram post.
   */
  private async processPost(
    post: ScrapedTelegramPost,
    channel: MonitoredChannel
  ): Promise<{ status: "created" | "duplicate" | "skipped" | "error"; count: number }> {
    try {
      // 1. Check if post URL has already been processed
      if (await jobDeduplicator.isUrlAlreadyProcessed(post.postUrl)) {
        return { status: "duplicate", count: 0 };
      }

      // Check external links for duplicate
      for (const link of post.externalLinks) {
        if (await jobDeduplicator.isUrlAlreadyProcessed(link)) {
          return { status: "duplicate", count: 0 };
        }
      }

      // 2. Enrich content: Follow teaser links if present
      let enrichedText = post.text;
      let primaryArticleUrl = post.externalLinks[0] || null;

      if (post.externalLinks.length > 0) {
        const articleText = await scrapeWebArticle(post.externalLinks[0]);
        if (articleText) {
          enrichedText = `${post.text}\n\n--- FULL ARTICLE DETAILS ---\n${articleText}`;
        }
      }

      // 3. Process image if text is sparse or image exists
      let base64Image: string | undefined = undefined;
      let mimeType: string | undefined = undefined;

      if (post.imageUrls.length > 0 && enrichedText.length < 150) {
        try {
          const imgRes = await fetch(post.imageUrls[0]);
          if (imgRes.ok) {
            const buf = await imgRes.arrayBuffer();
            base64Image = Buffer.from(buf).toString("base64");
            mimeType = imgRes.headers.get("content-type") || "image/jpeg";
          }
        } catch (imgErr) {
          console.warn(`[Ingestion] Failed to download image for ${post.postUrl}:`, imgErr);
        }
      }

      // If neither text nor image is usable, skip
      if (enrichedText.trim().length < 15 && !base64Image) {
        return { status: "skipped", count: 0 };
      }

      // 4. Run AI extraction
      const extractedPositions = await aiJobExtractor.extractJobDetails(
        enrichedText,
        channel.displayName,
        primaryArticleUrl || post.postUrl,
        base64Image,
        mimeType
      );

      if (!extractedPositions || extractedPositions.length === 0) {
        return { status: "skipped", count: 0 };
      }

      let createdForThisPost = 0;

      // 5. Deduplicate and save each position as DRAFT
      for (const pos of extractedPositions) {
        // Skip if title is empty
        if (!pos.title || pos.title.trim().length < 3) continue;

        const dupCheck = await jobDeduplicator.checkJobDuplicate(
          pos.title,
          pos.company || null,
          primaryArticleUrl || post.postUrl
        );

        if (dupCheck.isDuplicate) {
          console.log(`[Ingestion] Skipping duplicate: "${pos.title}" (${dupCheck.reason})`);
          continue;
        }

        // Normalize categories using centralized taxonomy
        const rawCategories = Array.isArray(pos.category) ? pos.category : pos.category ? [pos.category] : [];
        const normalizedCategories = rawCategories
          .map((c) => normalizeTaxonomyId(c))
          .filter(Boolean);

        const expLevel = Array.isArray(pos.experienceLevel)
          ? pos.experienceLevel
          : pos.experienceLevel
          ? [pos.experienceLevel]
          : [];

        await db.job.create({
          data: {
            title: pos.title.trim(),
            company: pos.company ? pos.company.trim() : null,
            location: pos.location || null,
            category: JSON.stringify(normalizedCategories),
            profession: pos.profession || null,
            employmentType: pos.employmentType || null,
            experienceLevel: JSON.stringify(expLevel),
            education: pos.education || null,
            deadline: pos.deadline ? new Date(pos.deadline) : null,
            skills: JSON.stringify(pos.skills || []),
            summary: pos.summary || null,
            description: pos.description || null,
            applicationUrl: pos.applicationUrl || primaryArticleUrl || post.postUrl,
            rawText: enrichedText,
            sourceName: channel.displayName,
            sourceUrl: post.postUrl,
            status: "DRAFT", // saved safely in DRAFT status for 1-click admin review
          },
        });

        createdForThisPost++;
      }

      return {
        status: createdForThisPost > 0 ? "created" : "duplicate",
        count: createdForThisPost,
      };
    } catch (error: any) {
      console.error(`[Ingestion] Failed to process post ${post.postUrl}:`, error?.message || error);
      return { status: "error", count: 0 };
    }
  }
}

export const ingestionService = new IngestionService();
