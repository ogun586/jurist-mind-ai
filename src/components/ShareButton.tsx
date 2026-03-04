import { useState } from "react";
import { Share2, Copy, Check, X, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ShareButtonProps {
  sessionId: string | null;
}

export function ShareButton({ sessionId }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  if (!sessionId) return null;

  const handleShare = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-share-token", {
        body: { chat_session_id: sessionId },
      });
      if (error) throw error;
      if (data?.share_url) {
        setShareUrl(data.share_url);
      } else {
        throw new Error("No share URL returned");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to generate share link", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({ description: "Share link copied to clipboard!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpen = () => {
    setIsOpen(true);
    // Auto-generate on open
    handleShare();
  };

  const handleClose = () => {
    setIsOpen(false);
    setShareUrl(null);
  };

  return (
    <>
      <button
        onClick={handleOpen}
        title="Share this chat"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all"
      >
        <Share2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Share</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--glass-border)] bg-card shadow-2xl p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Link className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Share Chat</h3>
                  <p className="text-xs text-muted-foreground">Anyone with the link can view this chat</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[var(--glass-hover)] transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8 gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <span className="text-sm text-muted-foreground">Generating share link…</span>
              </div>
            ) : shareUrl ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-[var(--glass-border)]">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 bg-transparent text-xs text-foreground/80 outline-none truncate"
                  />
                  <button
                    onClick={handleCopy}
                    className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <Button
                  onClick={handleCopy}
                  className="w-full bg-gradient-to-r from-primary to-[hsl(42,70%,42%)] text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
                >
                  {copied ? (
                    <><Check className="w-4 h-4" /> Copied!</>
                  ) : (
                    <><Copy className="w-4 h-4" /> Copy Link</>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground/60">
                  This is a read-only view — recipients cannot reply
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center py-2">
                  Create a public link to share this conversation
                </p>
                <Button
                  onClick={handleShare}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-primary to-[hsl(42,70%,42%)] text-primary-foreground font-semibold"
                >
                  <Share2 className="w-4 h-4" />
                  Create Share Link
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
