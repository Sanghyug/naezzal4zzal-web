import { useRef, useState } from "react";
import StartScreen from "./components/StartScreen";
import CutPreview from "./components/CutPreview";
import CameraGuide from "./components/CameraGuide";

declare global {
  interface Window {
    cv: any;
  }
}

type AppMode = "start" | "camera" | "preview";

function App() {
  const [mode, setMode] = useState<AppMode>("start");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleCameraClick = () => {
    const hasCameraApi =
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia;

    if (!hasCameraApi) {
      alert("이 브라우저에서는 앱 내 카메라를 사용할 수 없어요. 불러오기를 이용해주세요.");
      return;
    }

    setMode("camera");
  };

  const handleCameraCapture = (capturedImageUrl: string) => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }

    setImageUrl(capturedImageUrl);
    setMode("preview");
  };

  const handleCameraCancel = () => {
    setMode("start");
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

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {mode === "camera" && (
        <CameraGuide
          onCapture={handleCameraCapture}
          onCancel={handleCameraCancel}
        />
      )}

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