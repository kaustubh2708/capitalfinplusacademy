-- Run AFTER the notify-form.js change is deployed.
-- Leads are now written server-side by /api/notify-form (service role,
-- after its bot checks), so the public browser INSERT on form_submissions
-- is no longer needed — and it is how bots bypass those checks by posting
-- straight to Supabase's REST API with the public key.
-- Drops every INSERT policy on the table; admin SELECT/UPDATE policies stay.
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'form_submissions' and cmd = 'INSERT'
  loop
    execute format('drop policy %I on public.form_submissions', pol.policyname);
    raise notice 'Dropped insert policy: %', pol.policyname;
  end loop;
end $$;

-- Check: this should return no INSERT rows.
select policyname, cmd, roles from pg_policies
where schemaname = 'public' and tablename = 'form_submissions';
