export interface Subcategory {
  id: string;
  label: string;
  aliases?: string[];
}

export interface Category {
  id: string;
  label: string;
  aliases?: string[];
  subcategories?: Subcategory[];
}

export const TAXONOMY: Category[] = [
  {
    id: "agriculture",
    label: "Agriculture & Environment",
    aliases: ["agriculture_environment", "agriculture", "environment", "agri"],
  },
  {
    id: "architecture",
    label: "Architecture & Construction",
    aliases: ["architecture_construction", "architecture", "construction", "building"],
  },
  {
    id: "business_admin",
    label: "Business & Administration",
    aliases: ["business", "business_administration", "business_admin", "admin", "management", "administration"],
  },
  {
    id: "education",
    label: "Education & Training",
    aliases: ["education_training", "education", "training", "teaching", "academic"],
  },
  {
    id: "engineering",
    label: "Engineering",
    aliases: ["engineering", "engineer"],
    subcategories: [
      {
        id: "mechanical_engineering",
        label: "Mechanical Engineering",
        aliases: ["mechanical", "mech_engineering", "mech_eng", "mechanical_engineer"],
      },
      {
        id: "civil_engineering",
        label: "Civil Engineering",
        aliases: ["civil", "civil_eng", "civil_engineer", "structural_engineering"],
      },
      {
        id: "electrical_engineering",
        label: "Electrical Engineering",
        aliases: ["electrical", "electrical_eng", "electrical_engineer", "power_engineering", "electronics"],
      },
      {
        id: "chemical_engineering",
        label: "Chemical Engineering",
        aliases: ["chemical", "chemical_eng", "chemical_engineer", "process_engineering"],
      },
    ],
  },
  {
    id: "finance_accounting",
    label: "Finance & Accounting",
    aliases: ["finance", "accounting", "finance_accounting", "banking", "audit", "accountant"],
  },
  {
    id: "healthcare",
    label: "Healthcare & Medicine",
    aliases: ["health", "healthcare", "medicine", "medical", "clinical"],
    subcategories: [
      {
        id: "clinical_doctors",
        label: "Clinical Specialists & Doctors",
        aliases: [
          "clinical_specialists_doctors",
          "clinical_specialists",
          "doctors",
          "doctor",
          "physician",
          "general_practitioner",
          "specialist",
          "surgeon",
        ],
      },
      {
        id: "pharmacy_lab",
        label: "Pharmacy & Laboratory",
        aliases: [
          "pharmacy_laboratory",
          "pharmacy",
          "pharmacist",
          "druggist",
          "laboratory",
          "lab",
          "medical_laboratory",
          "lab_technician",
        ],
      },
      {
        id: "nursing_midwifery",
        label: "Nursing & Midwifery",
        aliases: [
          "nursing",
          "midwifery",
          "nurse",
          "midwife",
          "clinical_nurse",
          "staff_nurse",
        ],
      },
      {
        id: "public_health_admin",
        label: "Public Health & Admin",
        aliases: [
          "public_health",
          "health_officer",
          "public_health_admin",
          "health_admin",
          "healthcare_administration",
          "epidemiology",
        ],
      },
    ],
  },
  {
    id: "hospitality",
    label: "Hospitality & Tourism",
    aliases: ["hospitality_tourism", "hospitality", "tourism", "hotel", "restaurant", "catering"],
  },
  {
    id: "marketing_sales",
    label: "Marketing & Sales",
    aliases: ["marketing_sales", "marketing", "sales", "commercial", "business_development"],
  },
  {
    id: "media_communications",
    label: "Media & Communications",
    aliases: ["media_communications", "media", "communications", "journalism", "pr", "public_relations"],
  },
  {
    id: "ngo_development",
    label: "NGO & Development",
    aliases: ["ngo_development", "ngo", "development", "humanitarian", "non_profit", "un"],
  },
  {
    id: "software_it",
    label: "Software & IT",
    aliases: [
      "technology",
      "tech",
      "it",
      "software & it",
      "software_and_it",
      "software",
      "software_it",
      "computer_science",
      "information_technology",
    ],
  },
  {
    id: "logistics_transport",
    label: "Transportation & Logistics",
    aliases: [
      "logistics_transport",
      "transportation",
      "logistics",
      "transportation & logistics",
      "transport",
      "supply_chain",
      "procurement",
      "driver",
    ],
  },
];

// Top-level categories formatted for backward-compatible array usage
export const JOB_CATEGORIES = TAXONOMY.map((c) => ({
  id: c.id,
  label: c.label,
}));

// Build comprehensive alias map
export const CATEGORY_ALIASES: Record<string, string> = {};

TAXONOMY.forEach((cat) => {
  CATEGORY_ALIASES[cat.id.toLowerCase()] = cat.id;
  CATEGORY_ALIASES[cat.label.toLowerCase()] = cat.id;
  cat.aliases?.forEach((alias) => {
    CATEGORY_ALIASES[alias.toLowerCase()] = cat.id;
    CATEGORY_ALIASES[alias.toLowerCase().replace(/[\s-]+/g, "_")] = cat.id;
  });

  cat.subcategories?.forEach((sub) => {
    CATEGORY_ALIASES[sub.id.toLowerCase()] = sub.id;
    CATEGORY_ALIASES[sub.label.toLowerCase()] = sub.id;
    sub.aliases?.forEach((alias) => {
      CATEGORY_ALIASES[alias.toLowerCase()] = sub.id;
      CATEGORY_ALIASES[alias.toLowerCase().replace(/[\s-]+/g, "_")] = sub.id;
    });
  });
});

