import { useEffect, useRef, useState } from "react";

type CameraGuideProps = {
  onCapture: (imageUrl: string) => void;
  onCancel: () => void;
};

function CameraGuide({ onCapture, onCancel }: CameraGuideProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (error) {
        console.error(error);
        setErrorMessage(
          "카메라를 열 수 없어요. 브라우저 권한 또는 HTTPS 환경을 확인해주세요."
        );
      }
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageUrl = canvas.toDataURL("image/jpeg", 0.95);

    stopCamera();
    onCapture(imageUrl);
  };

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100dvh",
        overflow: "hidden",
        backgroundColor: "#000",
        fontFamily: "sans-serif",
      }}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at center, rgba(0,0,0,0.08), rgba(0,0,0,0.45))",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "62vw",
          maxWidth: "310px",
          aspectRatio: "1 / 3.2",
          transform: "translate(-50%, -52%)",
          border: "3px solid rgba(255,255,255,0.95)",
          borderRadius: "18px",
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.38)",
          pointerEvents: "none",
        }}
      >
        {[1, 2, 3].map((line) => (
          <div
            key={line}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${line * 25}%`,
              borderTop: "1.5px dashed rgba(255,255,255,0.75)",
            }}
          />
        ))}

        <div
          style={{
            position: "absolute",
            top: "-34px",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "6px 12px",
            borderRadius: "999px",
            backgroundColor: "rgba(255,79,135,0.92)",
            color: "white",
            fontSize: "13px",
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          세로 네컷을 이 안에 맞춰주세요
        </div>
      </div>

      {errorMessage && (
        <div
          style={{
            position: "absolute",
            top: "36px",
            left: "20px",
            right: "20px",
            padding: "14px",
            borderRadius: "16px",
            backgroundColor: "rgba(255,255,255,0.94)",
            color: "#e23b64",
            fontSize: "14px",
            lineHeight: 1.5,
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          {errorMessage}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          left: "20px",
          right: "20px",
          bottom: "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "18px",
        }}
      >
        <button
          onClick={handleCancel}
          style={{
            width: "78px",
            height: "52px",
            borderRadius: "18px",
            border: "none",
            backgroundColor: "rgba(255,255,255,0.88)",
            color: "#333",
            fontSize: "15px",
            fontWeight: 800,
          }}
        >
          취소
        </button>

        <button
          onClick={handleCapture}
          style={{
            width: "82px",
            height: "82px",
            borderRadius: "50%",
            border: "6px solid rgba(255,255,255,0.9)",
            backgroundColor: "#ff4f87",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
          aria-label="촬영"
        />

        <div style={{ width: "78px" }} />
      </div>
    </div>
  );
}

export default CameraGuide;