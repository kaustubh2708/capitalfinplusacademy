-- Video watch progress tracking for LMS dashboard

CREATE TABLE IF NOT EXISTS video_progress (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id   TEXT NOT NULL,
  watched    BOOLEAN DEFAULT true,
  watched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, video_id)
);

ALTER TABLE video_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own progress" ON video_progress
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