/**
 * Returns all top-level categories.
 */
export function getAllCategories(): Category[] {
  return TAXONOMY;
}

/**
 * Returns all subcategories across all categories.
 */
export function getAllSubcategories(): (Subcategory & { parentCategoryId: string })[] {
  const subs: (Subcategory & { parentCategoryId: string })[] = [];
  TAXONOMY.forEach((cat) => {
    cat.subcategories?.forEach((sub) => {
      subs.push({ ...sub, parentCategoryId: cat.id });
    });
  });
  return subs;
}

/**
 * Returns subcategories for a given category ID or alias.
 */
export function getSubcategoriesForCategory(categoryId: string): Subcategory[] {
  const normalized = normalizeTaxonomyId(categoryId);
  const cat = TAXONOMY.find((c) => c.id === normalized);
  return cat?.subcategories || [];
}

/**
 * Returns the parent category of a subcategory ID.
 */
export function getParentCategory(subcategoryId: string): Category | null {
  const normalized = normalizeTaxonomyId(subcategoryId);
  for (const cat of TAXONOMY) {
    if (cat.subcategories?.some((s) => s.id === normalized)) {
      return cat;
    }
  }
  return null;
}

/**
 * Checks if a given ID represents a subcategory.
 */
export function isSubcategory(id: string): boolean {
  const normalized = normalizeTaxonomyId(id);
  return getAllSubcategories().some((s) => s.id === normalized);
}

/**
 * Checks if a given ID represents a top-level category.
 */
export function isTopLevelCategory(id: string): boolean {
  const normalized = normalizeTaxonomyId(id);
  return TAXONOMY.some((c) => c.id === normalized);
}

/**
 * Normalizes any category or subcategory string/alias to its canonical taxonomy ID.
 */
export function normalizeTaxonomyId(id: string | null | undefined): string {
  if (!id) return "other";
  const clean = id.trim().toLowerCase();
  const underscore = clean.replace(/[\s-]+/g, "_");

  if (CATEGORY_ALIASES[clean]) return CATEGORY_ALIASES[clean];
  if (CATEGORY_ALIASES[underscore]) return CATEGORY_ALIASES[underscore];

  // Direct match against taxonomy IDs
  for (const cat of TAXONOMY) {
    if (cat.id === clean || cat.id === underscore) return cat.id;
    for (const sub of cat.subcategories || []) {
      if (sub.id === clean || sub.id === underscore) return sub.id;
    }
  }

  return underscore;
}

/**
 * For backward compatibility with existing code calling normalizeCategoryId.
 */
export const normalizeCategoryId = normalizeTaxonomyId;

/**
 * Formats a single taxonomy ID into a human-readable display label.
 * If includeParent is true and it's a subcategory, displays "Parent Category (Subcategory)".
 */
export function formatTaxonomyItemLabel(id: string, includeParent = false): string {
  const normalized = normalizeTaxonomyId(id);

  // Check top-level category
  const cat = TAXONOMY.find((c) => c.id === normalized);
  if (cat) return cat.label;

  // Check subcategory
  for (const c of TAXONOMY) {
    const sub = c.subcategories?.find((s) => s.id === normalized);
    if (sub) {
      return includeParent ? `${c.label} (${sub.label})` : sub.label;
    }
  }

  return id;
}

/**
 * Formats multiple category / subcategory IDs, comma separated or JSON string,
 * into clean human-readable labels.
 */
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

  const formatted = items
    .map((item) => {
      const clean = item.replace(/^["']|["']$/g, "").trim();
      const parent = getParentCategory(clean);
      if (parent) {
        const sub = parent.subcategories?.find((s) => s.id === normalizeTaxonomyId(clean));
        return sub ? `${parent.label} (${sub.label})` : formatTaxonomyItemLabel(clean);
      }
      return formatTaxonomyItemLabel(clean);
    })
    .filter(Boolean);

  return formatted.join(", ");
}

/**
 * Returns a structured hierarchy list for dropdowns and filter components.
 */
export function getCategoryHierarchy(): Array<{
  id: string;
  label: string;
  isSubcategory: boolean;
  parentId?: string;
  parentLabel?: string;
}> {
  const result: Array<{
    id: string;
    label: string;
    isSubcategory: boolean;
    parentId?: string;
    parentLabel?: string;
  }> = [];

  TAXONOMY.forEach((cat) => {
    result.push({
      id: cat.id,
      label: cat.label,
      isSubcategory: false,
    });

    cat.subcategories?.forEach((sub) => {
      result.push({
        id: sub.id,
        label: sub.label,
        isSubcategory: true,
        parentId: cat.id,
        parentLabel: cat.label,
      });
    });
  });

  return result;
}
