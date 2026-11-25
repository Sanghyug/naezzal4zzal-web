type AppShareData = { title: string; text: string; url: string };
type KakaoSdk = { init:(key:string)=>void; isInitialized:()=>boolean; Share:{sendDefault:(data:ReturnType<typeof kakaoFeedData>)=>void} };
declare global { interface Window { Kakao?: KakaoSdk } }
export function kakaoFeedData(data: AppShareData) {
  const copy = new URL(data.url); copy.searchParams.set('copy','app');
  return { objectType:'feed' as const, content:{title:'네 컷 사진을 짤과 영상으로!',description:'친구와의 추억을 공유하는 새로운 방법, 내짤4짤',imageUrl:'https://4zzal.com/share-card-v7.png',imageWidth:1200,imageHeight:630,link:{webUrl:data.url,mobileWebUrl:data.url}}, buttons:[{title:'내짤4짤 시작하기',link:{webUrl:data.url,mobileWebUrl:data.url}},{title:'앱 주소 복사 안내',link:{webUrl:copy.href,mobileWebUrl:copy.href}}] };
}
export function prepareKakaoShare() {
  // Enable only after the JavaScript key and both Kakao domain registrations are verified.
  const key=import.meta.env?.VITE_KAKAO_JS_KEY;
  if(import.meta.env?.VITE_KAKAO_SHARE_ENABLED!=='1'||!key)return;
  const init=()=>{if(window.Kakao&&!window.Kakao.isInitialized())window.Kakao.init(key);};
  if(window.Kakao){init();return;}
  if(document.getElementById('nz-kakao-sdk'))return;
  const script=document.createElement('script');script.id='nz-kakao-sdk';script.async=true;script.src='https://t1.kakaocdn.net/kakao_js_sdk/2.8.1/kakao.min.js';script.onload=init;document.head.appendChild(script);
}
export function tryKakaoAppShare(data: AppShareData) {
  if(import.meta.env?.VITE_KAKAO_SHARE_ENABLED!=='1'||!import.meta.env?.VITE_KAKAO_JS_KEY||!window.Kakao?.isInitialized())return false;
  window.Kakao.Share.sendDefault(kakaoFeedData(data));return true;
}
