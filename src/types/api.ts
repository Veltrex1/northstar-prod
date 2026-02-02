export interface ApiError {
  code: string;
  message: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: SourceCitation[];
}

export interface SourceCitation {
  documentId: string;
  title: string;
  url?: string;
  excerpt: string;
}

export interface ClarificationPrompt {
  type: "clarification";
  question: string;
  options: {
    id: string;
    label: string;
    sourceId: string;
  }[];
}
