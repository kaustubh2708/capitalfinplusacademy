-- ============================================================
-- newsletter_subscribers: combined list for the blog page's
-- "Stay in the Loop" signup form (source='signup') AND every
-- verified course purchase, added automatically server-side
-- (source='purchase', see api/verify-payment.js). Shown in the
-- admin's new Newsletter panel.
--
-- course_id is stored as plain text, NOT a uuid/FK — the site's
-- "courseId" everywhere else (payment links, Razorpay order notes)
-- is the data.js-style id (e.g. "4"), not the Supabase courses.id
-- uuid, so a uuid column here would fail on every insert.
--
-- Run once in Supabase's SQL Editor.
-- ============================================================

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text default '',
  source text not null check (source in ('signup', 'purchase')),
  course_id text,
  course_name text default '',
  subscribed_at timestamptz not null default now(),
  unique (email, source)
);

alter table public.newsletter_subscribers enable row level security;

-- The blog page's signup form inserts directly with the anon key;
-- verified purchases are inserted server-side with the service role key
-- (which bypasses RLS entirely, so it doesn't need a policy here).
drop policy if exists "Public can insert newsletter signups" on public.newsletter_subscribers;
create policy "Public can insert newsletter signups" on public.newsletter_subscribers
  for insert
  to anon
  with check (source = 'signup');

-- Only signed-in admins can read the list.
drop policy if exists "Admins can view newsletter subscribers" on public.newsletter_subscribers;
create policy "Admins can view newsletter subscribers" on public.newsletter_subscribers
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );
