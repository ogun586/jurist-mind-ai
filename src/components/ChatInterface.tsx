import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Mic, Paperclip, Plus, ArrowDown, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { NavLink, useParams, useNavigate } from "react-router-dom";
import { SourceDisplay } from "@/components/SourceDisplay";

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
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  // Track scroll position and determine if auto-scroll should happen
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const threshold = 150;

    if (distanceFromBottom <= threshold) {
      shouldAutoScrollRef.current = true;
      setShowJumpToLatest(false);
    } else {
      shouldAutoScrollRef.current = false;
      if (messages.length > 0) {
        setShowJumpToLatest(true);
      }
    }
  }, [messages.length]);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleJumpToLatest = () => {
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!user) return;
    
    if (urlSessionId && urlSessionId !== currentSessionId) {
      setMessages([]);
      loadSession(urlSessionId);
    } else if (!urlSessionId && currentSessionId) {
      setMessages([]);
      setCurrentSessionId(null);
    } else if (!urlSessionId && !currentSessionId) {
      loadMostRecentSession();
    }
  }, [user, urlSessionId]);

  useEffect(() => {
    const handleNewChatEvent = () => {
      setMessages([]);
      setCurrentSessionId(null);
      shouldAutoScrollRef.current = true;
      setShowJumpToLatest(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    };
    
    window.addEventListener('newChat', handleNewChatEvent);
    return () => window.removeEventListener('newChat', handleNewChatEvent);
  }, []);

  useEffect(() => {
    if (!currentSessionId) return;

    const channel = supabase
      .channel(`chat_updates:${currentSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${currentSessionId}`
        },
        (payload) => {
          const newMsg = payload.new as any;
          setMessages(prev => {
            if (prev.some(msg => msg.db_id === newMsg.id)) return prev;
            return [...prev, {
              id: newMsg.id,
              db_id: newMsg.id,
              content: newMsg.content,
              sender: newMsg.sender as 'user' | 'ai',
              timestamp: new Date(newMsg.created_at),
            }];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentSessionId]);

  const loadMostRecentSession = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) navigate(`/chat/${data.id}`, { replace: true });
    } catch (error) {
      console.error('Error loading recent session:', error);
    }
  };

  const createNewSession = async () => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({ user_id: user.id, title: 'New Chat' })
        .select()
        .single();
      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error creating session:', error);
      return null;
    }
  };

  const saveMessage = async (sessionId: string, content: string, sender: 'user' | 'ai'): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({ session_id: sessionId, content, sender })
        .select('id, created_at')
        .single();
      if (error) throw error;
      await supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);
      return data?.id || null;
    } catch (error) {
      console.error('Error saving message:', error);
      toast({ title: "Warning", description: "Message may not have been saved", variant: "destructive" });
      return null;
    }
  };

  const updateSessionTitle = async (sessionId: string, firstMessage: string) => {
    const title = firstMessage.length > 50 ? firstMessage.substring(0, 50) + '...' : firstMessage;
    try {
      await supabase.from('chat_sessions').update({ title }).eq('id', sessionId);
    } catch (error) {
      console.error('Error updating session title:', error);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
    navigate('/', { replace: true });
    window.dispatchEvent(new CustomEvent('newChat'));
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    if (!user) {
      toast({ title: "Authentication Required", description: "Please sign in to chat with JURIST MIND", variant: "destructive" });
      return;
    }

    try {
      const { data: usageCheck, error: usageError } = await supabase.functions.invoke('check-ai-usage');
      if (usageError || !usageCheck?.allowed) {
        const reason = usageCheck?.reason || 'Usage limit reached';
        toast({
          title: "Usage Limit Reached",
          description: `${reason} - Upgrade your plan to continue!`,
          variant: "destructive",
          action: (
            <Button variant="outline" size="sm" onClick={() => navigate('/upgrade')}>
              Upgrade Now
            </Button>
          ),
        });
        return;
      }
      if (usageCheck.requests_remaining > 0 && usageCheck.requests_remaining < 10) {
        toast({ title: "Usage Notice", description: `You have ${usageCheck.requests_remaining} requests remaining today` });
      }
    } catch (error) {
      console.error('Error checking usage:', error);
      toast({ title: "Error", description: "Failed to check usage limits. Please try again.", variant: "destructive" });
      return;
    }

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = await createNewSession();
      if (!sessionId) {
        toast({ title: "Error", description: "Failed to create chat session", variant: "destructive" });
        return;
      }
      setCurrentSessionId(sessionId);
      navigate(`/chat/${sessionId}`, { replace: true });
    }

    const userMessageContent = inputValue;
    const tempMessageId = Date.now().toString();
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);

    const newMessage: Message = { id: tempMessageId, content: userMessageContent, sender: "user", timestamp: new Date() };
    setMessages(prev => [...prev, newMessage]);
    setInputValue("");
    setIsLoading(true);

    const userDbId = await saveMessage(sessionId, userMessageContent, 'user');
    if (userDbId) {
      setMessages(prev => prev.map(msg => msg.id === tempMessageId ? { ...msg, db_id: userDbId } : msg));
    }
    if (messages.length === 0) await updateSessionTitle(sessionId, userMessageContent);

    const aiTempId = (Date.now() + 1).toString();
    const aiPlaceholder: Message = { id: aiTempId, content: "", sender: "ai", timestamp: new Date() };
    setMessages(prev => [...prev, aiPlaceholder]);

    try {
      const formData = new FormData();
      formData.append('question', userMessageContent);
      if (sessionId) formData.append('chat_id', sessionId);
      if (user?.id) formData.append('user_id', user.id);

      const response = await fetch('https://juristmind.onrender.com/ask', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Failed to get AI response');
      if (!response.body) throw new Error('No response body from server');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n\n");
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const dataStr = line.slice(5).trim();
            if (dataStr === "[DONE]") { done = true; break; }
            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                fullContent += data.content;
                setMessages(prev => prev.map(msg => msg.id === aiTempId ? { ...msg, content: fullContent } : msg));
              }
              if (data.type === "done") done = true;
            } catch (parseError) {
              console.log("Chunk parse info:", parseError);
            }
          }
        }
      }

      if (!fullContent) {
        try {
          const text = await response.text();
          const data = JSON.parse(text);
          fullContent = data.answer || data.content || "I'm JURIST MIND, your legal AI assistant.";
          setMessages(prev => prev.map(msg => msg.id === aiTempId ? { ...msg, content: fullContent } : msg));
        } catch {
          fullContent = "Response received but could not be parsed.";
        }
      }

      if (fullContent) {
        const aiDbId = await saveMessage(sessionId, fullContent, 'ai');
        if (aiDbId) {
          setMessages(prev => prev.map(msg => msg.id === aiTempId ? { ...msg, db_id: aiDbId } : msg));
        }
      }

      try {
        await supabase.functions.invoke('increment-ai-usage', { body: { points: 1 } });
      } catch (error) {
        console.error('Error incrementing usage:', error);
      }
    } catch (error) {
      console.error('Error calling AI:', error);
      toast({ title: "Error", description: "Failed to connect to AI assistant. Please try again later.", variant: "destructive" });
      const errorContent = "I'm having trouble connecting right now. Please try again later.";
      setMessages(prev => prev.map(msg => msg.id === aiTempId ? { ...msg, content: errorContent } : msg));
      await saveMessage(sessionId, errorContent, 'ai');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, content, sender, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) {
        setMessages([]);
        setCurrentSessionId(sessionId);
        return;
      }
      const loadedMessages: Message[] = data.map((msg) => ({
        id: msg.id, db_id: msg.id, content: msg.content,
        sender: msg.sender as 'user' | 'ai', timestamp: new Date(msg.created_at), sources: [],
      }));
      setMessages(loadedMessages);
      setCurrentSessionId(sessionId);
      shouldAutoScrollRef.current = true;
      setShowJumpToLatest(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "auto" }), 100);
    } catch (error) {
      console.error('Error loading session:', error);
      toast({ title: "Error", description: "Failed to load chat session", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputValue(prompt);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="flex h-full chat-bg">
      <div className="flex flex-col flex-1 h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[rgba(255,255,255,0.06)]">
          <h1 className="text-base font-semibold text-foreground tracking-tight">JURIST MIND</h1>
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
        
        {/* Messages */}
        <div 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto relative"
        >
          <div className="max-w-3xl mx-auto p-6">
            {messages.length === 0 ? (
              <div className="text-center pt-[15vh] pb-10 animate-fade-in">
                {/* Watermark icon */}
                <div className="flex justify-center mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Scale className="w-6 h-6 text-primary/60" />
                  </div>
                </div>
                
                <h2 className="text-[clamp(2rem,5vw,3rem)] font-bold text-foreground mb-3 tracking-[-0.03em] bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-transparent">
                  JURIST MIND
                </h2>
                <p className="text-base text-muted-foreground mb-10 tracking-wide font-light">
                  {user ? "What do you want to know?" : "Please sign in to start chatting"}
                </p>

                {/* Quick prompt chips */}
                {user && (
                  <div className="flex flex-wrap justify-center gap-2 mb-8">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleQuickPrompt(prompt)}
                        className="px-4 py-2 rounded-full text-sm font-medium text-muted-foreground border border-[rgba(255,255,255,0.1)] hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all btn-lift"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}

                {!user && (
                  <Button 
                    onClick={() => navigate('/auth')}
                    className="mt-4 bg-gradient-primary text-gold-foreground hover:shadow-gold-lg btn-lift btn-press font-semibold"
                  >
                    Sign In to Continue
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((message, index) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"} animate-fade-in-up`}
                    style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}
                  >
                    {/* AI avatar */}
                    {message.sender === "ai" && (
                      <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                        <Scale className="w-3.5 h-3.5 text-primary" />
                      </div>
                    )}
                    <div className={`max-w-[70%] p-4 ${message.sender === "user" ? "msg-user" : "msg-ai"}`}>
                      {message.content ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      ) : (
                        <div className="flex items-center gap-1.5 py-1">
                          <span className="w-2 h-2 rounded-full bg-primary/60 typing-dot" />
                          <span className="w-2 h-2 rounded-full bg-primary/60 typing-dot" />
                          <span className="w-2 h-2 rounded-full bg-primary/60 typing-dot" />
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
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
          
          {/* Jump to Latest */}
          {showJumpToLatest && (
            <Button
              onClick={handleJumpToLatest}
              className="fixed bottom-32 left-1/2 transform -translate-x-1/2 z-10 flex items-center gap-2 bg-secondary/90 backdrop-blur-lg text-foreground border border-[rgba(255,255,255,0.1)] hover:border-primary/40 hover:shadow-gold rounded-full px-4 btn-lift"
              size="sm"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              Jump to latest
            </Button>
          )}
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 px-6 pb-4 pt-2">
          <div className="max-w-3xl mx-auto">
            <div className="chat-input-glass rounded-2xl px-4 py-3 flex gap-3 items-center">
              <Button
                size="sm"
                variant="ghost"
                className="p-2 h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 flex-shrink-0"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="What do you want to know?"
                className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/60 placeholder:italic"
              />
              <div className="flex gap-1.5 flex-shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="p-2 h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                >
                  <Mic className="w-4 h-4" />
                </Button>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading || !user}
                  className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center shadow-gold hover:shadow-gold-lg btn-lift btn-press disabled:opacity-30 disabled:bg-muted disabled:shadow-none disabled:bg-none transition-all"
                >
                  <Send className="w-3.5 h-3.5 text-gold-foreground" />
                </button>
              </div>
            </div>
            
            <div className="text-center mt-3">
              <p className="text-[10px] text-muted-foreground/60">
                By using Jurist Mind, you consent to the{' '}
                <NavLink to="/terms" className="text-primary/70 hover:text-primary hover:underline transition-colors">
                  terms and conditions
                </NavLink>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
