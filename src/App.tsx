import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
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
import { launchEnabled, initializeLaunch, getDraft, clearDraft, appShareUrl } from "./lib/launch";
import type { EditorDraft } from "./lib/launch";

declare global {
  interface Window {
    // Legacy OpenCV helpers are retained for reference, outside the active app.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cv: any;
  }
}

type AppMode = "splash" | "start" | "preview" | "gallery" | "privacy";

function App() {
  const [mode, setMode] = useState<AppMode>("splash");
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
    if (launchEnabled) void initializeLaunch();
    const timer = window.setTimeout(async () => {
      if (launchEnabled) {
        try { const draft = await getDraft(); if (draft) { setRestoredDraft(draft); setImageUrl(URL.createObjectURL(draft.original)); setMode("preview"); return; } } catch { /* free creation stays usable */ }
      }
      setMode("start");
    }, 2400);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

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
    setRestoredDraft(null);
    setImageUrl(url);
    setMode("preview");
  };

  const handleShareApp = async () => {
    const appUrl = launchEnabled ? appShareUrl() : "https://naezzal4zzal-web.vercel.app";

    try {
      if (Capacitor.isNativePlatform()) { await Share.share({ title: "내짤4짤", text: "네컷사진을 움직이는 추억으로 만들어보세요.", url: appUrl }); return; }
      if (navigator.share) {
        await navigator.share({
          title: "내짤4짤",
          text: "친구들과 찍은 네컷 사진을 움직이는 짤로 만들어봐 ✨",
          url: appUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(appUrl);
      alert("앱 링크를 복사했어요 💌");
    } catch (error) {
      console.error(error);
    }
  };

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

  const footer = <footer className="nz-home-footer">
    {mode === "start" && <button className="nz-photo-policy" onClick={() => setMode("privacy")}>사진과 개인정보 안내 · 문의</button>}
    {launchEnabled && <nav aria-label="상품·이용약관·개인정보·환불 안내">
      <button onClick={e => openPolicy("product", e.currentTarget)}>상품·이용약관</button><span aria-hidden="true">·</span>
      <button onClick={e => openPolicy("privacy", e.currentTarget)}>개인정보</button><span aria-hidden="true">·</span>
      <button onClick={e => openPolicy("refund", e.currentTarget)}>환불 안내</button>
    </nav>}
    {mode === "start" && <BusinessInfo compact />}
  </footer>;

  return (
    <>
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
        <CutPreview imageUrl={imageUrl} onBack={handleReset} initialDraft={restoredDraft} />
      )}

      {mode === "start" && (
        <StartScreen
          onCameraClick={handleCameraClick}
          onUploadClick={handleUploadClick}
          onGalleryClick={() => setMode("gallery")}
          onShareAppClick={handleShareApp}
          accountRef={launchEnabled ? setHomeAccountTarget : undefined}
          footer={footer}
        />
      )}
      {mode !== "splash" && mode !== "start" && footer}
    </>
  );
}

export default App;
