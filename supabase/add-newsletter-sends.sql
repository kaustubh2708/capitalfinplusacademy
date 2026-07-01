-- Newsletter send history table
-- Run once in Supabase SQL editor.
-- Required for "Send History" table in admin Send Newsletter panel.

create table if not exists public.newsletter_sends (
  id             uuid primary key default gen_random_uuid(),
  subject        text not null,
  audience       text not null default 'all',  -- 'all' | 'signups' | 'buyers'
  recipient_count integer not null default 0,
  sent_at        timestamptz not null default now()
);

alter table public.newsletter_sends enable row level security;

create policy "Admin full access" on public.newsletter_sends
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
