import { useEffect, useRef, useState } from "react";
import StartScreen from "./components/StartScreen";
import CutPreview from "./components/CutPreview";
import SplashScreen from "./components/SplashScreen";

declare global {
  interface Window {
    cv: any;
  }
}

type AppMode = "splash" | "start" | "preview";

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

    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }

    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setMode("preview");
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
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

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
        />
      )}
    </>
  );
}

export default App;