import { z } from "zod";

export const UserPreferenceSchema = z.object({
  categories: z.array(z.string()).default([]),
  experienceLevels: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  employmentTypes: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
});

export const UserRegistrationSchema = z.object({
  telegramId: z.string().min(1),
  telegramUsername: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export type UserPreferenceInput = z.infer<typeof UserPreferenceSchema>;
export type UserRegistrationInput = z.infer<typeof UserRegistrationSchema>;
