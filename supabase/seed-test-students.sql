-- ============================================================
-- Seed 4 test students, one per current course tier, so access
-- levels can be verified by logging in as each.
--
-- BEFORE running this:
--  1. Run add-pricing-tier-courses.sql first (this script references
--     'Self-Study' / 'Guided Learning' / 'Mentorship Program', which
--     don't exist until that migration runs).
--  2. Create the 4 auth users via Supabase Dashboard ->
--     Authentication -> Users -> Add User, with "Auto Confirm User"
--     checked (so they can log in immediately, no email needed):
--       test.selfstudy@capitalfinplus.test    / TestPass!2026
--       test.guided@capitalfinplus.test       / TestPass!2026
--       test.mentorship@capitalfinplus.test   / TestPass!2026
--       test.academy@capitalfinplus.test      / TestPass!2026
--     (any password is fine, just keep them consistent so you can
--     log in as each one from account.html to check what they see)
--
-- This script then: backfills a profiles row if the new-user trigger
-- didn't already create one, and inserts a captured payment +
-- active enrollment for each user against their course, exactly like
-- a real purchase would via verify-payment.js. Safe to re-run.
-- ============================================================

-- profiles safety net (no-op if the auth trigger already created these)
insert into public.profiles (id, email, full_name)
select id, email, raw_user_meta_data->>'full_name'
from auth.users
where email in (
  'test.selfstudy@capitalfinplus.test',
  'test.guided@capitalfinplus.test',
  'test.mentorship@capitalfinplus.test',
  'test.academy@capitalfinplus.test'
)
on conflict (id) do nothing;

-- Self-Study
with u as (select id from auth.users where email = 'test.selfstudy@capitalfinplus.test'),
     c as (select id from public.courses where name = 'Self-Study'),
     p as (
       insert into public.payments (user_id, course_id, razorpay_order_id, razorpay_payment_id, amount, status, raw_response)
       select u.id, c.id, 'order_TESTSEED01', 'pay_TESTSEED01', 860, 'captured', '{}'::jsonb from u, c
       returning id, user_id, course_id
     )
insert into public.enrollments (user_id, course_id, payment_id, status, purchased_at)
select p.user_id, p.course_id, p.id, 'active', now() from p;

-- Guided Learning
with u as (select id from auth.users where email = 'test.guided@capitalfinplus.test'),
     c as (select id from public.courses where name = 'Guided Learning'),
     p as (
       insert into public.payments (user_id, course_id, razorpay_order_id, razorpay_payment_id, amount, status, raw_response)
       select u.id, c.id, 'order_TESTSEED02', 'pay_TESTSEED02', 6500, 'captured', '{}'::jsonb from u, c
       returning id, user_id, course_id
     )
insert into public.enrollments (user_id, course_id, payment_id, status, purchased_at)
select p.user_id, p.course_id, p.id, 'active', now() from p;

-- Mentorship Program
with u as (select id from auth.users where email = 'test.mentorship@capitalfinplus.test'),
     c as (select id from public.courses where name = 'Mentorship Program'),
     p as (
       insert into public.payments (user_id, course_id, razorpay_order_id, razorpay_payment_id, amount, status, raw_response)
       select u.id, c.id, 'order_TESTSEED03', 'pay_TESTSEED03', 24000, 'captured', '{}'::jsonb from u, c
       returning id, user_id, course_id
     )
insert into public.enrollments (user_id, course_id, payment_id, status, purchased_at)
select p.user_id, p.course_id, p.id, 'active', now() from p;

-- The CFA Academy Framework for Stock Investing
with u as (select id from auth.users where email = 'test.academy@capitalfinplus.test'),
     c as (select id from public.courses where name = 'The CFA Academy Framework for Stock Investing'),
     p as (
       insert into public.payments (user_id, course_id, razorpay_order_id, razorpay_payment_id, amount, status, raw_response)
       select u.id, c.id, 'order_TESTSEED04', 'pay_TESTSEED04', 4999, 'captured', '{}'::jsonb from u, c
       returning id, user_id, course_id
     )
insert into public.enrollments (user_id, course_id, payment_id, status, purchased_at)
select p.user_id, p.course_id, p.id, 'active', now() from p;

-- Also drop each test buyer into the newsletter list, matching what a
-- real purchase does (requires add-newsletter-subscribers.sql to have run).
insert into public.newsletter_subscribers (email, name, source, course_name)
values
  ('test.selfstudy@capitalfinplus.test', 'Test Self Study', 'purchase', 'Self-Study'),
  ('test.guided@capitalfinplus.test', 'Test Guided Learning', 'purchase', 'Guided Learning'),
  ('test.mentorship@capitalfinplus.test', 'Test Mentorship', 'purchase', 'Mentorship Program'),
  ('test.academy@capitalfinplus.test', 'Test Academy', 'purchase', 'The CFA Academy Framework for Stock Investing')
on conflict (email, source) do nothing;
