-- Create lawyer_ratings table for storing individual ratings
CREATE TABLE public.lawyer_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lawyer_id UUID NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lawyer_id, user_id) -- One rating per user per lawyer
);

-- Enable RLS
ALTER TABLE public.lawyer_ratings ENABLE ROW LEVEL SECURITY;

-- Users can view all ratings
CREATE POLICY "Everyone can view ratings"
ON public.lawyer_ratings
FOR SELECT
USING (true);

-- Users can create their own ratings
CREATE POLICY "Authenticated users can create ratings"
ON public.lawyer_ratings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own ratings
CREATE POLICY "Users can update their own ratings"
ON public.lawyer_ratings
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own ratings
CREATE POLICY "Users can delete their own ratings"
ON public.lawyer_ratings
FOR DELETE
USING (auth.uid() = user_id);

-- Create function to update lawyer's average rating
CREATE OR REPLACE FUNCTION public.update_lawyer_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update the lawyer's rating and total_ratings
  UPDATE public.lawyers
  SET 
    rating = COALESCE((
      SELECT AVG(rating)::numeric(2,1)
      FROM public.lawyer_ratings
      WHERE lawyer_id = COALESCE(NEW.lawyer_id, OLD.lawyer_id)
    ), 0),
    total_ratings = (
      SELECT COUNT(*)
      FROM public.lawyer_ratings
      WHERE lawyer_id = COALESCE(NEW.lawyer_id, OLD.lawyer_id)
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.lawyer_id, OLD.lawyer_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger to update lawyer rating after insert/update/delete
CREATE TRIGGER update_lawyer_rating_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.lawyer_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_lawyer_rating();