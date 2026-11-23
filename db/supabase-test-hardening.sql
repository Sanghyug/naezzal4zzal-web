-- Applied to cvwikgszywzlvadsvvvq on 2026-11-24.
-- Existing Supabase event-trigger helper stays enabled for DDL.
-- Browser roles have no reason to execute this privileged management function.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
