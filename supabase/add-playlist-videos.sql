-- ============================================================
-- Supports the new LMS-style account.html dashboard:
--  1. site_content.academy_pdf_url — single global PDF shown on the
--     "Course PDF" tab to anyone with at least one active enrollment.
--  2. playlist_videos — per-video rows for the Guided/Framework video
--     grid tabs, gated client-side by enrollment (RLS allows public
--     read since access control happens at the app level, same pattern
--     as the rest of this site's public-readable content tables).
--
-- Note: site_content.value is jsonb (confirmed against the live table —
-- every other key stores an object), so academy_pdf_url is stored as a
-- jsonb *string* scalar, not a bare SQL string. account.html reads
-- `data.value` directly — Supabase/PostgREST already decodes a jsonb
-- string scalar to a plain JS string, no extra parsing needed.
--
-- Safe to re-run (ON CONFLICT DO NOTHING / IF NOT EXISTS throughout).
-- ============================================================

insert into site_content (key, value)
values ('academy_pdf_url', '""'::jsonb)
on conflict (key) do nothing;
-- Admin pastes the real PDF URL via the Supabase dashboard table editor,
-- e.g. update site_content set value = '"https://.../framework.pdf"'::jsonb where key = 'academy_pdf_url';

create table if not exists playlist_videos (
  id           uuid primary key default gen_random_uuid(),
  playlist_key text not null,   -- 'guided' or 'framework'
  video_id     text not null,   -- YouTube video ID
  title        text not null,
  description  text,
  sort_order   int default 0,
  created_at   timestamptz default now()
);

alter table playlist_videos enable row level security;

drop policy if exists "public read playlist_videos" on playlist_videos;
create policy "public read playlist_videos" on playlist_videos for select using (true);

-- Seed the one existing video (appears in both playlists for now as a
-- placeholder — replace/add real videos via the Supabase table editor).
-- Guarded by NOT EXISTS so re-running this file doesn't duplicate rows
-- (no natural unique constraint on this table to ON CONFLICT against).
insert into playlist_videos (playlist_key, video_id, title, description, sort_order)
select 'guided', 'SoJfOVGD2cs', 'Introduction — Capital Finplus Academy', 'Getting started with the CFA trading framework.', 1
where not exists (select 1 from playlist_videos where playlist_key = 'guided' and video_id = 'SoJfOVGD2cs');

insert into playlist_videos (playlist_key, video_id, title, description, sort_order)
select 'framework', 'SoJfOVGD2cs', 'Introduction — Capital Finplus Academy', 'Getting started with the CFA investing framework.', 1
where not exists (select 1 from playlist_videos where playlist_key = 'framework' and video_id = 'SoJfOVGD2cs');
