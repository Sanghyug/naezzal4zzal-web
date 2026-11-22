import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/videos.ts';
const image='data:image/jpeg;base64,/9j/AA==';
async function invoke(overrides={}) {
  const result={code:200,headers:{},body:null};
  const res={setHeader(k,v){result.headers[k]=v},status(c){result.code=c;return this},json(b){result.body=b},end(bytes){result.file=bytes}};
  await handler({method:'POST',headers:{origin:'capacitor://localhost'},body:{images:[image,image,image,image],consent:true,accessCode:'office-test',requestId:'12345678-1234-1234-1234-123456789abc'},...overrides},res);
  return result;
}
test('video API rejects unconfigured, foreign, unsigned and unconsented requests without contacting HeyGen',async()=>{
 const key=process.env.HEYGEN_API_KEY,code=process.env.VIDEO_TEST_CODE,fetch=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;throw Error('must not call')};
  delete process.env.HEYGEN_API_KEY;delete process.env.VIDEO_TEST_CODE;
  assert.equal((await invoke({method:'GET',query:{action:'config'}})).body.available,false);
  assert.equal((await invoke()).code,503);
  process.env.HEYGEN_API_KEY='test-key';process.env.VIDEO_TEST_CODE='office-test';
  assert.equal((await invoke({headers:{origin:'https://foreign.example'}})).code,403);
  assert.equal((await invoke({method:'GET',query:{videoId:'foreign'}})).code,401);
  assert.equal((await invoke({body:{accessCode:'wrong'}})).code,403);
  assert.equal((await invoke({body:{accessCode:'office-test',consent:false}})).code,400);
  assert.equal((await invoke({body:{accessCode:'office-test',consent:true,requestId:'12345678-1234-1234-1234-123456789abc',images:[image]}})).code,400);
  assert.equal(calls,0);
 }finally{globalThis.fetch=fetch;if(key===undefined)delete process.env.HEYGEN_API_KEY;else process.env.HEYGEN_API_KEY=key;if(code===undefined)delete process.env.VIDEO_TEST_CODE;else process.env.VIDEO_TEST_CODE=code;}
});
test('video creation uses four references, server-only key and stable idempotency; signed polling scopes access',async()=>{
 const key=process.env.HEYGEN_API_KEY,code=process.env.VIDEO_TEST_CODE,fetch=globalThis.fetch;const requests=[];
 try{
  process.env.HEYGEN_API_KEY='test-key';process.env.VIDEO_TEST_CODE='office-test';
  globalThis.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({data:options.method==='POST'?{video_id:'test-video',status:'pending'}:{status:'completed',video_url:'https://example.com/result.mp4'}})}};
  const a=await invoke(),b=await invoke();assert.equal(a.code,202);
  assert.equal(requests[0].options.headers['Idempotency-Key'],requests[1].options.headers['Idempotency-Key']);
  assert.equal(requests[0].options.headers['x-api-key'],'test-key');
  const payload=JSON.parse(requests[0].options.body);assert.equal(payload.reference_images.length,4);assert.equal(payload.duration,5);assert.equal(payload.mode,'reference_to_video');
  assert.ok(!JSON.stringify(a.body).includes('test-key'));
  const result=await invoke({method:'GET',headers:{authorization:'Bearer '+a.body.token}});assert.equal(result.body.status,'completed');assert.equal(result.body.videoUrl,'https://example.com/result.mp4');
  const signedToken=a.body.token;const tampered=(signedToken[0]==='a'?'b':'a')+signedToken.slice(1);
  assert.equal((await invoke({method:'GET',headers:{authorization:'Bearer '+tampered}})).code,401);
  assert.equal(requests.length,3);
  globalThis.fetch=async()=>({ok:false,status:402,json:async()=>({error:{code:'insufficient_credit',message:'private vendor message'}})});
  const failure=await invoke();assert.match(failure.body.error,/잔액/);assert.ok(!JSON.stringify(failure.body).includes('private'));
  globalThis.fetch=async()=>{throw Error('network')};assert.equal((await invoke()).code,504);
 }finally{globalThis.fetch=fetch;if(key===undefined)delete process.env.HEYGEN_API_KEY;else process.env.HEYGEN_API_KEY=key;if(code===undefined)delete process.env.VIDEO_TEST_CODE;else process.env.VIDEO_TEST_CODE=code;}
});

test('completed video file is served only with its signed token, with type and payload limits',async()=>{
 const key=process.env.HEYGEN_API_KEY,code=process.env.VIDEO_TEST_CODE,fetch=globalThis.fetch;
 try{
  process.env.HEYGEN_API_KEY='test-key';process.env.VIDEO_TEST_CODE='office-test';
  globalThis.fetch=async()=>({ok:true,json:async()=>({data:{video_id:'file-video',status:'pending'}})});
  const job=await invoke();let oversized=false;
  globalThis.fetch=async url=>url.startsWith('https://api.heygen.com/')?{ok:true,json:async()=>({data:{status:'completed',video_url:'https://example.com/result.mp4'}})}:new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'video/mp4','Content-Length':oversized?'5000000':'3'}});
  const request={method:'GET',query:{action:'file'},headers:{authorization:'Bearer '+job.body.token}};
  const result=await invoke(request);assert.equal(result.code,200);assert.equal(result.headers['Content-Type'],'video/mp4');assert.equal(result.file.length,3);
  oversized=true;assert.equal((await invoke(request)).code,413);
  assert.equal((await invoke({...request,headers:{}})).code,401);
 }finally{globalThis.fetch=fetch;if(key===undefined)delete process.env.HEYGEN_API_KEY;else process.env.HEYGEN_API_KEY=key;if(code===undefined)delete process.env.VIDEO_TEST_CODE;else process.env.VIDEO_TEST_CODE=code;}
});
