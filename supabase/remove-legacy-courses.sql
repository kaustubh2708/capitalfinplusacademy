-- ============================================================
-- Removes the legacy "Essentials" (free) and "Edge + Precision"
-- (bundle) course rows from the database now that we're standardizing
-- on exactly 4 courses: Self-Study, Guided Learning, Mentorship
-- Program, and The CFA Academy Framework for Stock Investing.
-- Their curriculum content lives on as the ESSENTIALS/EDGE/PRECISION
-- sections inside Guided Learning's and Mentorship's popups now —
-- this script only removes the old standalone course *rows*.
--
-- Safety: if either course has real payments/enrollments against it
-- (i.e. someone actually bought it historically), this script does
-- NOT delete that course — deleting it would orphan real transaction
-- history. It raises a NOTICE telling you which course was skipped
-- and how many records reference it, so you can decide manually
-- (e.g. keep the row but it's already hidden from the site either way).
-- Safe to re-run.
-- ============================================================

do $$
declare
  c record;
  payment_count int;
  enrollment_count int;
begin
  for c in select id, name from public.courses where name in ('Essentials', 'Edge + Precision') loop
    select count(*) into payment_count from public.payments where course_id = c.id;
    select count(*) into enrollment_count from public.enrollments where course_id = c.id;

    if payment_count > 0 or enrollment_count > 0 then
      raise notice 'Skipped deleting "%": % payment(s) and % enrollment(s) reference it. Row left in place (it is already hidden from the site).', c.name, payment_count, enrollment_count;
    else
      delete from public.courses where id = c.id;
      raise notice 'Deleted "%" — no payments or enrollments referenced it.', c.name;
    end if;
  end loop;
end $$;
