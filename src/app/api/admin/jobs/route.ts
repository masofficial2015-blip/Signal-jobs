import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { notificationDispatcher } from "@/services/notifications/notifier";
import { invalidateBrowseCache } from "@/services/telegram/jobBrowseService";

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const query = searchParams.get("q");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "15", 10);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }
    if (category && category !== "ALL") {
      where.category = { contains: category, mode: "insensitive" };
    }
    if (query) {
      where.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { company: { contains: query, mode: "insensitive" } },
        { location: { contains: query, mode: "insensitive" } },
        { category: { contains: query, mode: "insensitive" } },
        { profession: { contains: query, mode: "insensitive" } },
      ];
    }

    const [jobs, total] = await Promise.all([
      db.job.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.job.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      jobs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("GET Jobs API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      company,
      location,
      category,
      profession,
      employmentType,
      experienceLevel,
      minExperienceYears,
      maxExperienceYears,
      education,
      deadline,
      skills,
      summary,
      description,
      responsibilities,
      requirements,
      salary,
      applicationInstructions,
      applicationUrl,
      rawText,
      sourceName,
      sourceUrl,
      status, // "DRAFT" or "PUBLISHED"
    } = body;

    if (!title || !rawText) {
      return NextResponse.json(
        { error: "Job title and raw text are required fields." },
        { status: 400 }
      );
    }

    const isPublishing = status === "PUBLISHED" || !status;
    const jobStatus = "PUBLISHED";

    const job = await db.job.create({
      data: {
        title,
        company: company || null,
        location: location || null,
        // category stored as JSON array: ["technology", "engineering"]
        category: Array.isArray(category)
          ? JSON.stringify(category)
          : category
          ? (typeof category === "string" && category.startsWith("[") ? category : JSON.stringify([category]))
          : null,
        profession: profession || null,
        employmentType: employmentType || null,
        // experienceLevel stored as JSON array: ["graduate", "entry_level"]
        experienceLevel: Array.isArray(experienceLevel)
          ? JSON.stringify(experienceLevel)
          : Array.isArray(body.experienceLevels)
          ? JSON.stringify(body.experienceLevels)
          : experienceLevel
          ? (typeof experienceLevel === "string" && experienceLevel.startsWith("[") ? experienceLevel : JSON.stringify([experienceLevel]))
          : null,
        minExperienceYears: minExperienceYears !== undefined && minExperienceYears !== null ? Number(minExperienceYears) : null,
        maxExperienceYears: maxExperienceYears !== undefined && maxExperienceYears !== null ? Number(maxExperienceYears) : null,
        education: education || null,
        deadline: deadline ? new Date(deadline) : null,
        skills: JSON.stringify(Array.isArray(skills) ? skills : []),
        summary: summary || null,
        description: description || null,
        responsibilities: responsibilities || null,
        requirements: requirements || null,
        salary: salary || null,
        applicationInstructions: applicationInstructions || null,
        applicationUrl: applicationUrl || null,
        rawText,
        sourceName: sourceName || null,
        sourceUrl: sourceUrl || null,
        status: jobStatus,
        publishedAt: isPublishing ? new Date() : null,
      },
    });

    // Record admin action
    await db.adminLog.create({
      data: {
        adminId: session.adminId,
        action: isPublishing ? "PUBLISH_JOB" : "CREATE_DRAFT_JOB",
        details: `Job ID: ${job.id} (${job.title})`,
      },
    });

    // Dispatch notifications asynchronously (fire-and-forget).
    // The admin response returns immediately — notifications are sent in the background.
    if (isPublishing) {
      // Invalidate the bot's job browse cache so the new job is immediately visible
      invalidateBrowseCache();
      notificationDispatcher.dispatchJobNotificationsAsync(job.id);
    }

    return NextResponse.json({
      success: true,
      job,
      dispatching: isPublishing, // indicates background dispatch started
    });
  } catch (error: any) {
    console.error("POST Job API Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save job" },
      { status: 500 }
    );
  }
}
