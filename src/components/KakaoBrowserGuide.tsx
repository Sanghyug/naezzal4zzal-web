import { useEffect, useRef, useState } from 'react';
import { externalBrowserUrl, isKakaoBrowser } from '../lib/browserEntry';
import './kakao-browser.css';
export default function KakaoBrowserGuide() {
  const [url] = useState(() => externalBrowserUrl(location.href));
  const [dismissed, setDismissed] = useState(() => { try { return sessionStorage.getItem('nz-kakao-continue') === '1'; } catch { return false; } });
  const [message, setMessage] = useState('');
  const [manual, setManual] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const visible = isKakaoBrowser(navigator.userAgent) && !dismissed;
  useEffect(() => {
    if (!visible) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [visible]);
  function close() { try { sessionStorage.setItem('nz-kakao-continue', '1'); } catch { /* Browsing works without session storage. */ } setDismissed(true); }
  if (!visible) return null;
  return <dialog ref={dialog} className="nz-kakao-guide" aria-labelledby="nz-kakao-title" onCancel={close}>
    <span className="nz-kakao-guide-icon" aria-hidden="true">↗</span>
    <h2 id="nz-kakao-title">더 편하게 내짤4짤을 즐겨보세요!</h2>
    <p>Chrome, Safari 또는 삼성 인터넷에서 열면 더 넓은 화면으로 이용하고, 사진과 영상을 편리하게 저장할 수 있어요.</p>
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); setMessage('앱 주소를 복사했어요.'); } catch { setManual(true); setMessage('아래 주소를 길게 눌러 복사해주세요.'); } }}>앱 주소 복사하기</button>
    <p className="nz-kakao-copy-hint">복사한 주소를 브라우저 주소창에 붙여넣어 주세요.</p>
    {manual && <textarea aria-label="외부 브라우저에서 열 주소" readOnly value={url} onFocus={e=>e.currentTarget.select()}/>}
    {message && <p role="status">{message}</p>}
    <button type="button" className="nz-kakao-continue" onClick={close}>카카오톡에서 계속 이용하기</button>
  </dialog>;
}
