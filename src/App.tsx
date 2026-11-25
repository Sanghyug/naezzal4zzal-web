import { prepareKakaoShare } from "./lib/kakaoShare";
import { shareAppInvite } from "./lib/appInvite";
import KakaoBrowserGuide from "./components/KakaoBrowserGuide";
import AppLinkCopyGuide from "./components/AppLinkCopyGuide";
import PrivacyScreen from "./components/PrivacyScreen";
import { useEffect, useRef, useState } from "react";
import StartScreen from "./components/StartScreen";
import CutPreview from "./components/CutPreview";
import SplashScreen from "./components/SplashScreen";
import GalleryScreen from "./components/GalleryScreen";
import LaunchAccount from "./components/LaunchAccount";
import LaunchPolicies from "./components/LaunchPolicies";
import LaunchOperator from "./components/LaunchOperator";
import BusinessInfo from "./components/BusinessInfo";
import { launchEnabled, initializeLaunch, getDraft, clearDraft, isVideoInProgress, launchApi, refreshAccount, useLaunch } from "./lib/launch";
import type { EditorDraft, LaunchJob } from "./lib/launch";

declare global {
  interface Window {
    // Legacy OpenCV helpers are retained for reference, outside the active app.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cv: any;
  }
}

type AppMode = "splash" | "start" | "preview" | "gallery" | "privacy";

function App() {
  const { account, config } = useLaunch();
  const [inviteMessage, setInviteMessage] = useState("");
  
  const [mode, setMode] = useState<AppMode>("splash");
  const [workId, setWorkId] = useState("");
  const activeVideoId = account?.jobs.find(j => isVideoInProgress(j) && (mode !== "preview" || j.id !== sessionStorage.getItem(`nz-credit-job:${account.user.id}:${workId}`)))?.id;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [restoredDraft, setRestoredDraft] = useState<EditorDraft | null>(null);
  const [policies, setPolicies] = useState<"product" | "privacy" | "refund" | null>(null);
  const [homeAccountTarget, setHomeAccountTarget] = useState<HTMLDivElement | null>(null);
  const policyPanelRef = useRef<HTMLDivElement>(null);
  const policyTriggerRef = useRef<HTMLButtonElement | null>(null);
  const openPolicy = (section: "product" | "privacy" | "refund", trigger: HTMLButtonElement) => {
    policyTriggerRef.current = trigger;
    setPolicies(section);
    requestAnimationFrame(() => {
      policyPanelRef.current?.focus({ preventScroll: true });
      policyPanelRef.current?.querySelector(`#nz-home-policy-${section}`)?.scrollIntoView({ block: "start" });
    });
  };
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (new URLSearchParams(location.search).get("copy") === "app") return;
    if (launchEnabled) void initializeLaunch();
    prepareKakaoShare();
    let active = true;
    let timer: number | undefined;
    const restore = async () => {
      if (launchEnabled) {
        try {
          const draft = await getDraft();
          if (!active) return;
          if (draft) {
            setRestoredDraft(draft);
            setWorkId(draft.workId || crypto.randomUUID());
            setImageUrl(URL.createObjectURL(draft.original));
            setMode("preview");
            return;
          }
        } catch { /* Free creation stays usable if browser storage is unavailable. */ }
      }
      if (active) timer = window.setTimeout(() => setMode("start"), 2400);
    };
    void restore();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!launchEnabled || !activeVideoId) return;
    let stopped = false;
    let timer: number;
    async function advance() {
      try {
        const job = await launchApi<LaunchJob>("work", { jobId: activeVideoId });
        if (!isVideoInProgress(job)) {
          await refreshAccount();
          return;
        }
      } catch { /* Resume the same request after a transient network error. */ }
      if (!stopped) timer = window.setTimeout(() => void advance(), 6000);
    }
    void advance();
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [mode, activeVideoId, workId]);

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleUploadClick = () => {
    galleryInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;
    event.target.value = "";
    if (!file.type.startsWith("image/")) { alert("사진 파일을 골라주세요."); return; }
    if (file.size > 25 * 1024 * 1024) { alert("사진이 너무 커요. 25MB 이하의 사진으로 골라주세요."); return; }

    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }

    const url = URL.createObjectURL(file);
    setWorkId(crypto.randomUUID());
    if (launchEnabled) void clearDraft().catch(() => {});
    setRestoredDraft(null);
    setImageUrl(url);
    setMode("preview");
  };

  const handleShareApp = async () => { setInviteMessage(await shareAppInvite(account, config?.appUrl)); };

  const handleReset = () => {
    if (launchEnabled) void clearDraft().catch(() => {});
    setRestoredDraft(null);
    if (imageUrl && imageUrl.startsWith("blob:")) {
      URL.revokeObjectURL(imageUrl);
    }

    setImageUrl(null);
    setMode("start");

    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }

    if (galleryInputRef.current) {
      galleryInputRef.current.value = "";
    }
  };

  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggleFullscreen = () => {
    const change = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    void change.catch(() => {});
  };
  const footer = <footer className="nz-home-footer">
    {mode === "start" && <button className="nz-photo-policy" onClick={() => setMode("privacy")}>사진과 개인정보 안내 · 문의</button>}
    {launchEnabled && <nav aria-label="상품·이용약관·개인정보·환불 안내">
      <button onClick={e => openPolicy("product", e.currentTarget)}>상품·이용약관</button><span aria-hidden="true">·</span>
      <button onClick={e => openPolicy("privacy", e.currentTarget)}>개인정보</button><span aria-hidden="true">·</span>
      <button onClick={e => openPolicy("refund", e.currentTarget)}>환불 안내</button>
    </nav>}
    {mode === "start" && <BusinessInfo compact />}
  </footer>;

  if (new URLSearchParams(location.search).get("copy") === "app") return <AppLinkCopyGuide />;

  return (
    <>
      {mode !== "splash" && <KakaoBrowserGuide />}
      {launchEnabled && mode !== "splash" && <LaunchAccount entryTarget={mode === "start" ? homeAccountTarget : null} />}
      {launchEnabled && mode !== "splash" && <LaunchOperator />}
      {launchEnabled && policies && <div className="nz-home-policy-panel" ref={policyPanelRef} tabIndex={-1}><LaunchPolicies sectionPrefix="nz-home-policy" onBack={() => { setPolicies(null); requestAnimationFrame(() => policyTriggerRef.current?.focus()); }} /></div>}
      {mode === "splash" && <SplashScreen />}
      {mode === "privacy" && <PrivacyScreen onBack={() => setMode("start")} />}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {mode === "gallery" && <GalleryScreen onBack={() => setMode("start")} />}

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {mode === "preview" && imageUrl && (
        <CutPreview key={workId} workId={workId} imageUrl={imageUrl} onBack={handleReset} initialDraft={restoredDraft} />
      )}

      {mode === "start" && (
        <StartScreen
          onCameraClick={handleCameraClick}
          onUploadClick={handleUploadClick}
          onGalleryClick={() => setMode("gallery")}
          onShareAppClick={handleShareApp}
          inviteMessage={inviteMessage}
          inviteGuest={!account}
          accountRef={launchEnabled ? setHomeAccountTarget : undefined}
          footer={footer}
          fullscreenAvailable={Boolean(document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === "function" && !matchMedia("(display-mode: standalone)").matches)}
          fullscreen={fullscreen}
          onFullscreenClick={toggleFullscreen}
        />
      )}
      {mode !== "splash" && mode !== "start" && footer}
    </>
  );
}

export default App;
