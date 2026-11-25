import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,signup,grant,balance,reserveJob,settle,dailyAiCost,dayKst} from '../server/launch/domain.ts';
import {upgradeWelcomePolicy,sqliteStore} from '../server/launch/store.ts';
import {clientMetric,capturePayload,observeChanges,analyticsReady,recordMetric,flushMetrics} from '../server/launch/telemetry.ts';
import {openaiUsage,reconcileUsage,costReport,fetchOpenAI,videoUsage} from '../server/launch/costs.ts';
import {mkdtemp} from 'node:fs/promises';import path from 'node:path';
const at=Date.now(),join=(s,id)=>signup(s,id,'identity-'+id,at,undefined,at);
test('welcome migration keeps every legacy credit and entry; runs once and preserves operator limits',()=>{
 const s=initialState();s.config.gifts=false;join(s,'old');grant(s,'old','free',5,'signup:old',at,'signup_gift');s.config.gifts=true;s.config.giftLimit=100;delete s.welcomePolicyVersion;
 const old=JSON.stringify({users:s.users,lots:s.lots,entries:s.entries});upgradeWelcomePolicy(s);assert.equal(s.config.giftLimit,1000);assert.equal(JSON.stringify({users:s.users,lots:s.lots,entries:s.entries}),old);
 join(s,'new');assert.equal(balance(s,'new').available,4);assert.equal(balance(s,'old').available,5);s.config.giftLimit=200;upgradeWelcomePolicy(s);assert.equal(s.config.giftLimit,200);
 const custom=initialState();delete custom.welcomePolicyVersion;custom.config.giftLimit=42;upgradeWelcomePolicy(custom);assert.equal(custom.config.giftLimit,42);
});
test('first 1000 eligible signups receive four exactly once, with no grant to signup 1001 or repeated identity',()=>{
 const s=initialState();for(let i=0;i<1001;i++)join(s,'u'+i);assert.equal(s.entries.filter(e=>e.kind==='signup_gift').length,1000);assert.equal(balance(s,'u999').available,4);assert.equal(balance(s,'u1000').available,0);join(s,'u0');signup(s,'duplicate','identity-u0',at,undefined,at);assert.equal(s.entries.length,1000);
});
test('welcome four makes one memory and one drawing and successful completion consumes once',()=>{
 const s=initialState();s.config.generation=true;join(s,'u');const watch=observeChanges(s);for(const style of ['memory','drawing']){const j=reserveJob(s,'u',style,style,style,at);settle(s,j.id,true,at);}watch();watch();assert.equal(balance(s,'u').available,0);const e=Object.values(s.telemetry.events).filter(e=>e.event==='welcome_consumed');assert.equal(e.length,2);assert.equal(e.reduce((n,e)=>n+e.properties.credits,0),4);
});
test('analytics strict properties and hashed payload cannot transmit images, email, URLs, tokens or raw IDs',()=>{
 const dirty={source:'upload',style:'memory',constructor:'private@example.test',toString:'private@example.test',email:'private@example.test',image:'data:image/png;base64,private',url:'https://example.test/?code=secret',token:'secret',outcome:'private@example.test'};
 const clean=clientMetric('photo_selected',dirty);assert.deepEqual(clean.properties,{source:'upload',style:'memory'});assert.equal(clientMetric('private@example.test',dirty),null);
 const payload=capturePayload([{id:'entry-secret',subject:'raw-user-secret',at,event:clean.event,properties:clean.properties}],'project-key','secret');const text=JSON.stringify(payload);for(const forbidden of ['private@example.test','base64','raw-user-secret','entry-secret','?code='])assert.equal(text.includes(forbidden),false);assert.equal(payload.batch[0].properties.$process_person_profile,false);assert.equal(payload.batch[0].properties.$ip,null);
});
test('dedicated PostHog destination refuses ChantKPop and disabled config makes zero requests',async()=>{
 const saved={...process.env};const oldFetch=global.fetch;let calls=0;global.fetch=async()=>{calls++;throw Error('not allowed');};try{process.env.POSTHOG_ENABLED='1';process.env.POSTHOG_PROJECT_ID='737937';process.env.POSTHOG_4ZZAL_KEY='test';assert.equal(analyticsReady(),false);await flushMetrics({tx:async()=>{throw Error('must not read');}},'secret');assert.equal(calls,0);}finally{process.env=saved;global.fetch=oldFetch;}
});
test('token estimate separates cached tokens, unknown usage and actual invoice; no model or media change',()=>{
 const s=initialState();const r=openaiUsage('extraction',{model:'gpt-5.4',status:'completed',usage:{input_tokens:1000000,input_tokens_details:{cached_tokens:200000},output_tokens:1000}},'usage');assert.equal(r.estimatedUsd,4.1225);assert.equal(r.actualBilledUsd,null);assert.equal(openaiUsage('motion',{}).estimatedUsd,null);s.usage={[r.id]:r};reconcileUsage(s,r.id,.42,'invoice-20261126','청구서 대조 완료');assert.equal(r.actualBilledUsd,.42);assert.equal(costReport(s).daily[dayKst(r.at)].actualBilledUsd,.42);assert.throws(()=>reconcileUsage(s,r.id,-1,'invoice-1','invalid'));
});
test('failed or invalid OpenAI response records unknown cost without response content',async()=>{
 const old=global.fetch;const recorded=[];global.fetch=async()=>new Response(JSON.stringify({status:'failed',output_text:'private photo description'}),{status:502});try{await fetchOpenAI(async r=>recorded.push(r),'motion','https://api.openai.com/v1/responses',{});assert.equal(recorded.length,1);assert.equal(recorded[0].estimatedUsd,null);assert.equal(JSON.stringify(recorded).includes('private photo'),false);}finally{global.fetch=old;}
});
test('free extraction, motion cost and reconciled video costs block new spending at daily limit',()=>{
 const s=initialState();s.config.generation=true;join(s,'u');s.rates['extract-cost:'+dayKst(at)]={count:1,until:at+86400000};s.usage={m:{...openaiUsage('motion',{model:'gpt-5.4',status:'completed',usage:{input_tokens:1000,output_tokens:1000}},'m'),at}};s.config.dailyUsd=.2;assert.ok(dailyAiCost(s,dayKst(at))>.05);assert.throws(()=>reserveJob(s,'u','blocked','fp','memory',at));s.config.dailyUsd=1;s.config.memoryReserveUsd=.4;const j=reserveJob(s,'u','ok','fp','memory',at);assert.equal(j.reserveUsd,.4);
});
test('durable authoritative signup telemetry survives retries and never backfills historical users',async()=>{
 const dir=await mkdtemp(path.resolve('artifacts/launch/metrics-'));const store=await sqliteStore(path.join(dir,'db'));await store.tx(s=>join(s,'u'));await store.tx(s=>join(s,'u'));const s=await store.tx(s=>s);assert.equal(Object.values(s.telemetry.events).filter(e=>e.event==='signup').length,1);assert.equal(Object.values(s.telemetry.events).filter(e=>e.event==='welcome_granted').length,1);
});

