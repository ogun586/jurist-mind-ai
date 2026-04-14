import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { useJuristLens, ChatMessage } from "@/contexts/JuristLensContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

export default function ChatPanel() {
  const {
    currentDocument, clauses, chatMessages, chatLoading,
    selectedClause, selectClause, addChatMessage, setChatLoading,
    setActivePanel,
  } = useJuristLens();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Auto-inject clause context when switching to chat with a selected clause
  useEffect(() => {
    if (selectedClause && chatMessages.length === 0) {
      setInput(`Explain the "${selectedClause.title}" clause and its legal implications.`);
      textareaRef.current?.focus();
    }
  }, [selectedClause]);

  const handleSend = async () => {
    if (!input.trim() || !currentDocument || chatLoading) return;

    const question = input.trim();
    setInput("");

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
      timestamp: new Date(),
    };
    addChatMessage(userMsg);
    setChatLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const chatHistory = chatMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await supabase.functions.invoke("process-juristlens", {
        body: {
          document_id: currentDocument.id,
          action: "chat",
          question,
          clause_ids: selectedClause ? [selectedClause.id] : [],
          chat_history: chatHistory,
        },
      });

      if (res.error) throw res.error;

      const { answer, referenced_clauses } = res.data;

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: answer,
        referenced_clauses,
        timestamp: new Date(),
      };
      addChatMessage(assistantMsg);
    } catch (e) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I encountered an error processing your question. Please try again.",
        timestamp: new Date(),
      };
      addChatMessage(errorMsg);
    } finally {
      setChatLoading(false);
    }
  };

  const handleClauseRef = (clauseTitle: string) => {
    const clause = clauses.find(
      (c) => c.title.includes(clauseTitle) || clauseTitle.includes(c.title)
    );
    if (clause) {
      selectClause(clause);
      setActivePanel("insights");
    }
  };

  // Render message content with clickable clause refs
  const renderContent = (content: string, referencedClauses?: ChatMessage["referenced_clauses"]) => {
    // Replace [[Clause: title]] with clickable spans
    const parts = content.split(/\[\[Clause: ([^\]]+)\]\]/g);

    return (
      <div className="prose prose-sm prose-invert max-w-none">
        {parts.map((part, i) => {
          if (i % 2 === 1) {
            // This is a clause reference
            return (
              <button
                key={i}
                onClick={() => handleClauseRef(part)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors cursor-pointer"
              >
                📌 {part}
              </button>
            );
          }
          return <ReactMarkdown key={i}>{part}</ReactMarkdown>;
        })}

        {/* Referenced clauses as chips */}
        {referencedClauses && referencedClauses.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/30">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
              Referenced:
            </span>
            {referencedClauses.map((ref) => (
              <button
                key={ref.id}
                onClick={() => {
                  const clause = clauses.find((c) => c.id === ref.id);
                  if (clause) selectClause(clause);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/20 transition-colors"
              >
                📄 {ref.title} (p.{ref.page_number})
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
        <MessageIcon />
        <p className="text-sm text-muted-foreground">Upload a document to start chatting</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">JuristLens AI</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Ask questions about your document. I'll reference specific clauses and provide legal analysis.
            </p>
            {/* Quick prompts */}
            <div className="flex flex-wrap gap-2 mt-2 max-w-sm">
              {[
                "Summarize the key risks",
                "What are the termination conditions?",
                "Are there any hidden obligations?",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => { setInput(prompt); textareaRef.current?.focus(); }}
                  className="px-3 py-1.5 rounded-full text-xs border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <div
              className={cn(
                "rounded-xl px-4 py-3 max-w-[85%]",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border/50"
              )}
            >
              {msg.role === "user" ? (
                <p className="text-sm">{msg.content}</p>
              ) : (
                renderContent(msg.content, msg.referenced_clauses)
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
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-primary"
                      style={{ animation: `typingDot 1.4s ease-in-out ${i * 0.2}s infinite` }}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">Analyzing...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border/50 p-3">
        {selectedClause && (
          <div className="flex items-center gap-2 mb-2 px-2">
            <span className="text-[10px] text-primary font-bold uppercase tracking-wider">Context:</span>
            <span className="text-[10px] text-muted-foreground truncate">{selectedClause.title}</span>
            <button
              onClick={() => selectClause(null)}
              className="text-[10px] text-muted-foreground hover:text-foreground ml-auto"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about this document..."
            rows={1}
            className="flex-1 bg-secondary/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary/30 max-h-32"
            style={{ minHeight: "40px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || chatLoading}
            className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0"
          >
            {chatLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageIcon() {
  return (
    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
      <Sparkles className="w-5 h-5 text-muted-foreground/40" />
    </div>
  );
}
