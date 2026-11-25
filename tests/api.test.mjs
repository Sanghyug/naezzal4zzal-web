import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/extract-cells.ts';
import {createLayoutCells} from '../src/lib/photoGeometry.js';
const invoke=async(req)=>{const result={headers:{},code:200,body:null}; const res={setHeader(k,v){result.headers[k]=v},status(c){result.code=c;return this},json(v){result.body=v},end(){}};await handler({method:'POST',headers:{origin:'capacitor://localhost'},body:{image:'data:image/png;base64,aGVsbG8='},...req},res);return result;};
test('safe launch Preview blocks legacy image AI even when paid keys already exist',async()=>{const old=process.env.LAUNCH_PREVIEW_SAFE,fetch=globalThis.fetch;let calls=0;try{process.env.LAUNCH_PREVIEW_SAFE='1';globalThis.fetch=async()=>{calls++;throw Error('no paid calls')};assert.equal((await invoke({})).code,503);assert.equal(calls,0);}finally{globalThis.fetch=fetch;if(old===undefined)delete process.env.LAUNCH_PREVIEW_SAFE;else process.env.LAUNCH_PREVIEW_SAFE=old;}});
test('bad input and foreign origin never call AI',async()=>{ assert.equal((await invoke({body:{}})).code,400);assert.equal((await invoke({headers:{origin:'https://other.example'}})).code,403);assert.equal((await invoke({body:{image:'data:image/png;base64,'+'A'.repeat(4_000_001)}})).code,413);});
test('AI output, invalid boxes, network errors',async()=>{const oldFetch=globalThis.fetch, oldKey=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-only';let body;try{globalThis.fetch=async(_url,options)=>{body=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({layout:'2x2',cells:createLayoutCells('2x2',1000,1000)})}]}]})}};const result=await invoke({});assert.equal(result.body.cells.length,4);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(result.headers['Access-Control-Allow-Origin'],'capacitor://localhost');globalThis.fetch=async()=>({ok:true,json:async()=>({output_text:JSON.stringify({layout:'1x4',cells:[{x:0,y:0,width:1000,height:1000}]})})});assert.equal((await invoke({})).body.layout,'unknown');globalThis.fetch=async()=>{throw new Error('offline')};assert.equal((await invoke({})).code,502);}finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;}});

test("Preview AI allowlist is checked against the authenticated user ID and defaults to deny", async () => {
  const { requirePreviewAiAccount } = await import("../server/launch/preview.ts");
  const before = { VERCEL_ENV: process.env.VERCEL_ENV, PREVIEW_AI_TEST_USER_IDS: process.env.PREVIEW_AI_TEST_USER_IDS };
  try {
    process.env.VERCEL_ENV = "preview";
    delete process.env.PREVIEW_AI_TEST_USER_IDS;
    assert.throws(() => requirePreviewAiAccount("tester-a"), { status: 403 });
    process.env.PREVIEW_AI_TEST_USER_IDS = "tester-a, tester-b";
    assert.throws(() => requirePreviewAiAccount(undefined), { status: 403 });
    assert.throws(() => requirePreviewAiAccount("tester"), { status: 403 });
    assert.doesNotThrow(() => requirePreviewAiAccount("tester-b"));
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
