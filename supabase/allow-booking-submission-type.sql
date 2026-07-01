-- ============================================================
-- form_submissions: allow 'booking' as a submission type
-- The "Book a Discovery Call" modal records type='booking', but the
-- original migration's check constraint only allowed
-- ('contact', 'masterclass'). Run once in Supabase's SQL Editor.
-- ============================================================

alter table public.form_submissions drop constraint if exists form_submissions_type_check;
alter table public.form_submissions add constraint form_submissions_type_check
  check (type in ('contact', 'masterclass', 'booking'));
