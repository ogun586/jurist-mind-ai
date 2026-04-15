import { create } from "zustand";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface JLDocument {
  id: string;
  user_id: string;
  session_id: string | null;
  file_url: string;
  file_name: string;
  file_type: string;
  file_path: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  page_count: number;
  word_count?: number;
  error_msg?: string | null;
  version?: number;
  created_at: string;
}

export interface JLPage {
  id: string;
  document_id: string;
  page_number: number;
  text_content: string | null;
}

export interface JLClause {
  id: string;
  document_id: string;
  title: string;
  text: string;
  clause_type: string;
  risk_level: "high" | "medium" | "low";
  explanation: string | null;
  recommendation: string | null;
  page_number: number;
  start_offset: number;
  end_offset: number;
  match_quality?: "exact" | "approximate" | "page_only";
}

export interface JLChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  referenced_clauses?: { id: string; title: string; page_number: number }[];
  timestamp: Date;
  isStreaming?: boolean;
  isError?: boolean;
}

export type ActiveTab = "review" | "insights" | "chat";

export interface HighlightRange {
  pageNumber: number;
  startOffset: number;
  endOffset: number;
  matchQuality: "exact" | "approximate" | "page_only";
}

interface JuristLensState {
  // Document state
  currentDocument: JLDocument | null;
  parsedPages: JLPage[];
  extractedClauses: JLClause[];
  previousDocuments: JLDocument[];

  // Selection state
  selectedClause: JLClause | null;
  highlightRange: HighlightRange | null;

  // Viewer state
  viewerPage: number;
  viewerScale: number;
  viewerNumPages: number;

  // Chat state
  chatMessages: JLChatMessage[];
  chatLoading: boolean;
  chatContext: JLClause | null;

  // UI state
  activeTab: ActiveTab;
  processingStatus: "idle" | "uploading" | "processing" | "completed" | "failed";

  // Actions
  setCurrentDocument: (doc: JLDocument | null) => void;
  setParsedPages: (pages: JLPage[]) => void;
  setExtractedClauses: (clauses: JLClause[]) => void;
  setPreviousDocuments: (docs: JLDocument[]) => void;

  setSelectedClause: (clause: JLClause | null) => void;
  clearSelectedClause: () => void;

  navigateToPage: (page: number) => void;
  setViewerScale: (scale: number) => void;
  setViewerNumPages: (n: number) => void;

  addChatMessage: (msg: JLChatMessage) => void;
  updateLastMessage: (content: string) => void;
  setChatLoading: (loading: boolean) => void;
  injectClauseToChat: (clause: JLClause) => void;

  setActiveTab: (tab: ActiveTab) => void;
  setProcessingStatus: (s: "idle" | "uploading" | "processing" | "completed" | "failed") => void;

  resetState: () => void;
}

export const useJuristLensStore = create<JuristLensState>((set) => ({
  currentDocument: null,
  parsedPages: [],
  extractedClauses: [],
  previousDocuments: [],
  selectedClause: null,
  highlightRange: null,
  viewerPage: 1,
  viewerScale: 1.0,
  viewerNumPages: 0,
  chatMessages: [],
  chatLoading: false,
  chatContext: null,
  activeTab: "review",
  processingStatus: "idle",

  setCurrentDocument: (doc) => set({ currentDocument: doc }),
  setParsedPages: (pages) => set({ parsedPages: pages }),
  setExtractedClauses: (clauses) => set({ extractedClauses: clauses }),
  setPreviousDocuments: (docs) => set({ previousDocuments: docs }),

  setSelectedClause: (clause) => {
    if (!clause) {
      set({ selectedClause: null, highlightRange: null });
      return;
    }
    const mq = (clause.match_quality || 
      (clause.start_offset > 0 && clause.end_offset > 0 ? "exact" : "page_only")) as HighlightRange["matchQuality"];
    set({
      selectedClause: clause,
      highlightRange: {
        pageNumber: clause.page_number,
        startOffset: clause.start_offset,
        endOffset: clause.end_offset,
        matchQuality: mq,
      },
      viewerPage: clause.page_number,
    });
  },

  clearSelectedClause: () => set({ selectedClause: null, highlightRange: null }),

  navigateToPage: (page) => set({ viewerPage: page }),
  setViewerScale: (scale) => set({ viewerScale: scale }),
  setViewerNumPages: (n) => set({ viewerNumPages: n }),

  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  updateLastMessage: (content) =>
    set((s) => {
      const msgs = [...s.chatMessages];
      if (msgs.length > 0) {
        msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content };
      }
      return { chatMessages: msgs };
    }),
  setChatLoading: (loading) => set({ chatLoading: loading }),

  injectClauseToChat: (clause) => {
    set({ chatContext: clause, activeTab: "chat" });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setProcessingStatus: (s) => set({ processingStatus: s }),

  resetState: () =>
    set({
      currentDocument: null,
      parsedPages: [],
      extractedClauses: [],
      selectedClause: null,
      highlightRange: null,
      viewerPage: 1,
      viewerScale: 1.0,
      viewerNumPages: 0,
      chatMessages: [],
      chatLoading: false,
      chatContext: null,
      activeTab: "review",
      processingStatus: "idle",
    }),
}));
