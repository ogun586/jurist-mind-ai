import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, MessageSquare, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow, isToday, isYesterday, subDays, isAfter } from "date-fns";

interface ChatSession {
  id: string;
  title: string;
  updated_at: string;
  created_at: string;
}

type DateGroup = "Today" | "Yesterday" | "Last 7 days" | "Older";

function getDateGroup(dateStr: string): DateGroup {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isAfter(date, subDays(new Date(), 7))) return "Last 7 days";
  return "Older";
}

const groupOrder: DateGroup[] = ["Today", "Yesterday", "Last 7 days", "Older"];

export default function Recent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchSessions();
  }, [user]);

  const fetchSessions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id, title, updated_at, created_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setSessions(data || []);
    } catch {
      toast({ title: "Error", description: "Failed to load chats", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, search]);

  const grouped = useMemo(() => {
    const map: Record<DateGroup, ChatSession[]> = { Today: [], Yesterday: [], "Last 7 days": [], Older: [] };
    filtered.forEach((s) => map[getDateGroup(s.updated_at)].push(s));
    return map;
  }, [filtered]);

  const handleRename = async (id: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    try {
      const { error } = await supabase.from("chat_sessions").update({ title: trimmed }).eq("id", id);
      if (error) throw error;
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title: trimmed } : s)));
      toast({ title: "Renamed", description: "Chat renamed successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to rename", variant: "destructive" });
    } finally {
      setRenamingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setDeleteTarget(null);
    try {
      const { error } = await supabase.from("chat_sessions").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Chat deleted" });
    } catch {
      fetchSessions();
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const handleNewChat = () => {
    navigate("/", { replace: true });
    window.dispatchEvent(new CustomEvent("newChat"));
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Chats</h1>
          <Button onClick={handleNewChat} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search your chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border focus-visible:ring-primary/50 focus-visible:border-primary/50"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground mb-4">No chats yet. Start a conversation to see it here.</p>
            <Button onClick={handleNewChat} className="gap-2">
              <Plus className="w-4 h-4" />
              New Chat
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">No chats found matching "{search}"</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupOrder.map((group) => {
              const items = grouped[group];
              if (items.length === 0) return null;
              return (
                <div key={group}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                    {group}
                  </p>
                  <div className="space-y-1">
                    {items.map((session) => (
                      <div
                        key={session.id}
                        className="group flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors hover:bg-primary/[0.06]"
                        onClick={() => {
                          if (renamingId !== session.id) navigate(`/chat/${session.id}`);
                        }}
                      >
                        <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />

                        <div className="flex-1 min-w-0">
                          {renamingId === session.id ? (
                            <input
                              autoFocus
                              className="w-full bg-transparent border-b border-primary text-sm text-foreground outline-none py-0.5"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRename(session.id);
                                if (e.key === "Escape") setRenamingId(null);
                              }}
                              onBlur={() => handleRename(session.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <p className="text-sm text-foreground truncate">{session.title}</p>
                          )}
                        </div>

                        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {formatDistanceToNow(new Date(session.updated_at), { addSuffix: true })}
                        </span>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10">
                              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenameValue(session.title);
                                setRenamingId(session.id);
                              }}
                            >
                              <Pencil className="w-3.5 h-3.5 mr-2" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(session.id);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this chat and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
