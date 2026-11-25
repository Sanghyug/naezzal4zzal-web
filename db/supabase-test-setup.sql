-- Apply ONLY to naezzal4zzal-test (cvwikgszywzlvadsvvvq), Seoul.
-- Public project URL: https://cvwikgszywzlvadsvvvq.supabase.co
-- Application must use LAUNCH_ENV=test, PAYMENT_MODE=mock.
-- Actual HeyGen generation is prohibited by the server in test namespace.
begin;
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

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
 ('launch-inputs','launch-inputs',false,4194304,array['application/json']),
 ('launch-results','launch-results',false,12582912,array['video/mp4'])
on conflict(id) do update set
 public=false,
 file_size_limit=excluded.file_size_limit,
 allowed_mime_types=excluded.allowed_mime_types;

-- Existing test ledger is NEVER overwritten or reset.
insert into public.launch_state(namespace,body)
values ('test','{"config":{"gifts":true,"invites":true,"payments":true,"generation":true,"giftLimit":1000,"inviteMonthly":5,"dailyJobs":100,"dailyUsd":15,"retentionDays":7},"users":{},"lots":{},"entries":[],"orders":{},"jobs":{},"visits":{},"renders":{},"rewarded":{},"rates":{},"cache":{},"deletedIdentities":[],"mockPayments":{},"version":1}'::jsonb)
on conflict(namespace) do nothing;
commit;

-- Read-only checks: no keys, user records, photos or ledger payloads returned.
select tablename,rowsecurity from pg_tables
where schemaname='public' and tablename in ('launch_state','launch_audit');
select id,public,file_size_limit,allowed_mime_types from storage.buckets
where id in ('launch-inputs','launch-results');
select namespace,body->'config' as test_configuration
from public.launch_state where namespace='test';
