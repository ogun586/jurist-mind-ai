-- Create shared_chats table
CREATE TABLE public.shared_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  share_token VARCHAR(12) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  view_count INT DEFAULT 0
);

CREATE INDEX idx_shared_chats_token ON public.shared_chats(share_token);
CREATE INDEX idx_shared_chats_user_id ON public.shared_chats(user_id);
CREATE INDEX idx_shared_chats_chat_session_id ON public.shared_chats(chat_session_id);

ALTER TABLE public.shared_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_shared_chats" ON public.shared_chats
  FOR SELECT USING (is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW()));

CREATE POLICY "users_create_own_shares" ON public.shared_chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_shares" ON public.shared_chats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_shares" ON public.shared_chats
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users_view_own_shares" ON public.shared_chats
  FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_chat_sessions_is_shared ON public.chat_sessions(is_shared);

CREATE POLICY "public_read_shared_messages" ON public.chat_messages
  FOR SELECT USING (
    session_id IN (
      SELECT chat_session_id FROM public.shared_chats 
      WHERE is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())
    )
  );

CREATE POLICY "public_read_shared_sessions" ON public.chat_sessions
  FOR SELECT USING (is_shared = TRUE);