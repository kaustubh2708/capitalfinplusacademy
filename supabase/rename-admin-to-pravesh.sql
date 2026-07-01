-- ============================================================
-- Sets the admin login's (connect@capitalfinplusadvizors.com)
-- display name to "Pravesh" everywhere it's shown:
--  - public.profiles.full_name (shown in the admin's Transactions/
--    Students panels, and anywhere else that joins profiles)
--  - auth.users.raw_user_meta_data.full_name (shown on account.html
--    when logged in as the admin, via user_metadata.full_name)
-- Safe to re-run.
-- ============================================================

update public.profiles
set full_name = 'Pravesh'
where email = 'connect@capitalfinplusadvizors.com';

update auth.users
set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('full_name', 'Pravesh')
where email = 'connect@capitalfinplusadvizors.com';
