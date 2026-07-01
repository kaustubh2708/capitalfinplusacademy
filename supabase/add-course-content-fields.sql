-- ============================================================
-- Adds course-content columns used by account.html's "My Courses"
-- dashboard cards: a PDF download link, plus the two YouTube playlist
-- columns (idempotent — safe to run even if add-youtube-playlists.sql
-- already added the playlist columns earlier).
--
-- Leave all three NULL for now — populate via the Supabase dashboard's
-- table editor per course row when real content is ready. account.html
-- already handles NULL gracefully (no PDF row / placeholder "watch on
-- YouTube" card instead of an iframe).
-- ============================================================

alter table public.courses add column if not exists pdf_url text;
alter table public.courses add column if not exists youtube_playlist_a text;
alter table public.courses add column if not exists youtube_playlist_b text;
