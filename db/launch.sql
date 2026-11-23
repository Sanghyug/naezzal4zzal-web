-- Run separately in TEST and PRODUCTION projects using the owner SQL editor.
-- No browser role may read snapshots, payment identifiers, hashes or audit records.
create table if not exists public.launch_state (
 namespace text primary key check (namespace in ('test','production')),
 body jsonb not null,
 updated_at timestamptz not null default now()
);
create table if not exists public.launch_audit (
 namespace text not null,
 event_id text not null,
 user_id text not null,
 kind text not null,
 cause text not null,
 event jsonb not null,
 created_at timestamptz not null default now(),
 primary key(namespace,event_id), unique(namespace,user_id,kind,cause)
);
alter table public.launch_state enable row level security;
alter table public.launch_audit enable row level security;
revoke all on public.launch_state, public.launch_audit from public, anon, authenticated;
-- No public policies. Only the direct server DB role transacts these tables.
-- Supabase Storage: create PRIVATE buckets launch-inputs and launch-results,
-- each in the isolated test and production project. No public bucket/policies.
