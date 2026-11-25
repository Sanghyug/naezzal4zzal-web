import { useEffect, useRef, useState } from 'react';
import { externalBrowserUrl, isKakaoBrowser } from '../lib/browserEntry';
import './kakao-browser.css';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{outcome:string}> };
let pending: InstallEvent | null = null;
let installedThisSession = false;
const subscribers = new Set<() => void>();
const notify = () => subscribers.forEach(fn => fn());
function standalone() {
  return installedThisSession || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || Boolean((navigator as Navigator & {standalone?:boolean}).standalone);
}
// Registered when the eagerly imported module loads, before the splash screen ends.
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); pending = event as InstallEvent; notify();
});
window.addEventListener('appinstalled', () => { pending = null; installedThisSession = true; notify(); });
export function useInstallApp() {
  const [installed, setInstalled] = useState(standalone);
  useEffect(() => {
    const sync = () => setInstalled(standalone());
    subscribers.add(sync);
    const media = matchMedia('(display-mode: standalone)');
    media.addEventListener('change',sync);
    sync();
    return () => { subscribers.delete(sync); media.removeEventListener('change',sync); };
  },[]);
  async function install() {
    if (standalone()) return true;
    if (isKakaoBrowser(navigator.userAgent) || !pending) return false;
    const event = pending;
    pending = null;
    try { await event.prompt(); await event.userChoice; return true; }
    catch { return false; }
  }
  return {installed,install};
}
type Browser = 'samsung'|'chrome'|'safari';
function detectBrowser(): Browser {
  const ua = navigator.userAgent;
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'safari';
  return 'chrome';
}
const steps: Record<Browser, [string,string][]> = {
  samsung: [['⋯','하단 메뉴 누르기'],['⊕','현재 페이지 추가'],['▣','홈 화면 또는 웹 앱 설치'],['✓','추가 또는 설치 누르기']],
  chrome: [['⋮','오른쪽 위 메뉴 누르기'],['⊕','홈 화면에 추가 또는 앱 설치'],['✓','설치 확인']],
  safari: [['↑','공유 버튼 누르기'],['⊕','홈 화면에 추가'],['✓','추가 누르기']],
};
export default function InstallGuide({onClose}:{onClose:()=>void}) {
  const [browser,setBrowser] = useState<Browser>(detectBrowser);
  const [message,setMessage] = useState('');
  const [manual,setManual] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const kakao = isKakaoBrowser(navigator.userAgent);
  const url = externalBrowserUrl(location.href);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { if(previous?.isConnected)previous.focus(); };
  },[]);
  return <dialog ref={dialog} className="nz-install-guide" aria-labelledby="nz-install-title" onCancel={onClose}>
    <div className="nz-install-icon" aria-hidden="true">▣</div>
    <h2 id="nz-install-title">홈 화면에 내짤4짤 설치하기</h2>
    <p>매번 주소를 입력하지 않고 앱처럼 이용해 보세요.</p>
    {kakao ? <>
      <p>카카오톡에서는 설치할 수 없어요. 앱 주소를 복사한 뒤 Chrome, Safari 또는 삼성 인터넷에서 열어주세요.</p>
      <button className="nz-install-close" type="button" onClick={async()=>{try{await navigator.clipboard.writeText(url);setMessage('앱 주소를 복사했어요.');}catch{setManual(true);setMessage('아래 주소를 길게 눌러 복사해주세요.');}}}>앱 주소 복사하기</button>
      {manual && <textarea aria-label="복사할 앱 주소" readOnly value={url} onFocus={e=>e.currentTarget.select()}/>}
      {message && <p role="status">{message}</p>}
    </> : <>
      <div className="nz-install-tabs" aria-label="브라우저 선택">{([['samsung','삼성 인터넷'],['chrome','Chrome'],['safari','Safari']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={browser===value} onClick={()=>setBrowser(value)}>{label}</button>)}</div>
      <ol className="nz-install-steps">{steps[browser].map(([icon,label],i)=><li key={label}><span className="nz-install-step-icon" aria-hidden="true">{icon}</span><span><small>{i+1}단계</small>{label}</span></li>)}</ol>
      <p className="nz-install-tip">설치 후 홈 화면의 앱 아이콘을 눌러주세요.</p>
    </>}
    <button type="button" className="nz-install-close" onClick={onClose}>닫기</button>
  </dialog>;
}
