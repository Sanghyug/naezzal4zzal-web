import { useEffect, useState } from 'react';
import { isKakaoBrowser } from './browserEntry';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{outcome:string}> };
let pending: InstallEvent | null = null;
let installedThisSession = false;
const subscribers = new Set<() => void>();
const notify = () => subscribers.forEach(fn => fn());
function standalone() {
  return installedThisSession || matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & {standalone?:boolean}).standalone);
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
