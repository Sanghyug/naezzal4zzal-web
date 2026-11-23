import fs from 'node:fs';
import { initialState } from '../server/launch/domain.ts';

// Generates a reviewable migration. Does not connect, read keys, or execute SQL.
const project = 'cvwikgszywzlvadsvvvq';
const state = initialState();
state.config.payments = true;
state.config.generation = true;
const schema = fs.readFileSync('db/launch.sql', 'utf8');
const json = JSON.stringify(state).replaceAll("'", "''");
const sql = `-- Apply ONLY to naezzal4zzal-test (${project}), Seoul.
-- Public project URL: https://${project}.supabase.co
-- Application must use LAUNCH_ENV=test, PAYMENT_MODE=mock.
-- Actual HeyGen generation is prohibited by the server in test namespace.
begin;
${schema}
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
values ('test','${json}'::jsonb)
on conflict(namespace) do nothing;
commit;

-- Read-only checks: no keys, user records, photos or ledger payloads returned.
select tablename,rowsecurity from pg_tables
where schemaname='public' and tablename in ('launch_state','launch_audit');
select id,public,file_size_limit,allowed_mime_types from storage.buckets
where id in ('launch-inputs','launch-results');
select namespace,body->'config' as test_configuration
from public.launch_state where namespace='test';
`;
fs.writeFileSync('db/supabase-test-setup.sql', sql);
console.log('Prepared migration for '+project+'; no remote changes made.');
