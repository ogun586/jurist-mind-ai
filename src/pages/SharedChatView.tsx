import { useState, useEffect, useRef } from "react";
import { useParams, NavLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertCircle, Clock, Lock } from "lucide-react";

const JURIST_LOGO =
  "https://phmywmbqvaforkjohoza.supabase.co/storage/v1/object/public/avatars/JURISTAI-Photoroom.png";

interface SharedMessage {
  id: string;
  content: string;
  sender: "user" | "ai";
  created_at: string;
}

interface SharedChat {
  title: string;
  created_at: string;
  messages: SharedMessage[];
}

export default function SharedChatView() {
  const { token } = useParams<{ token: string }>();
  const [chat, setChat] = useState<SharedChat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; code?: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("get-shared-chat", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          body: null,
        } as any);

        // Use direct fetch for GET with query param since invoke wraps POST
        const res = await fetch(
          `https://asmostaidymrcesixebq.supabase.co/functions/v1/get-shared-chat?token=${token}`,
          {
            headers: {
              "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzbW9zdGFpZHltcmNlc2l4ZWJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1MTQzOTgsImV4cCI6MjA3MTA5MDM5OH0.ZSwTxe4EYm940wg91RegIgqZygzr4jiGrZjyw_C8X1I",
            },
          }
        );
        const result = await res.json();

        if (!res.ok || result.error) {
          setError({ message: result.error || "Failed to load chat", code: res.status });
        } else {
          setChat(result);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "auto" }), 100);
        }
      } catch (err: any) {
        setError({ message: "Failed to load chat. Please check your connection." });
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // ── Error state ────────────────────────────────────────────────────────────
  if (!loading && error) {
    const is410 = error.code === 410;
    const is404 = error.code === 404;
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
            {is410 ? <Lock className="w-7 h-7 text-destructive" /> : is404 ? <AlertCircle className="w-7 h-7 text-destructive" /> : <AlertCircle className="w-7 h-7 text-destructive" />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground mb-2">
              {is410 ? (error.message.includes("expired") ? "Link Expired" : "Link Disabled") : is404 ? "Chat Not Found" : "Something Went Wrong"}
            </h1>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
          <NavLink
            to="/auth"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Go to Jurist Mind
          </NavLink>
        </div>
      </div>
    );
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <img src={JURIST_LOGO} alt="Jurist Mind" className="w-12 h-12 rounded-full animate-pulse" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading shared chat…</p>
        </div>
      </div>
    );
  }

  // ── Chat view ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[var(--glass-border)] bg-background/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src={JURIST_LOGO} alt="Jurist Mind" className="w-8 h-8 rounded-full" />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-foreground truncate">{chat?.title || "Shared Chat"}</h1>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>
                {chat?.created_at
                  ? new Date(chat.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
                  : ""}
              </span>
            </div>
          </div>
          <NavLink
            to="/auth"
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Try Jurist Mind
          </NavLink>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          {chat?.messages.map((message) => (
            <div key={message.id}>
              {message.sender === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-tr-sm bg-gradient-to-br from-[hsl(240,15%,18%)] to-[hsl(240,15%,14%)] border border-[rgba(255,255,255,0.06)] text-sm text-foreground/90 leading-relaxed">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-full overflow-hidden border border-primary/20 mt-0.5">
                    <img src={JURIST_LOGO} alt="AI" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 text-sm text-foreground/90 leading-relaxed">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ node, ...props }) => <p className="text-sm leading-[1.8] my-2 text-foreground/90" {...props} />,
                        strong: ({ node, ...props }) => <strong className="font-semibold text-foreground" {...props} />,
                        em: ({ node, ...props }) => <em className="italic text-foreground/80" {...props} />,
                        ul: ({ node, ...props }) => <ul className="my-2 ml-4 list-disc space-y-1" {...props} />,
                        ol: ({ node, ...props }) => <ol className="my-2 ml-4 list-decimal space-y-1" {...props} />,
                        li: ({ node, ...props }) => <li className="text-sm text-foreground/85" {...props} />,
                        h1: ({ node, ...props }) => <h1 className="text-lg font-bold text-foreground mt-4 mb-2 border-b border-[var(--glass-border)] pb-1" {...props} />,
                        h2: ({ node, ...props }) => <h2 className="text-base font-semibold text-foreground mt-4 mb-2" {...props} />,
                        h3: ({ node, ...props }) => <h3 className="text-sm font-semibold text-foreground/90 mt-3 mb-1" {...props} />,
                        blockquote: ({ node, ...props }) => (
                          <blockquote className="my-3 pl-4 border-l-2 border-primary/40 text-foreground/70 italic bg-primary/5 py-2 pr-3 rounded-r-lg" {...props} />
                        ),
                        code: ({ node, className, children, ...props }) => {
                          const isInline = !className;
                          return isInline ? (
                            <code className="px-1.5 py-0.5 rounded bg-muted text-primary text-xs font-mono" {...props}>{children}</code>
                          ) : (
                            <code className="text-xs font-mono text-foreground/85" {...props}>{children}</code>
                          );
                        },
                        pre: ({ node, ...props }) => (
                          <pre className="my-3 p-4 rounded-xl bg-muted/50 border border-[var(--glass-border)] overflow-x-auto text-xs" {...props} />
                        ),
                        table: ({ node, ...props }) => (
                          <div className="overflow-x-auto my-4 rounded-xl border border-[var(--glass-border)]">
                            <table className="w-full text-sm border-collapse" {...props} />
                          </div>
                        ),
                        thead: ({ node, ...props }) => <thead className="bg-muted/50" {...props} />,
                        tbody: ({ node, ...props }) => <tbody {...props} />,
                        tr: ({ node, ...props }) => <tr className="border-b border-[var(--glass-border)] last:border-0" {...props} />,
                        th: ({ node, ...props }) => <th className="px-4 py-2.5 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wide" {...props} />,
                        td: ({ node, ...props }) => <td className="px-4 py-2.5 text-sm text-foreground/85" {...props} />,
                        hr: ({ node, ...props }) => <hr className="my-4 border-[var(--glass-border)]" {...props} />,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--glass-border)] bg-background/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3 text-center">
          <p className="text-xs text-muted-foreground/60">
            This is a read-only view of a shared{" "}
            <NavLink to="/auth" className="text-primary hover:underline">Jurist Mind</NavLink> chat.
          </p>
        </div>
      </footer>
    </div>
  );
}
