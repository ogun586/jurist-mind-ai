import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Sparkles, Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useJuristLensStore, JLChatMessage } from "@/stores/juristLensStore";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  "Summarize this agreement",
  "What's missing?",
  "Check for red flags",
];

const MAX_CHAT_HISTORY = 10; // sliding window

export default function JLChatPanel() {
  const {
    currentDocument, extractedClauses, chatMessages, chatLoading,
    selectedClause, chatContext, setSelectedClause, addChatMessage,
    setChatLoading, setActiveTab, clearSelectedClause,
  } = useJuristLensStore();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Auto-inject context from "Ask JuristLens"
  useEffect(() => {
    if (chatContext) {
      const prompt = `Explain the risks in the "${chatContext.title}" clause and what I should negotiate.`;
      setInput(prompt);
      textareaRef.current?.focus();
      // Auto-submit after a short delay
      const timer = setTimeout(() => {
        handleSendWithText(prompt);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [chatContext]);

  const handleSendWithText = useCallback(async (text: string) => {
    if (!text.trim() || !currentDocument || chatLoading) return;
    setInput("");

    const userMsg: JLChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    addChatMessage(userMsg);
    setChatLoading(true);

    try {
      // Sliding window: only send last N messages
      const recentHistory = chatMessages.slice(-MAX_CHAT_HISTORY).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await supabase.functions.invoke("process-juristlens", {
        body: {
          document_id: currentDocument.id,
          action: "chat",
          question: text.trim(),
          clause_ids: selectedClause ? [selectedClause.id] : [],
          chat_history: recentHistory,
        },
      });

      if (res.error) throw res.error;

      const { answer, referenced_clauses } = res.data;

      addChatMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: answer || "I couldn't generate a response.",
        referenced_clauses,
        timestamp: new Date(),
      });
    } catch {
      addChatMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I encountered an error. Please try again.",
        timestamp: new Date(),
        isError: true,
      });
    } finally {
      setChatLoading(false);
    }
  }, [currentDocument, chatMessages, chatLoading, selectedClause]);

  const handleSend = () => handleSendWithText(input);

  const handleClauseRef = (clauseTitle: string) => {
    const clause = extractedClauses.find(
      (c) => c.title.includes(clauseTitle) || clauseTitle.includes(c.title)
    );
    if (clause) setSelectedClause(clause);
  };

  const renderContent = (content: string, refs?: JLChatMessage["referenced_clauses"]) => {
    const parts = content.split(/\[\[Clause: ([^\]]+)\]\]/g);

    return (
      <div className="prose prose-sm prose-invert max-w-none">
        {parts.map((part, i) =>
          i % 2 === 1 ? (
            <button
              key={i}
              onClick={() => handleClauseRef(part)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors cursor-pointer mx-0.5"
            >
              📌 {part}
            </button>
          ) : (
            <ReactMarkdown key={i}>{part}</ReactMarkdown>
          )
        )}

        {refs && refs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/30">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mr-1">Sources:</span>
            {refs.map((ref) => (
              <button
                key={ref.id}
                onClick={() => {
                  const clause = extractedClauses.find((c) => c.id === ref.id);
                  if (clause) setSelectedClause(clause);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-card border border-border/50 text-[10px] font-semibold text-foreground hover:border-primary/30 transition-colors"
              >
                Clause {ref.page_number}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!currentDocument) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Sparkles className="w-8 h-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Upload a document to start chatting</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 flex-shrink-0">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-bold text-foreground">JuristLens AI</span>
        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold ml-auto">
          Document Context Active
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Hi! I've analyzed your document.</p>
              <p className="text-xs text-muted-foreground mt-1">What would you like to know?</p>
            </div>
            <div className="flex flex-wrap gap-2 max-w-xs">
              {["What are the main risks in this agreement?", "Summarize the key terms", "Check for red flags"].map((p) => (
                <button
                  key={p}
                  onClick={() => { setInput(p); textareaRef.current?.focus(); }}
                  className="px-3 py-2 rounded-xl text-xs border border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 transition-all text-left"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatMessages.map((msg) => (
          <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <div className={cn(
              "rounded-xl px-4 py-3 max-w-[85%]",
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : msg.isError
                ? "bg-red-500/10 border border-red-500/20"
                : "bg-card border border-border/50"
            )}>
              {msg.role === "user" ? (
                <p className="text-sm">{msg.content}</p>
              ) : (
                renderContent(msg.content, msg.referenced_clauses)
              )}
              {msg.isError && (
                <button
                  onClick={() => handleSendWithText(chatMessages[chatMessages.length - 2]?.content || "")}
                  className="flex items-center gap-1 mt-2 text-xs text-red-400 hover:text-red-300"
                >
                  <RotateCcw className="w-3 h-3" />
                  Retry
                </button>
              )}
            </div>
          </div>
        ))}

        {chatLoading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
            </div>
            <div className="rounded-xl px-4 py-3 bg-card border border-border/50">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary" style={{ animation: `typingDot 1.4s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">Analyzing…</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts row */}
      {chatMessages.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-border/20 overflow-x-auto flex-shrink-0">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => { setInput(p); textareaRef.current?.focus(); }}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border/50 p-3 flex-shrink-0">
        {selectedClause && (
          <div className="flex items-center gap-2 mb-2 px-2">
            <span className="text-[10px] text-primary font-bold uppercase tracking-wider">Context:</span>
            <span className="text-[10px] text-muted-foreground truncate">{selectedClause.title}</span>
            <button onClick={clearSelectedClause} className="text-[10px] text-muted-foreground hover:text-foreground ml-auto">✕</button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="Ask about your document…"
            rows={1}
            className="flex-1 bg-secondary/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary/30 max-h-32"
            style={{ minHeight: "40px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || chatLoading}
            className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0"
          >
            {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
