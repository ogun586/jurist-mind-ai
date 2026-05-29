import { MessageSquare, Phone, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StickyMobileActions({
  email,
  phone,
  onBook,
  accentColor,
}: {
  email?: string;
  phone?: string;
  onBook: () => void;
  accentColor?: string;
}) {
  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur px-3 py-2 flex gap-2">
      <Button
        variant="outline"
        className="flex-1"
        onClick={() => email && (window.location.href = `mailto:${email}`)}
      >
        <MessageSquare className="w-4 h-4 mr-2" /> Message
      </Button>
      <Button
        variant="outline"
        className="flex-1"
        onClick={() => phone && (window.location.href = `tel:${phone}`)}
      >
        <Phone className="w-4 h-4 mr-2" /> Call
      </Button>
      <Button
        className="flex-1"
        style={accentColor ? { backgroundColor: accentColor } : undefined}
        onClick={onBook}
      >
        <Calendar className="w-4 h-4 mr-2" /> Book
      </Button>
    </div>
  );
}