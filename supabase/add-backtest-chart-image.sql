-- ============================================================
-- Backtest chart-image feature — run once in Supabase SQL Editor
--
-- IMPORTANT: create the 'backtest-charts' bucket via the Dashboard
-- UI first (Storage -> New bucket -> name it "backtest-charts" ->
-- toggle Public ON -> Create). Direct SQL inserts into
-- storage.buckets are unreliable — Storage manages bucket metadata
-- through its own management API, not plain SQL.
-- ============================================================

-- New column on backtests for the chart screenshot's public URL
alter table public.backtests add column if not exists chart_image text;

-- Policies (safe to re-run — drops first so this never errors on a retry)
drop policy if exists "backtest_charts_public_read" on storage.objects;
create policy "backtest_charts_public_read"
  on storage.objects for select
  using (bucket_id = 'backtest-charts');

drop policy if exists "backtest_charts_admin_insert" on storage.objects;
create policy "backtest_charts_admin_insert"
  on storage.objects for insert
  with check (bucket_id = 'backtest-charts' and public.is_admin());

drop policy if exists "backtest_charts_admin_update" on storage.objects;
create policy "backtest_charts_admin_update"
  on storage.objects for update
  using (bucket_id = 'backtest-charts' and public.is_admin());

drop policy if exists "backtest_charts_admin_delete" on storage.objects;
create policy "backtest_charts_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'backtest-charts' and public.is_admin());
