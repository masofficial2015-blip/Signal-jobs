import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { notificationDispatcher } from "@/services/notifications/notifier";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const job = await db.job.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, job });
  } catch (error) {
    console.error("GET Single Job Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existingJob = await db.job.findUnique({ where: { id } });

    if (!existingJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const body = await req.json();
    const isNowPublishing = body.status === "PUBLISHED" && existingJob.status !== "PUBLISHED";

    const updatedJob = await db.job.update({
      where: { id },
      data: {
        title: body.title !== undefined ? body.title : existingJob.title,
        company: body.company !== undefined ? body.company : existingJob.company,
        location: body.location !== undefined ? body.location : existingJob.location,
        category: Array.isArray(body.category)
          ? JSON.stringify(body.category)
          : body.category !== undefined
          ? (typeof body.category === "string" && body.category.startsWith("[") ? body.category : JSON.stringify([body.category]))
          : existingJob.category,
        profession: body.profession !== undefined ? body.profession : existingJob.profession,
        employmentType: body.employmentType !== undefined ? body.employmentType : existingJob.employmentType,
        experienceLevel: Array.isArray(body.experienceLevel)
          ? JSON.stringify(body.experienceLevel)
          : Array.isArray(body.experienceLevels)
          ? JSON.stringify(body.experienceLevels)
          : body.experienceLevel !== undefined
          ? (typeof body.experienceLevel === "string" && body.experienceLevel.startsWith("[") ? body.experienceLevel : JSON.stringify([body.experienceLevel]))
          : existingJob.experienceLevel,
        minExperienceYears: body.minExperienceYears !== undefined ? (body.minExperienceYears !== null ? Number(body.minExperienceYears) : null) : existingJob.minExperienceYears,
        maxExperienceYears: body.maxExperienceYears !== undefined ? (body.maxExperienceYears !== null ? Number(body.maxExperienceYears) : null) : existingJob.maxExperienceYears,
        education: body.education !== undefined ? body.education : existingJob.education,
        skills: body.skills !== undefined ? JSON.stringify(Array.isArray(body.skills) ? body.skills : []) : existingJob.skills,
        summary: body.summary !== undefined ? body.summary : existingJob.summary,
        description: body.description !== undefined ? body.description : existingJob.description,
        responsibilities: body.responsibilities !== undefined ? body.responsibilities : existingJob.responsibilities,
        requirements: body.requirements !== undefined ? body.requirements : existingJob.requirements,
        salary: body.salary !== undefined ? body.salary : existingJob.salary,
        applicationInstructions: body.applicationInstructions !== undefined ? body.applicationInstructions : existingJob.applicationInstructions,
        applicationUrl: body.applicationUrl !== undefined ? body.applicationUrl : existingJob.applicationUrl,
        sourceName: body.sourceName !== undefined ? body.sourceName : existingJob.sourceName,
        sourceUrl: body.sourceUrl !== undefined ? body.sourceUrl : existingJob.sourceUrl,
        status: body.status || existingJob.status,
        publishedAt: isNowPublishing ? new Date() : existingJob.publishedAt,
      },
    });

    // Record admin log action
    await db.adminLog.create({
      data: {
        adminId: session.adminId,
        action: isNowPublishing ? "PUBLISH_JOB" : "UPDATE_JOB",
        details: `Job ID: ${id} (${updatedJob.title})`,
      },
    });

    // Dispatch notifications async (fire-and-forget) — do not block the HTTP response
    if (isNowPublishing) {
      notificationDispatcher.dispatchJobNotificationsAsync(id);
    }

    return NextResponse.json({ success: true, job: updatedJob, dispatching: isNowPublishing });
  } catch (error: any) {
    console.error("PUT Job API Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to update job" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await db.job.delete({ where: { id } });

    await db.adminLog.create({
      data: {
        adminId: session.adminId,
        action: "DELETE_JOB",
        details: `Deleted Job ID: ${id}`,
      },
    });

    return NextResponse.json({ success: true, message: "Job deleted successfully" });
  } catch (error) {
    console.error("DELETE Job API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
