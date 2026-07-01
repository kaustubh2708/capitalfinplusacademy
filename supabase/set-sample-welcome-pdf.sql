-- ============================================================
-- Points all 4 courses' pdf_url at the sample welcome guide
-- (v6/assets/welcome-guide.pdf, served as a static file — no Supabase
-- Storage needed) so the "Download Course PDF" button has something to
-- show right now. Replace each with the real course-specific PDF later
-- with a plain UPDATE — no code changes needed.
-- Safe to re-run.
-- ============================================================

update public.courses
set pdf_url = 'https://capitalfinplusadvizors.com/assets/welcome-guide.pdf'
where name in ('Self-Study', 'Guided Learning', 'Mentorship Program', 'The CFA Academy Framework for Stock Investing');
