import { useState, useEffect, useRef } from "react";
import { Send, Mic, Paperclip, Copy, Check, RotateCcw, ThumbsUp, ThumbsDown, Scale, Plus } from "lucide-react";
import { ShareButton } from "@/components/ShareButton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { NavLink, useParams, useNavigate } from "react-router-dom";
import { SourceDisplay } from "@/components/SourceDisplay";
import ReactMarkdown from "react-markdown";
import TextareaAutosize from "react-textarea-autosize";
import remarkGfm from "remark-gfm";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  sources?: string[];
  db_id?: string;
}

const quickPrompts = [
  "Summarise a case",
  "Explain a law",
  "Draft a legal letter",
  "Find recent judgements",
];

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { user, profile } = useAuth();
  const userCountry = profile?.country || '';
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!user) return;
    if (urlSessionId) {
      setMessages([]);
      loadSession(urlSessionId);
    } else {
      setMessages([]);
      setCurrentSessionId(null);
      loadMostRecentSession();
    }
  }, [user, urlSessionId]);

  useEffect(() => {
    const handleNewChatEvent = () => {
      setMessages([]);
      setCurrentSessionId(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    };
    window.addEventListener("newChat", handleNewChatEvent);
    return () => window.removeEventListener("newChat", handleNewChatEvent);
  }, []);

  useEffect(() => {
    if (!currentSessionId) return;
    const channel = supabase
      .channel(`chat_updates:${currentSessionId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `session_id=eq.${currentSessionId}`,
      }, (payload) => {
        const newMsg = payload.new as any;
        setMessages((prev) => {
          if (prev.some((msg) => msg.db_id === newMsg.id)) return prev;
          return [...prev, {
            id: newMsg.id, db_id: newMsg.id, content: newMsg.content,
            sender: newMsg.sender as "user" | "ai",
            timestamp: new Date(newMsg.created_at),
          }];
        });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentSessionId]);

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast({ description: "Copied to clipboard" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFeedback = async (message: Message, isPositive: boolean) => {
    if (!message.db_id || !user) {
      toast({ description: "Cannot rate this message yet.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.from("chat_feedback").insert({
        message_id: message.db_id, user_id: user.id, is_positive: isPositive,
      });
      if (error) throw error;
      toast({ title: isPositive ? "Thanks!" : "Feedback Sent", description: "We use this to improve Jurist Mind." });
    } catch {
      toast({ description: "Failed to submit feedback", variant: "destructive" });
    }
  };

  const handleRegenerate = async () => {
    const lastUserMessage = [...messages].reverse().find((m) => m.sender === "user");
    if (lastUserMessage && !isLoading) {
      if (messages[messages.length - 1].sender === "ai") setMessages((prev) => prev.slice(0, -1));
      await processMessage(lastUserMessage.content, true);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    navigate("/", { replace: true });
    window.dispatchEvent(new CustomEvent("newChat"));
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const loadMostRecentSession = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("chat_sessions").select("id").eq("user_id", user.id)
        .order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (data) navigate(`/chat/${data.id}`, { replace: true });
    } catch (error) { console.error("Error loading recent session:", error); }
  };

  const createNewSession = async () => {
    if (!user) return null;
    try {
      const { data, error } = await supabase.from("chat_sessions")
        .insert({ user_id: user.id, title: "New Chat" }).select().single();
      if (error) throw error;
      return data.id;
    } catch { return null; }
  };

  const saveMessage = async (sessionId: string, content: string, sender: "user" | "ai"): Promise<string | null> => {
    try {
      const { data, error } = await supabase.from("chat_messages")
        .insert({ session_id: sessionId, content, sender }).select("id, created_at").single();
      if (error) throw error;
      await supabase.from("chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId);
      return data?.id || null;
    } catch { return null; }
  };

  const updateSessionTitle = async (sessionId: string, firstMessage: string) => {
    const title = firstMessage.length > 50 ? firstMessage.substring(0, 50) + "..." : firstMessage;
    try { await supabase.from("chat_sessions").update({ title }).eq("id", sessionId); } catch { }
  };

  const processMessage = async (messageContent: string, isRegeneration: boolean = false) => {
    if (!user) {
      toast({ title: "Authentication Required", description: "Please sign in.", variant: "destructive" });
      return;
    }

    try {
      const { data: usageCheck, error: usageError } = await supabase.functions.invoke("check-ai-usage");
      if (usageError || !usageCheck?.allowed) {
        toast({
          title: "Limit Reached",
          description: `${usageCheck?.reason || "Usage limit reached"} — Upgrade to continue.`,
          variant: "destructive",
          action: <Button variant="outline" size="sm" onClick={() => navigate("/upgrade")}>Upgrade</Button>,
        });
        return;
      }
    } catch { return; }

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = await createNewSession();
      if (!sessionId) { toast({ title: "Error", description: "Failed to create chat session", variant: "destructive" }); return; }
      setCurrentSessionId(sessionId);
      navigate(`/chat/${sessionId}`, { replace: true });
    }

    if (!isRegeneration) {
      setInputValue("");
      const tempMessageId = Date.now().toString();
      setMessages((prev) => [...prev, { id: tempMessageId, content: messageContent, sender: "user", timestamp: new Date() }]);
      const userDbId = await saveMessage(sessionId, messageContent, "user");
      if (userDbId) setMessages((prev) => prev.map((msg) => msg.id === tempMessageId ? { ...msg, db_id: userDbId } : msg));
      if (messages.length === 0) await updateSessionTitle(sessionId, messageContent);
    }

    setIsLoading(true);
    const aiTempId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: aiTempId, content: "", sender: "ai", timestamp: new Date() }]);

    try {
      const formData = new FormData();
      formData.append("question", messageContent);
      formData.append("country", userCountry);
      formData.append("system_context", `You are Jurist Mind, an AI-powered legal assistant. The user is based in ${userCountry}. Answer ALL legal questions strictly based on the laws, statutes, regulations, and legal framework of ${userCountry}. Always reference ${userCountry} law specifically. If the user asks about law from another country, you may answer but always clarify the distinction.`);
      if (sessionId) formData.append("chat_id", sessionId);
      if (user?.id) formData.append("user_id", user.id);

      const response = await fetch("https://juristmind.onrender.com/ask", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Failed to get AI response");
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n\n")) {
            if (!line.startsWith("data:")) continue;
            const dataStr = line.slice(5).trim();
            if (dataStr === "[DONE]") { done = true; break; }
            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                fullContent += data.content;
                setMessages((prev) => prev.map((msg) => msg.id === aiTempId ? { ...msg, content: fullContent } : msg));
              }
            } catch { }
          }
        }
      }

      if (fullContent) {
        const aiDbId = await saveMessage(sessionId, fullContent, "ai");
        if (aiDbId) setMessages((prev) => prev.map((msg) => msg.id === aiTempId ? { ...msg, db_id: aiDbId } : msg));
      }
      try { await supabase.functions.invoke("increment-ai-usage", { body: { points: 1 } }); } catch { }
    } catch {
      const errorContent = "I'm having trouble connecting right now. Please try again later.";
      setMessages((prev) => prev.map((msg) => msg.id === aiTempId ? { ...msg, content: errorContent } : msg));
      await saveMessage(sessionId, errorContent, "ai");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    await processMessage(inputValue);
  };

  const loadSession = async (sessionId: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.from("chat_messages")
        .select("id, content, sender, created_at").eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) { setMessages([]); setCurrentSessionId(sessionId); return; }
      setMessages(data.map((msg) => ({
        id: msg.id, db_id: msg.id, content: msg.content,
        sender: msg.sender as "user" | "ai",
        timestamp: new Date(msg.created_at), sources: [],
      })));
      setCurrentSessionId(sessionId);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "auto" }), 100);
    } catch {
      toast({ title: "Error", description: "Failed to load chat session", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full chat-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[rgba(255,255,255,0.06)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-foreground tracking-tight">JURIST MIND</h1>
          {userCountry && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5">
              <span className="text-[10px]">⚖️</span>
              <span className="text-[11px] font-medium text-primary/70">{userCountry} Law</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <ShareButton sessionId={currentSessionId} />
          <Button
            onClick={handleNewChat}
            variant="ghost"
            size="sm"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.05)] rounded-lg"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6">
          {messages.length === 0 ? (
            <div className="text-center pt-[12vh] pb-10 animate-fade-in select-none">
              {/* Circular logo badge */}
              <div className="flex justify-center mb-7">
                <div className="w-[72px] h-[72px] rounded-full bg-foreground flex items-center justify-center shadow-[0_4px_32px_rgba(0,0,0,0.5)]">
                  <span className="text-background text-3xl font-bold tracking-tight leading-none" style={{ fontFamily: "serif" }}>J</span>
                </div>
              </div>

              {/* Heading */}
              <h2 className="text-[clamp(2rem,5vw,2.8rem)] font-extrabold text-foreground mb-3 tracking-[-0.02em]">
                JURIST MIND
              </h2>

              {/* Subtitle */}
              <p className="text-[15px] text-muted-foreground mb-10 font-light">
                {user ? "Your AI-powered legal research assistant" : "Please sign in to start chatting"}
              </p>

              {/* Quick prompts */}
              {user && (
                <div className="flex flex-wrap justify-center gap-2.5 mb-8">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => { setInputValue(prompt); setTimeout(() => inputRef.current?.focus(), 50); }}
                      className="px-5 py-2 rounded-full text-[13px] font-medium text-muted-foreground border border-[rgba(255,255,255,0.1)] hover:border-primary/40 hover:text-foreground hover:bg-[rgba(255,255,255,0.04)] transition-all"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {!user && (
                <Button
                  onClick={() => navigate("/auth")}
                  className="mt-4 bg-foreground text-background hover:bg-foreground/90 font-semibold"
                >
                  Sign In to Continue
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"} animate-fade-in-up`}
                >
                  {message.sender === "ai" && (
                    <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                      <Scale className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}

                  <div className={`max-w-[75%] ${message.sender === "user" ? "msg-user px-4 py-3" : "msg-ai px-5 py-4"}`}>
                    {message.content ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ node, ...props }) => (
                              <p className="text-sm leading-[1.8] my-2 text-foreground/90" {...props} />
                            ),
                            strong: ({ node, ...props }) => (
                              <strong className="font-semibold text-foreground" {...props} />
                            ),
                            em: ({ node, ...props }) => (
                              <em className="italic text-foreground/80" {...props} />
                            ),
                            ul: ({ node, ...props }) => (
                              <ul className="list-disc pl-5 my-3 space-y-1.5 text-sm" {...props} />
                            ),
                            ol: ({ node, ...props }) => (
                              <ol className="list-decimal pl-5 my-3 space-y-1.5 text-sm" {...props} />
                            ),
                            li: ({ node, ...props }) => (
                              <li className="text-sm leading-[1.7] text-foreground/90 pl-1" {...props} />
                            ),
                            h1: ({ node, ...props }) => (
                              <h1 className="text-xl font-bold mt-5 mb-3 text-foreground border-b border-[rgba(255,255,255,0.08)] pb-2" {...props} />
                            ),
                            h2: ({ node, ...props }) => (
                              <h2 className="text-base font-bold mt-4 mb-2 text-foreground" {...props} />
                            ),
                            h3: ({ node, ...props }) => (
                              <h3 className="text-sm font-semibold mt-3 mb-1.5 text-primary/90" {...props} />
                            ),
                            blockquote: ({ node, ...props }) => (
                              <blockquote className="border-l-2 border-primary/40 pl-4 my-3 italic text-muted-foreground text-sm" {...props} />
                            ),
                            code: ({ node, className, children, ...props }: any) => {
                              const isInline = !className;
                              return isInline ? (
                                <code className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs font-mono border border-primary/20" {...props}>
                                  {children}
                                </code>
                              ) : (
                                <code className="text-xs font-mono" {...props}>{children}</code>
                              );
                            },
                            pre: ({ node, ...props }) => (
                              <div className="relative my-3">
                                <pre className="bg-[rgba(0,0,0,0.4)] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 overflow-x-auto text-xs font-mono leading-relaxed" {...props} />
                              </div>
                            ),
                            table: ({ node, ...props }) => (
                              <div className="overflow-x-auto my-4 rounded-xl border border-[rgba(255,255,255,0.08)]">
                                <table className="w-full text-sm border-collapse" {...props} />
                              </div>
                            ),
                            thead: ({ node, ...props }) => (
                              <thead className="bg-primary/10" {...props} />
                            ),
                            tbody: ({ node, ...props }) => (
                              <tbody className="divide-y divide-[rgba(255,255,255,0.05)]" {...props} />
                            ),
                            tr: ({ node, ...props }) => (
                              <tr className="hover:bg-[rgba(255,255,255,0.02)] transition-colors" {...props} />
                            ),
                            th: ({ node, ...props }) => (
                              <th className="text-left px-4 py-3 font-semibold text-primary text-xs uppercase tracking-wider" {...props} />
                            ),
                            td: ({ node, ...props }) => (
                              <td className="px-4 py-3 text-sm text-foreground/85" {...props} />
                            ),
                            hr: ({ node, ...props }) => (
                              <hr className="my-4 border-[rgba(255,255,255,0.08)]" {...props} />
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 py-1">
                        <span className="w-2 h-2 rounded-full bg-primary/60 typing-dot" />
                        <span className="w-2 h-2 rounded-full bg-primary/60 typing-dot" />
                        <span className="w-2 h-2 rounded-full bg-primary/60 typing-dot" />
                      </div>
                    )}

                    {message.sender === "ai" && message.content && (
                      <div className="flex items-center gap-1 mt-3 pt-2 border-t border-[rgba(255,255,255,0.06)]">
                        <button
                          onClick={() => handleCopy(message.content, message.id)}
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                          title="Copy"
                        >
                          {copiedId === message.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        {index === messages.length - 1 && !isLoading && (
                          <button
                            onClick={handleRegenerate}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            title="Regenerate"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleFeedback(message, true)}
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-green-500 transition-colors"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleFeedback(message, false)}
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] text-muted-foreground/50 ml-auto">
                          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    )}

                    {message.sender === "user" && (
                      <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-right">
                        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}

                    {message.sender === "ai" && message.sources && message.sources.length > 0 && (
                      <SourceDisplay sources={message.sources} />
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-5 pb-4 pt-2">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3 focus-within:border-[rgba(255,255,255,0.14)] transition-colors">
            {/* Attachment */}
            <button className="flex-shrink-0 mb-0.5 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.06)] transition-colors">
              <Paperclip className="w-4 h-4" strokeWidth={1.8} />
            </button>

            {/* Text input */}
            <TextareaAutosize
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything legal…"
              minRows={1}
              maxRows={6}
              className="flex-1 bg-transparent border-none resize-none focus:outline-none focus:ring-0 text-[14px] text-foreground placeholder:text-muted-foreground/50 py-0.5 leading-6"
            />

            {/* Mic + Send */}
            <div className="flex items-center gap-1.5 flex-shrink-0 mb-0.5">
              <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.06)] transition-colors">
                <Mic className="w-4 h-4" strokeWidth={1.8} />
              </button>
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading || !user}
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:bg-primary/80 disabled:opacity-25 transition-all"
              >
                <Send className="w-3.5 h-3.5 text-primary-foreground" />
              </button>
            </div>
          </div>
          <p className="text-center mt-2.5 text-[11px] text-muted-foreground/40">
            By using Jurist Mind, you consent to the{" "}
            <NavLink to="/terms" className="text-primary/60 hover:text-primary hover:underline transition-colors">
              terms and conditions
            </NavLink>
          </p>
        </div>
      </div>
    </div>
  );
}
