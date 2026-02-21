
ALTER TABLE public.jobs
ADD COLUMN requirements text,
ADD COLUMN benefits text,
ADD COLUMN experience_level text,
ADD COLUMN deadline date;
