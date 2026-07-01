-- ============================================================
-- Adds youtube_playlist_a / youtube_playlist_b columns to courses,
-- and populates them with placeholder embed URLs per course tier.
-- account.html's new "Course Videos" section reads these for each
-- of the logged-in user's enrolled courses.
--
-- Playlist A = Trading Course Videos, Playlist B = Investing
-- Framework Videos. These are placeholders — swap in the real
-- playlist embed URLs later with a plain UPDATE, no code changes
-- needed.
--
-- Course -> playlists:
--   Self-Study           -> none (NULL/NULL — upgrade note shown instead)
--   Guided Learning       -> Playlist A only
--   CFA Academy Framework -> Playlist B only
--   Mentorship Program    -> both A and B
--
-- Safe to re-run.
-- ============================================================

alter table public.courses add column if not exists youtube_playlist_a text;
alter table public.courses add column if not exists youtube_playlist_b text;

update public.courses
set youtube_playlist_a = 'https://www.youtube.com/embed?listType=user_uploads&list=CapitalFinplusAdvizors',
    youtube_playlist_b = null
where name = 'Guided Learning';

update public.courses
set youtube_playlist_a = null,
    youtube_playlist_b = 'https://www.youtube.com/embed?listType=user_uploads&list=CapitalFinplusAdvizors'
where name = 'The CFA Academy Framework for Stock Investing';

update public.courses
set youtube_playlist_a = 'https://www.youtube.com/embed?listType=user_uploads&list=CapitalFinplusAdvizors',
    youtube_playlist_b = 'https://www.youtube.com/embed?listType=user_uploads&list=CapitalFinplusAdvizors'
where name = 'Mentorship Program';

-- Self-Study intentionally left NULL/NULL — the "Self-Study" course
-- shows the upgrade note in account.html instead of any embed.
