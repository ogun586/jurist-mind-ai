import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Mic, Paperclip, Plus, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { NavLink, useSearchParams, useNavigate } from "react-router-dom";
import { SourceDisplay } from "@/components/SourceDisplay";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  sources?: string[];
  db_id?: string;
}

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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Track scroll position and determine if auto-scroll should happen
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const threshold = 150; // pixels from bottom

    // User is near bottom
    if (distanceFromBottom <= threshold) {
      shouldAutoScrollRef.current = true;
      setShowJumpToLatest(false);
    } else {
      // User scrolled up
      shouldAutoScrollRef.current = false;
      if (messages.length > 0) {
        setShowJumpToLatest(true);
      }
    }
  }, [messages.length]);

  // Scroll to bottom when messages change (only if user is near bottom)
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Jump to latest handler
  const handleJumpToLatest = () => {
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // React to URL changes for session loading
  useEffect(() => {
    if (!user) return;
    
    const sessionId = searchParams.get('session');
    
    if (sessionId && sessionId !== currentSessionId) {
      loadSession(sessionId);
    } else if (!sessionId && currentSessionId) {
      // URL cleared, start fresh
      setMessages([]);
      setCurrentSessionId(null);
    } else if (!sessionId && !currentSessionId) {
      // Initial load without session param - load most recent
      loadMostRecentSession();
    }
  }, [user, searchParams]);

  // Listen for new chat event from sidebar
  useEffect(() => {
    const handleNewChatEvent = () => {
      setMessages([]);
      setCurrentSessionId(null);
      shouldAutoScrollRef.current = true;
      setShowJumpToLatest(false);
      // Focus input after clearing
      setTimeout(() => inputRef.current?.focus(), 100);
    };
    
    window.addEventListener('newChat', handleNewChatEvent);
    return () => window.removeEventListener('newChat', handleNewChatEvent);
  }, []);

  // Realtime subscription for new messages
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
            if (prev.some(msg => msg.db_id === newMsg.id)) {
              return prev;
            }
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

    return () => {
      supabase.removeChannel(channel);
    };
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
      
      if (data) {
        // Update URL without reload
        navigate(`/?session=${data.id}`, { replace: true });
      }
    } catch (error) {
      console.error('Error loading recent session:', error);
    }
  };

  const createNewSession = async () => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          title: 'New Chat'
        })
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
        .insert({
          session_id: sessionId,
          content,
          sender
        })
        .select('id, created_at')
        .single();
      
      if (error) throw error;
      
      await supabase
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);
        
      console.log('Message saved successfully:', sender, content.substring(0, 50), 'ID:', data?.id);
      return data?.id || null;
    } catch (error) {
      console.error('Error saving message:', error);
      toast({
        title: "Warning",
        description: "Message may not have been saved",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateSessionTitle = async (sessionId: string, firstMessage: string) => {
    const title = firstMessage.length > 50 ? firstMessage.substring(0, 50) + '...' : firstMessage;
    try {
      await supabase
        .from('chat_sessions')
        .update({ title })
        .eq('id', sessionId);
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
      toast({
        title: "Authentication Required",
        description: "Please sign in to chat with JURIST MIND",
        variant: "destructive",
      });
      return;
    }

    // Check if user can make request (usage limits)
    try {
      const { data: usageCheck, error: usageError } = await supabase.functions.invoke('check-ai-usage');
      
      if (usageError || !usageCheck?.allowed) {
        const reason = usageCheck?.reason || 'Usage limit reached';
        toast({
          title: "Usage Limit Reached",
          description: `${reason} - Upgrade your plan to continue!`,
          variant: "destructive",
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/upgrade')}
            >
              Upgrade Now
            </Button>
          ),
        });
        return;
      }

      if (usageCheck.requests_remaining > 0 && usageCheck.requests_remaining < 10) {
        toast({
          title: "Usage Notice",
          description: `You have ${usageCheck.requests_remaining} requests remaining today`,
        });
      }
    } catch (error) {
      console.error('Error checking usage:', error);
      toast({
        title: "Error",
        description: "Failed to check usage limits. Please try again.",
        variant: "destructive",
      });
      return;
    }

    let sessionId = currentSessionId;
    
    // Create new session if none exists
    if (!sessionId) {
      sessionId = await createNewSession();
      if (!sessionId) {
        toast({
          title: "Error",
          description: "Failed to create chat session",
          variant: "destructive",
        });
        return;
      }
      setCurrentSessionId(sessionId);
      // Update URL with new session
      navigate(`/?session=${sessionId}`, { replace: true });
    }

    const userMessageContent = inputValue;
    const tempMessageId = Date.now().toString();
    
    // Enable auto-scroll when sending a message
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
    
    const newMessage: Message = {
      id: tempMessageId,
      content: userMessageContent,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue("");
    setIsLoading(true);

    // Save user message and get db_id
    const userDbId = await saveMessage(sessionId, userMessageContent, 'user');
    if (userDbId) {
      setMessages(prev => prev.map(msg => 
        msg.id === tempMessageId ? { ...msg, db_id: userDbId } : msg
      ));
    }
    
    // Update title if first message
    if (messages.length === 0) {
      await updateSessionTitle(sessionId, userMessageContent);
    }

    // Add placeholder AI message
    const aiTempId = (Date.now() + 1).toString();
    const aiPlaceholder: Message = {
      id: aiTempId,
      content: "",
      sender: "ai",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, aiPlaceholder]);

    try {
      const formData = new FormData();
      formData.append('question', userMessageContent);
      if (sessionId) formData.append('chat_id', sessionId);
      if (user?.id) formData.append('user_id', user.id);
      
      const response = await fetch('https://juristmind.onrender.com/ask', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      if (!response.body) {
        throw new Error('No response body from server');
      }

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
            
            if (dataStr === "[DONE]") {
              done = true;
              break;
            }
            
            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                fullContent += data.content;
                setMessages(prev => prev.map(msg => 
                  msg.id === aiTempId 
                    ? { ...msg, content: fullContent }
                    : msg
                ));
              }
              if (data.type === "done") {
                done = true;
              }
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
          setMessages(prev => prev.map(msg => 
            msg.id === aiTempId 
              ? { ...msg, content: fullContent }
              : msg
          ));
        } catch {
          fullContent = "Response received but could not be parsed.";
        }
      }
      
      if (fullContent) {
        const aiDbId = await saveMessage(sessionId, fullContent, 'ai');
        if (aiDbId) {
          setMessages(prev => prev.map(msg => 
            msg.id === aiTempId ? { ...msg, db_id: aiDbId } : msg
          ));
        }
      }
      
      try {
        await supabase.functions.invoke('increment-ai-usage', {
          body: { points: 1 }
        });
      } catch (error) {
        console.error('Error incrementing usage:', error);
      }
      
    } catch (error) {
      console.error('Error calling AI:', error);
      toast({
        title: "Error",
        description: "Failed to connect to AI assistant. Please try again later.",
        variant: "destructive",
      });
      
      const errorContent = "I'm having trouble connecting right now. Please try again later.";
      
      setMessages(prev => prev.map(msg => 
        msg.id === aiTempId 
          ? { ...msg, content: errorContent }
          : msg
      ));
      
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
        console.log('No messages found for session:', sessionId);
        setMessages([]);
        setCurrentSessionId(sessionId);
        return;
      }
      
      const loadedMessages: Message[] = data.map((msg) => ({
        id: msg.id,
        db_id: msg.id,
        content: msg.content,
        sender: msg.sender as 'user' | 'ai',
        timestamp: new Date(msg.created_at),
        sources: [],
      }));
      
      setMessages(loadedMessages);
      setCurrentSessionId(sessionId);
      shouldAutoScrollRef.current = true;
      setShowJumpToLatest(false);
      console.log('Loaded', loadedMessages.length, 'messages for session:', sessionId);
      
      // Scroll to bottom after loading
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 100);
    } catch (error) {
      console.error('Error loading session:', error);
      toast({
        title: "Error",
        description: "Failed to load chat session",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-full bg-background">
      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 h-full">
        {/* Header with New Chat button */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h1 className="text-xl font-semibold">JURIST MIND</h1>
          <Button
            onClick={handleNewChat}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 min-w-[100px] h-10"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>
        
        {/* Messages Area with scroll tracking */}
        <div 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto relative"
        >
          <div className="max-w-4xl mx-auto p-6">
            {messages.length === 0 ? (
              <div className="text-center py-20">
                <h2 className="text-4xl font-bold text-foreground mb-8">JURIST MIND</h2>
                <p className="text-lg text-muted-foreground mb-12">
                  {user ? "What do you want to know?" : "Please sign in to start chatting"}
                </p>
                {!user && (
                  <Button 
                    onClick={() => navigate('/auth')}
                    className="mt-4 bg-foreground text-background hover:bg-foreground/90"
                  >
                    Sign In to Continue
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-2xl p-4 rounded-2xl ${
                        message.sender === "user"
                          ? "bg-foreground text-background"
                          : "bg-transparent border border-border"
                      }`}
                    >
                      {message.content ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      ) : (
                        <p className="text-sm leading-relaxed text-muted-foreground">Thinking...</p>
                      )}
                      <p className="text-xs opacity-70 mt-2">
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
          
          {/* Jump to Latest button */}
          {showJumpToLatest && (
            <Button
              onClick={handleJumpToLatest}
              className="fixed bottom-32 left-1/2 transform -translate-x-1/2 z-10 shadow-lg flex items-center gap-2 bg-foreground text-background hover:bg-foreground/90"
              size="sm"
            >
              <ArrowDown className="w-4 h-4" />
              Jump to latest
            </Button>
          )}
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3 items-center">
              <Button
                size="sm"
                variant="ghost"
                className="p-2 h-10 w-10 rounded-full"
              >
                <Paperclip className="w-5 h-5" />
              </Button>
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="What do you want to know?"
                  className="pr-20 py-3 text-base bg-transparent border border-border focus:ring-primary focus:border-primary rounded-full"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="p-2 h-8 w-8 rounded-full"
                  >
                    <Mic className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isLoading || !user}
                    size="sm"
                    className="p-2 h-8 w-8 rounded-full bg-foreground text-background hover:bg-foreground/90"
                  >
                    <Send className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Terms and Conditions */}
            <div className="text-center mt-4">
              <p className="text-xs text-muted-foreground">
                By using Jurist Mind, you consent to the{' '}
                <NavLink to="/terms" className="text-primary hover:underline">
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
