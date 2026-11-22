import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import PrivacyScreen from "./components/PrivacyScreen";
import { useEffect, useRef, useState } from "react";
import StartScreen from "./components/StartScreen";
import CutPreview from "./components/CutPreview";
import SplashScreen from "./components/SplashScreen";
import GalleryScreen from "./components/GalleryScreen";

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
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
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
    setImageUrl(url);
    setMode("preview");
  };

  const handleShareApp = async () => {
    const appUrl = "https://naezzal4zzal-web.vercel.app";

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

  return (
    <>
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
        <CutPreview imageUrl={imageUrl} onBack={handleReset} />
      )}

      {mode === "start" && (
        <StartScreen
          onCameraClick={handleCameraClick}
          onUploadClick={handleUploadClick}
          onGalleryClick={() => setMode("gallery")}
          onShareAppClick={handleShareApp}
        />
      )}
      {mode === "start" && <div style={{textAlign: "center", padding: "0 12px 24px", background: "#ffe4ec"}}><button onClick={() => setMode("privacy")} style={{background: "none", border: 0, color: "#79535f", textDecoration: "underline"}}>사진과 개인정보 안내 · 문의</button></div>}
    </>
  );
}

export default App;
