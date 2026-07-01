-- ============================================================
-- Gives the admin login (connect@capitalfinplusadvizors.com) an
-- active enrollment in EVERY course — so logging in as the admin on
-- the public site (not the /admin dashboard) shows exactly what a
-- fully-enrolled student sees everywhere: all premium blog posts,
-- all backtests, every course listed under "My Account".
--
-- Requires the connect@capitalfinplusadvizors.com auth user to
-- already exist (it should, since that's the admin dashboard login).
-- Safe to re-run — skips any course it's already enrolled in.
-- ============================================================

do $$
declare
  admin_user_id uuid;
begin
  select id into admin_user_id from auth.users where email = 'connect@capitalfinplusadvizors.com';
  if admin_user_id is null then
    raise exception 'No auth user found for connect@capitalfinplusadvizors.com — create that login first (Supabase Dashboard -> Authentication -> Users), then re-run this script.';
  end if;

  insert into public.profiles (id, email, full_name)
  values (admin_user_id, 'connect@capitalfinplusadvizors.com', 'Capital Finplus Admin')
  on conflict (id) do nothing;

  insert into public.payments (user_id, course_id, razorpay_order_id, razorpay_payment_id, amount, status, raw_response)
  select admin_user_id, c.id, 'order_ADMINACCESS_' || c.id, 'pay_ADMINACCESS_' || c.id, 0, 'captured', '{}'::jsonb
  from public.courses c
  where not exists (
    select 1 from public.enrollments e where e.user_id = admin_user_id and e.course_id = c.id
  );

  insert into public.enrollments (user_id, course_id, payment_id, status, purchased_at)
  select p.user_id, p.course_id, p.id, 'active', now()
  from public.payments p
  where p.user_id = admin_user_id
    and p.razorpay_order_id like 'order_ADMINACCESS_%'
    and not exists (
      select 1 from public.enrollments e where e.user_id = p.user_id and e.course_id = p.course_id
    );
end $$;
