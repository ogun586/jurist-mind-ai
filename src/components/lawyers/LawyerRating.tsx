import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface LawyerRatingProps {
  lawyerId: string;
  currentRating: number;
  totalRatings: number;
  accentColor?: string;
  onRatingUpdated?: () => void;
}

export default function LawyerRating({
  lawyerId,
  currentRating,
  totalRatings,
  accentColor = 'hsl(var(--primary))',
  onRatingUpdated
}: LawyerRatingProps) {
  const navigate = useNavigate();
  const [hoveredRating, setHoveredRating] = useState(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkUserAndRating();
  }, [lawyerId]);

  const checkUserAndRating = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      // Check if user already rated this lawyer
      const { data: existingRating } = await supabase
        .from('lawyer_ratings')
        .select('rating')
        .eq('lawyer_id', lawyerId)
        .eq('user_id', user.id)
        .single();
      
      if (existingRating) {
        setUserRating(existingRating.rating);
      }
    }
  };

  const handleRating = async (rating: number) => {
    if (!userId) {
      toast.error('Please sign in to rate', {
        action: {
          label: 'Sign In',
          onClick: () => navigate('/auth')
        }
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (userRating) {
        // Update existing rating
        const { error } = await supabase
          .from('lawyer_ratings')
          .update({ rating, updated_at: new Date().toISOString() })
          .eq('lawyer_id', lawyerId)
          .eq('user_id', userId);
        
        if (error) throw error;
        toast.success('Rating updated!');
      } else {
        // Insert new rating
        const { error } = await supabase
          .from('lawyer_ratings')
          .insert({ lawyer_id: lawyerId, user_id: userId, rating });
        
        if (error) throw error;
        toast.success('Thanks for rating!');
      }
      
      setUserRating(rating);
      onRatingUpdated?.();
    } catch (error: any) {
      console.error('Error submitting rating:', error);
      toast.error('Failed to submit rating');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayRating = hoveredRating || userRating || 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div 
          className="flex items-center gap-0.5"
          onMouseLeave={() => setHoveredRating(0)}
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              disabled={isSubmitting}
              className="p-0.5 transition-transform hover:scale-110 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
              onMouseEnter={() => setHoveredRating(star)}
              onClick={() => handleRating(star)}
              aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
            >
              <Star
                className={`w-6 h-6 transition-colors ${
                  star <= displayRating
                    ? 'fill-amber-400 text-amber-400'
                    : star <= Math.floor(currentRating) && !hoveredRating && !userRating
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-muted-foreground/30 hover:text-amber-300'
                }`}
              />
            </button>
          ))}
        </div>
        <span className="font-semibold text-foreground">{currentRating.toFixed(1)}</span>
        <span className="text-muted-foreground">({totalRatings} reviews)</span>
      </div>
      
      {userRating && (
        <p className="text-xs text-muted-foreground">
          Your rating: {userRating} star{userRating > 1 ? 's' : ''}
        </p>
      )}
      
      {!userId && (
        <p className="text-xs text-muted-foreground">
          <button 
            onClick={() => navigate('/auth')}
            className="text-primary hover:underline"
          >
            Sign in
          </button>
          {' '}to rate this lawyer
        </p>
      )}
    </div>
  );
}