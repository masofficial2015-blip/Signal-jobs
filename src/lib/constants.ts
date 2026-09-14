export const JOB_CATEGORIES = [
  { id: "agriculture", label: "Agriculture & Environment" },
  { id: "architecture", label: "Architecture & Construction" },
  { id: "business_admin", label: "Business & Administration" },
  { id: "education", label: "Education & training" },
  { id: "engineering", label: "Engineering" },
  { id: "finance_accounting", label: "Finance & Accounting" },
  { id: "healthcare", label: "Healthcare & Medicine" },
  { id: "hospitality", label: "Hospitality & Tourism" },
  { id: "marketing_sales", label: "Marketing & Sales" },
  { id: "media_communications", label: "Media & Communications" },
  { id: "ngo_development", label: "NGO & Development" },
  { id: "software_it", label: "Software & IT" },
  { id: "logistics_transport", label: "Transportation & Logistics" },
  { id: "other", label: "Other" },
] as const;

export const EXPERIENCE_LEVELS = [
  { id: "graduate", label: "Fresh Graduate (0 years)" },
  { id: "entry_level", label: "Entry Level (1-2 years)" },
  { id: "mid_level", label: "Mid Level (3-5 years)" },
  { id: "senior_level", label: "Senior Level (5+ years)" },
] as const;

export const EMPLOYMENT_TYPES = [
  { id: "full_time", label: "Full Time" },
  { id: "part_time", label: "Part Time" },
  { id: "contract", label: "Contract" },
  { id: "internship", label: "Internship" },
  { id: "remote", label: "Remote / Work From Home" },
] as const;

export const ETHIOPIAN_LOCATIONS = [
  { id: "addis_ababa", label: "Addis Ababa" },
  { id: "hawassa", label: "Hawassa" },
  { id: "adama", label: "Adama (Nazret)" },
  { id: "bahir_dar", label: "Bahir Dar" },
  { id: "dire_dawa", label: "Dire Dawa" },
  { id: "mekelle", label: "Mekelle" },
  { id: "gondar", label: "Gondar" },
  { id: "jimma", label: "Jimma" },
  { id: "remote", label: "Remote" },
] as const;

export const JOB_STATUSES = {
  DRAFT: "DRAFT",
  REVIEWED: "REVIEWED",
  PUBLISHED: "PUBLISHED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
} as const;

export const NOTIFICATION_STATUSES = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
} as const;