test('HeyGen December rate changes estimates only; reserved budget and invoice remain separate',()=>{
 const s=initialState();const job={id:'j',style:'drawing',allocations:[],status:'processing',reserveUsd:.22,created:Date.UTC(2026,10,30),providerId:'provider-id'};const promo=videoUsage(job,s);assert.ok(Math.abs(promo.estimatedUsd-.175)<1e-9);assert.equal(promo.budgetReservedUsd,.22);const regular=videoUsage({...job,submittedAt:Date.UTC(2026,11,1)},s);assert.equal(regular.estimatedUsd,.2);assert.equal(regular.actualBilledUsd,null);assert.equal(regular.resolution,'480p');assert.equal(regular.seconds,5);
});

test('dedicated project transport retries with stable event IDs and marks sent only after success',async()=>{
 const saved={...process.env}, old=global.fetch, s=initialState();recordMetric(s,'signup','private-user',{},'stable-entry');const requests=[];process.env.POSTHOG_ENABLED='1';process.env.POSTHOG_PROJECT_ID='999999';process.env.POSTHOG_4ZZAL_KEY='test-key';process.env.VERCEL_ENV='production';const store={tx:async fn=>fn(s)};let succeeds=false;global.fetch=async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return new Response('',{status:succeeds?200:503});};try{await flushMetrics(store,'secret');assert.equal(s.telemetry.events['stable-entry'].sent,undefined);succeeds=true;await flushMetrics(store,'secret');assert.equal(requests[0].body.batch[0].uuid,requests[1].body.batch[0].uuid);assert.equal(requests[1].url,'https://us.i.posthog.com/batch/');assert.ok(s.telemetry.events['stable-entry'].sent);await flushMetrics(store,'secret');assert.equal(requests.length,2);assert.equal(s.telemetry.daily[dayKst(Date.now())].signup,1);}finally{process.env=saved;global.fetch=old;}
});
