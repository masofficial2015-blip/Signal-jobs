export interface ExtractedJobData {
  title: string;
  company?: string | null;
  location?: string | null;
  category?: string | null;
  employmentType?: string | null;
  experienceLevel?: string | null;
  education?: string | null;
  skills: string[];
  summary?: string | null;
  sourceUrl?: string | null;
  deadline?: string | null;
}

export interface ParsedUserPreferences {
  categories: string[];
  professions?: string[];
  experienceLevels: string[];
  locations: string[];
  employmentTypes: string[];
  keywords: string[];
  skills?: string[];
}

export interface JobMatchCalculation {
  userId: string;
  jobId: string;
  score: number; // 0 - 100
  reasons: string[];
  isMatch: boolean;
}

export interface TelegramIncomingMessage {
  message_id: number;
  from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  text?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: {
    id: number;
    first_name: string;
    username?: string;
  };
  data?: string;
  message?: TelegramIncomingMessage;
}

export interface TelegramWebhookPayload {
  update_id: number;
  message?: TelegramIncomingMessage;
  callback_query?: TelegramCallbackQuery;
}
