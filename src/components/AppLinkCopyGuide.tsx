import { useEffect, useRef, useState } from 'react';
import { externalBrowserUrl } from '../lib/browserEntry';
import './kakao-browser.css';

export default function AppLinkCopyGuide() {
  const [target] = useState(() => {
    const url = new URL(externalBrowserUrl(location.href));
    url.searchParams.delete('copy');
    return url.href;
  });
  const [state, setState] = useState<'trying'|'ready'|'manual'|'copied'>('trying');
  const [toast, setToast] = useState(false);
  const attempt = useRef<Promise<void> | null>(null);
  useEffect(() => {
    let active = true;
    // Navigation from a Kakao feed is not a guaranteed clipboard gesture.
    // Try once, then offer a real user-initiated copy when permission is denied.
    if (!attempt.current) attempt.current = Promise.resolve().then(() => navigator.clipboard.writeText(target));
    attempt.current.then(() => { if (active) { setState('copied'); setToast(true); } })
      .catch(() => { if (active) setState('ready'); });
    return () => { active = false; };
  }, [target]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(false), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);
  async function copy() {
    try { await navigator.clipboard.writeText(target); setState('copied'); setToast(true); }
    catch { setState('manual'); }
  }
  return <main className="nz-copy-page">
    {state === 'trying' && <p role="status">앱 주소를 복사하고 있어요.</p>}
    {(state === 'ready' || state === 'manual') && <button type="button" onClick={() => void copy()}>앱 주소 복사하기</button>}
    {state === 'manual' && <><p>아래 주소를 길게 눌러 복사해주세요.</p><textarea aria-label="복사할 앱 주소" readOnly value={target} onFocus={e=>e.currentTarget.select()}/></>}
    {state === 'copied' && <><div role="status" className={toast?'nz-copy-toast':'nz-copy-toast nz-copy-toast-hidden'}>{toast?'앱 주소를 복사했어요.':''}</div><a className="nz-copy-back" href={target}>내짤4짤 시작하기</a></>}
  </main>;
}
