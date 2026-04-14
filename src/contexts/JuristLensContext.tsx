import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface JuristLensDocument {
  id: string;
  user_id: string;
  session_id: string | null;
  file_url: string;
  file_name: string;
  file_type: string;
  file_path: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  page_count: number;
  created_at: string;
}

export interface JuristLensPage {
  id: string;
  document_id: string;
  page_number: number;
  text_content: string | null;
}

export interface JuristLensClause {
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
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  referenced_clauses?: { id: string; title: string; page_number: number }[];
  timestamp: Date;
}

export type ActivePanel = "insights" | "chat";

interface JuristLensState {
  currentDocument: JuristLensDocument | null;
  clauses: JuristLensClause[];
  pages: JuristLensPage[];
  selectedClause: JuristLensClause | null;
  highlightClauseId: string | null;
  viewerPage: number;
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  activePanel: ActivePanel;
  processingStatus: "idle" | "uploading" | "processing" | "completed" | "failed";

  setCurrentDocument: (doc: JuristLensDocument | null) => void;
  setClauses: (clauses: JuristLensClause[]) => void;
  setPages: (pages: JuristLensPage[]) => void;
  selectClause: (clause: JuristLensClause | null) => void;
  navigateToPage: (page: number) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setChatLoading: (loading: boolean) => void;
  setActivePanel: (panel: ActivePanel) => void;
  setProcessingStatus: (status: "idle" | "uploading" | "processing" | "completed" | "failed") => void;
  resetState: () => void;
}

const JuristLensContext = createContext<JuristLensState | null>(null);

export function JuristLensProvider({ children }: { children: ReactNode }) {
  const [currentDocument, setCurrentDocument] = useState<JuristLensDocument | null>(null);
  const [clauses, setClauses] = useState<JuristLensClause[]>([]);
  const [pages, setPages] = useState<JuristLensPage[]>([]);
  const [selectedClause, setSelectedClause] = useState<JuristLensClause | null>(null);
  const [highlightClauseId, setHighlightClauseId] = useState<string | null>(null);
  const [viewerPage, setViewerPage] = useState(1);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>("insights");
  const [processingStatus, setProcessingStatus] = useState<"idle" | "uploading" | "processing" | "completed" | "failed">("idle");

  const selectClause = useCallback((clause: JuristLensClause | null) => {
    setSelectedClause(clause);
    if (clause) {
      setHighlightClauseId(clause.id);
      setViewerPage(clause.page_number);
    } else {
      setHighlightClauseId(null);
    }
  }, []);

  const navigateToPage = useCallback((page: number) => {
    setViewerPage(page);
  }, []);

  const addChatMessage = useCallback((msg: ChatMessage) => {
    setChatMessages(prev => [...prev, msg]);
  }, []);

  const resetState = useCallback(() => {
    setCurrentDocument(null);
    setClauses([]);
    setPages([]);
    setSelectedClause(null);
    setHighlightClauseId(null);
    setViewerPage(1);
    setChatMessages([]);
    setChatLoading(false);
    setActivePanel("insights");
    setProcessingStatus("idle");
  }, []);

  return (
    <JuristLensContext.Provider
      value={{
        currentDocument,
        clauses,
        pages,
        selectedClause,
        highlightClauseId,
        viewerPage,
        chatMessages,
        chatLoading,
        activePanel,
        processingStatus,
        setCurrentDocument,
        setClauses,
        setPages,
        selectClause,
        navigateToPage,
        addChatMessage,
        setChatLoading,
        setActivePanel,
        setProcessingStatus,
        resetState,
      }}
    >
      {children}
    </JuristLensContext.Provider>
  );
}

export function useJuristLens() {
  const ctx = useContext(JuristLensContext);
  if (!ctx) throw new Error("useJuristLens must be used within JuristLensProvider");
  return ctx;
}
