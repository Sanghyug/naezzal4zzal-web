import test from 'node:test';
import assert from 'node:assert/strict';
import { appInviteData, appInviteText } from '../src/lib/appInvite.ts';
import { externalBrowserUrl, isKakaoBrowser } from '../src/lib/browserEntry.ts';
test('app invitation uses official URL, valid personal code and confirmed copy',()=>{
  const account={invite:{enabled:true,code:'personal-code',expires:Date.now()+100000}};
  assert.deepEqual(appInviteData(account),{title:'내짤4짤',text:appInviteText,url:'https://4zzal.com/?ref=personal-code'});
  assert.equal(appInviteData(account,'https://preview.example').url,'https://preview.example/?ref=personal-code');
  assert.equal(appInviteData(null).url,'https://4zzal.com');
  assert.equal(appInviteData({invite:{...account.invite,expires:0}}).url,'https://4zzal.com');
  assert.equal(appInviteData({invite:{...account.invite,enabled:false}}).url,'https://4zzal.com');
});
test('Kakao external browser entry preserves invitation and ordinary parameters while excluding OAuth credentials',()=>{
  assert.equal(isKakaoBrowser('Mobile Safari KAKAOTALK 26'),true);assert.equal(isKakaoBrowser('Chrome Safari'),false);
  assert.equal(externalBrowserUrl('https://4zzal.com/?ref=friend&campaign=chat'),'https://4zzal.com/?ref=friend&campaign=chat');
  assert.equal(externalBrowserUrl('https://4zzal.com/?ref=friend&code=private&auth=return#access_token=private'),'https://4zzal.com/?ref=friend');
});


test('Kakao feed keeps the invitation in both start and dedicated copy-guide buttons',async()=>{
  const {kakaoFeedData}=await import('../src/lib/kakaoShare.ts');const url='https://4zzal.com/?ref=personal-code';const feed=kakaoFeedData({title:'내짤4짤',text:'',url});assert.equal(feed.buttons.length,2);assert.equal(feed.buttons[1].title,'앱 주소 복사하기');assert.equal(feed.buttons[0].link.mobileWebUrl,url);const guide=new URL(feed.buttons[1].link.mobileWebUrl);assert.equal(guide.searchParams.get('ref'),'personal-code');assert.equal(guide.searchParams.get('copy'),'app');assert.equal(feed.content.imageUrl,'https://4zzal.com/share-card-v7.png');
});
