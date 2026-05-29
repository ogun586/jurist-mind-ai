import { useEffect, useState } from "react";
import { Calendar, Clock, Video, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface ScheduleSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  mode: "office" | "virtual";
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function LawyerSchedule({ lawyerId, accentColor }: { lawyerId: string; accentColor?: string }) {
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await (supabase.from as any)("lawyer_schedules")
          .select("id, day_of_week, start_time, end_time, mode")
          .eq("lawyer_id", lawyerId)
          .order("day_of_week");
        setSlots(data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [lawyerId]);

  if (loading) return null;
  if (slots.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Weekly Availability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Schedule not published yet.</p>
        </CardContent>
      </Card>
    );
  }

  const byDay = DAYS.map((day, i) => ({
    day,
    items: slots.filter((s) => s.day_of_week === i),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="w-5 h-5" /> Weekly Availability
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {byDay.map(({ day, items }) => (
            <div key={day} className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
              <div className="w-16 text-xs font-medium text-muted-foreground">{day.slice(0, 3)}</div>
              <div className="flex-1 space-y-1.5">
                {items.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Closed</span>
                ) : (
                  items.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 text-sm">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}</span>
                      <Badge variant="outline" className="text-[10px] gap-1" style={{ borderColor: accentColor }}>
                        {s.mode === "virtual" ? <Video className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                        {s.mode}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function computeAvailability(slots: ScheduleSlot[]): "available" | "busy" | "offline" {
  if (!slots || slots.length === 0) return "offline";
  const now = new Date();
  const day = now.getDay();
  const time = now.toTimeString().slice(0, 8);
  const matching = slots.filter(
    (s) => s.day_of_week === day && s.start_time <= time && s.end_time >= time
  );
  if (matching.length > 0) return "available";
  return "offline";
}