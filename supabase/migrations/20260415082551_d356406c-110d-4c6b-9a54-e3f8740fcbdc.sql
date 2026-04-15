
-- Add new columns to juristlens_documents
ALTER TABLE public.juristlens_documents
ADD COLUMN IF NOT EXISTS word_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_msg text,
ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;

-- Add match_quality to juristlens_clauses
ALTER TABLE public.juristlens_clauses
ADD COLUMN IF NOT EXISTS match_quality text DEFAULT 'page_only'
CHECK (match_quality IN ('exact', 'approximate', 'page_only'));
