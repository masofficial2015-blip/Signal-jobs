import { z } from "zod";

export const RawJobInputSchema = z.object({
  rawText: z.string().min(10, "Job text must be at least 10 characters"),
  sourceUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

export const ExtractedJobSchema = z.object({
  title: z.string().min(2, "Job title is required"),
  company: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  employmentType: z.string().nullable().optional(),
  experienceLevel: z.string().nullable().optional(),
  education: z.string().nullable().optional(),
  skills: z.array(z.string()).default([]),
  summary: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
});

export const UpdateJobSchema = ExtractedJobSchema.extend({
  status: z.enum(["DRAFT", "REVIEWED", "PUBLISHED", "REJECTED", "EXPIRED"]).optional(),
});

export type RawJobInput = z.infer<typeof RawJobInputSchema>;
export type ExtractedJobInput = z.infer<typeof ExtractedJobSchema>;
export type UpdateJobInput = z.infer<typeof UpdateJobSchema>;
