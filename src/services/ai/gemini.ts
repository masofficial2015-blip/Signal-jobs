import { env } from "@/lib/env";

export interface DetailedExtractedJobData {
  title: string;
  company: string | null;
  summary: string | null;
  description: string | null;
  responsibilities?: string | null;
  requirements?: string | null;
  category: string | string[] | null;
  profession: string | null;
  experienceLevel: string | string[] | null;
  education?: string | null;
  location: string | null;
  deadline: string | null;
  applicationUrl: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
}

export interface AIJobExtractor {
  extractJobDetails(rawText: string, sourceName?: string | null, sourceUrl?: string | null): Promise<DetailedExtractedJobData[]>;
}

export class GeminiJobExtractor implements AIJobExtractor {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = env.GEMINI_API_KEY;
    this.model = env.GEMINI_MODEL;
  }

  async extractJobDetails(
    rawText: string,
    sourceName?: string | null,
    sourceUrl?: string | null
  ): Promise<DetailedExtractedJobData[]> {
    if (!this.apiKey || this.apiKey === "mock_gemini_api_key") {
      return [this.mockExtraction(rawText, sourceName, sourceUrl)];
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `CRITICAL INSTRUCTION: You are a high-precision job parsing assistant for Ethiopian job listings.

IMPORTANT: A single post may contain MULTIPLE job positions (e.g. "Position 1: ...", "Position 2: ..."). 
You MUST extract EACH position as a SEPARATE job object and return ALL of them as a JSON array.
If there is only one position, still return a JSON array with one element.

DO NOT INVENT OR HALLUCINATE ANY INFORMATION. If a field is not explicitly mentioned, set it to null or [].

For each position, extract:
- title: Clean position title (string)
- company: Organization/employer name (shared across positions if same company) or null
- summary: Short 2-3 sentence summary of the opportunity or null
- description: Overview/about the role or null
- category: Array of applicable categories from ["technology", "engineering", "business_admin", "finance_accounting", "hospitality", "agriculture", "logistics_transport", "ngo_development", "government", "marketing_sales", "healthcare", "education", "other"] (e.g. ["technology", "engineering"])
- profession: Standardized job role (e.g. "Software Engineer", "Civil Engineer", "Accountant") or null
- experienceLevel: Array of matching experience levels from ["graduate", "entry_level", "mid_level", "senior_level"]. Note: If the position accepts 0 years / fresh grads or 0-2 years, include both "graduate" and "entry_level" in the array.
- education: Degree/Diploma/Education requirement (e.g. "BSc in Computer Science or related", "BA in Accounting", "Diploma / Degree in Management") or null
- location: City in Ethiopia (e.g. "Addis Ababa", "Hawassa", "Adama", "Bahir Dar", "Dire Dawa", "Mekelle", "Gondar", "Jimma") or "Remote" or null
- deadline: Application deadline string (e.g. "2026-09-30") or null
- applicationUrl: Application link or URL if found or null

Return ONLY a raw valid JSON array (e.g. [{...}, {...}]) without any markdown or code block formatting.

JOB TEXT:
${rawText}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.0,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!response.ok) {
        const errBody = await response.text().catch(() => "(no body)");
        throw new Error(`Gemini API error ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      const contentText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!contentText) {
        throw new Error("Empty response from Gemini API");
      }

      const parsed: DetailedExtractedJobData | DetailedExtractedJobData[] = JSON.parse(contentText);
      const jobs: DetailedExtractedJobData[] = Array.isArray(parsed) ? parsed : [parsed];

      return jobs.map((job) => ({
        ...job,
        education: job.education || null,
        sourceName: sourceName || null,
        sourceUrl: sourceUrl || job.applicationUrl || null,
      }));
    } catch (error) {
      console.warn("AI extraction fallback triggered:", error);
      return [this.mockExtraction(rawText, sourceName, sourceUrl)];
    }
  }

  private mockExtraction(
    rawText: string,
    sourceName?: string | null,
    sourceUrl?: string | null
  ): DetailedExtractedJobData {
    const lines = rawText.trim().split("\n");
    const firstLine = lines[0].slice(0, 80).replace(/^[#*\-•\s]+/, "") || "Extracted Job Posting";

    return {
      title: firstLine,
      company: "Discovered Organization",
      summary: rawText.slice(0, 200) + "...",
      description: rawText,
      category: ["technology"],
      profession: "Software Developer",
      experienceLevel: ["entry_level"],
      education: "Bachelor's Degree or Equivalent",
      location: "Addis Ababa",
      deadline: null,
      applicationUrl: sourceUrl || null,
      sourceName: sourceName || "Manual Ingestion",
      sourceUrl: sourceUrl || null,
    };
  }
}

export const aiJobExtractor = new GeminiJobExtractor();
