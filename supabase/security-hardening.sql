-- ==============================================
-- Security hardening — RLS fixes (2026-07-05)
-- Run this in Supabase Dashboard -> SQL Editor.
--
-- Fixes found in the security audit:
--   1. coupons table was publicly readable (anyone with the anon key
--      could list every promo code + discount value)
--   2. playlist_videos was publicly readable (anyone could extract the
--      paid course YouTube video IDs without an account)
--   3. course-materials storage was readable by ANY authenticated user
--      (a free signup could generate a signed URL for the paid PDF)
--   4. profiles.is_admin had no guard against self-service privilege
--      escalation (defense in depth — blocks it at the trigger level
--      regardless of what the UPDATE policy allows)
--
-- Safe to re-run: every statement drops its old object first.
-- The admin panel keeps working: service-role API calls bypass RLS,
-- and browser-side admin reads are covered by the is_admin branch.
-- ==============================================

-- 1. Coupons: admin-only read (validate-coupon.js uses the service
--    role key, which bypasses RLS, so checkout coupon entry still works)
DROP POLICY IF EXISTS "public read coupons" ON coupons;
DROP POLICY IF EXISTS "admin read coupons" ON coupons;
CREATE POLICY "admin read coupons" ON coupons FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
);

-- 2. Playlist videos: enrolled students + admins only.
--    Non-enrolled logged-in users get an empty list (the dashboard
--    doesn't show them the video tabs anyway); logged-out visitors
--    get nothing.
DROP POLICY IF EXISTS "public read playlist_videos" ON playlist_videos;
DROP POLICY IF EXISTS "enrolled or admin read playlist_videos" ON playlist_videos;
CREATE POLICY "enrolled or admin read playlist_videos" ON playlist_videos FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM enrollments
    WHERE enrollments.user_id = auth.uid() AND enrollments.status = 'active'
  )
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
);

-- 3. Course PDF storage: enrolled students + admins only
--    (was: any authenticated user)
DROP POLICY IF EXISTS "enrolled users can read pdfs" ON storage.objects;
CREATE POLICY "enrolled users can read pdfs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'course-materials'
    AND (
      EXISTS (
        SELECT 1 FROM public.enrollments
        WHERE enrollments.user_id = auth.uid() AND enrollments.status = 'active'
      )
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
    )
  );

-- 4. profiles.is_admin: only the service role may ever change it.
--    A trigger fires on every UPDATE regardless of RLS policies, so even
--    a permissive "users can update own profile" policy can't be used
--    to self-promote to admin.
CREATE OR REPLACE FUNCTION public.protect_is_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
     AND COALESCE(current_setting('request.jwt.claims', true)::json ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'is_admin can only be changed by the service role';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_is_admin_trigger ON public.profiles;
CREATE TRIGGER protect_is_admin_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_is_admin();
