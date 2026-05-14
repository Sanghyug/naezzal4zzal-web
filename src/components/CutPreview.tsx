import { useEffect, useState } from "react";
import { cropImage } from "../lib/cropImage";
import { warpPhotoStrip } from "../lib/warpPhotoStrip";
import { detectPhotoCellsByProjection } from "../lib/detectPhotoCellsByProjection";
import { createGif } from "../lib/createGif";
import { alignImagesForGif } from "../lib/alignImagesForGif";

type CutPreviewProps = {
  imageUrl: string;
  onBack: () => void;
};

type ExtractStatus = "loading" | "success" | "fallback" | "error";

function CutPreview({ imageUrl, onBack }: CutPreviewProps) {
  const [cutImages, setCutImages] = useState<string[]>([]);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [isCreatingGif, setIsCreatingGif] = useState(false);
  const [status, setStatus] = useState<ExtractStatus>("loading");
  const [message, setMessage] = useState("인생네컷을 분석하고 있어요 ✨");

  useEffect(() => {
    let isCancelled = false;

    async function generateCuts() {
      try {
        setCutImages([]);
        setGifUrl(null);
        setStatus("loading");
        setMessage("사진 위치를 정리하는 중입니다.");

        const warpedUrl = await warpPhotoStrip(imageUrl);

        const warpedImage = new Image();
        warpedImage.src = warpedUrl;

        warpedImage.onload = async () => {
          if (isCancelled) return;

          const width = warpedImage.width;
          const height = warpedImage.height;

          const stripRect = {
            x: 0,
            y: 0,
            width,
            height,
          };

          const cells = await detectPhotoCellsByProjection(
            warpedUrl,
            stripRect,
          );
          const results: string[] = [];

          if (cells.length === 4) {
            for (const cell of cells) {
              const cropped = await cropImage(
                warpedUrl,
                cell.x,
                cell.y,
                cell.width,
                cell.height,
              );

              results.push(cropped);
            }

            setStatus("success");
            setMessage("네 컷을 자동으로 정리했어요.");
          } else {
            const cutHeight = height / 4;

            for (let i = 0; i < 4; i++) {
              const cropped = await cropImage(
                warpedUrl,
                0,
                cutHeight * i,
                width,
                cutHeight,
              );

              results.push(cropped);
            }

            setStatus("fallback");
            setMessage("정밀 추출이 어려워서 4등분 방식으로 정리했어요.");
          }

          if (!isCancelled) {
            setCutImages(results);
          }
        };

        warpedImage.onerror = () => {
          if (!isCancelled) {
            setStatus("error");
            setMessage(
              "이미지를 불러오지 못했어요. 다른 사진으로 다시 시도해주세요.",
            );
          }
        };
      } catch (error) {
        console.error(error);
        if (!isCancelled) {
          setStatus("error");
          setMessage(
            "사진을 분석하는 중 문제가 생겼어요. 다른 사진으로 다시 시도해주세요.",
          );
        }
      }
    }

    generateCuts();

    return () => {
      isCancelled = true;
    };
  }, [imageUrl]);

  const handleCreateGif = async () => {
    if (cutImages.length !== 4) return;

    setIsCreatingGif(true);
    setGifUrl(null);

    try {
      const alignedImages = await alignImagesForGif(cutImages);
      const gif = await createGif(alignedImages);
      setGifUrl(gif);
    } catch (error) {
      console.error(error);
      alert("움짤을 만드는 중 문제가 생겼어요.");
    } finally {
      setIsCreatingGif(false);
    }
  };

  const handleShareGif = async () => {
    if (!gifUrl) return;

    try {
      const response = await fetch(gifUrl);
      const blob = await response.blob();

      const file = new File([blob], "naezzal4zzal.gif", {
        type: "image/gif",
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "내짤4짤",
          text: "내 인생네컷 움짤이에요!",
          files: [file],
        });
        return;
      }

      alert(
        "이 브라우저에서는 바로 공유가 어려워요. GIF 저장하기를 이용해주세요.",
      );
    } catch (error) {
      console.error(error);
      alert("공유하는 중 문제가 생겼어요.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(to bottom, #fff1f5, #ffe4ec)",
        padding: "16px",
        boxSizing: "border-box",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "460px",
          margin: "0 auto",
          backgroundColor: "white",
          borderRadius: "28px",
          padding: "18px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
        }}
      >
        <h2
          style={{
            color: "#ff4f87",
            marginTop: 0,
            marginBottom: "8px",
            textAlign: "center",
            fontSize: "24px",
            fontWeight: 800,
            minHeight: "34px",
          }}
        >
          {status === "loading" ? (
            <>
              이미지 추출 중
              <LoadingDots />
            </>
          ) : status === "error" ? (
            "추출 실패"
          ) : (
            "추출된 네 컷"
          )}
        </h2>

        <div
          style={{
            marginBottom: "14px",
            textAlign: "center",
            color:
              status === "error"
                ? "#e23b64"
                : status === "fallback"
                  ? "#b7791f"
                  : "#888",
            fontSize: "14px",
            lineHeight: 1.6,
            fontWeight: 600,
          }}
        >
          {message}
        </div>

        {cutImages.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
            {cutImages.map((cut, index) => (
              <div
                key={index}
                style={{
                  borderRadius: "16px",
                  overflow: "hidden",
                  backgroundColor: "#f5f5f5",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                }}
              >
                <img
                  src={cut}
                  alt={`컷 ${index + 1}`}
                  style={{
                    width: "100%",
                    display: "block",
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {status === "error" && (
          <button onClick={onBack} style={secondaryButtonStyle}>
            다른 사진 고르기
          </button>
        )}

        {status !== "error" && (
          <>
            <button
              onClick={handleCreateGif}
              disabled={cutImages.length !== 4 || isCreatingGif}
              style={{
                marginTop: "18px",
                width: "100%",
                padding: "16px",
                borderRadius: "16px",
                border: "none",
                backgroundColor: "#ff4f87",
                color: "white",
                fontSize: "17px",
                fontWeight: 800,
                cursor: "pointer",
                opacity: cutImages.length !== 4 || isCreatingGif ? 0.6 : 1,
                boxShadow: "0 8px 20px rgba(255,79,135,0.28)",
              }}
            >
              {isCreatingGif ? "움짤 만드는 중..." : "움짤 만들기"}
            </button>

            {isCreatingGif && (
              <div
                style={{
                  marginTop: "10px",
                  textAlign: "center",
                  fontSize: "13px",
                  color: "#999",
                  lineHeight: 1.5,
                }}
              >
                네 컷을 자연스럽게 이어 붙이고 있어요.
              </div>
            )}
          </>
        )}

        {gifUrl && (
          <div
            style={{
              marginTop: "20px",
              textAlign: "center",
            }}
          >
            <h3
              style={{
                color: "#ff4f87",
                marginBottom: "12px",
              }}
            >
              완성된 내짤
            </h3>

            <img
              src={gifUrl}
              alt="완성된 움짤"
              style={{
                width: "100%",
                borderRadius: "20px",
                backgroundColor: "#f5f5f5",
                boxShadow: "0 8px 22px rgba(0,0,0,0.10)",
              }}
            />

            <a
              href={gifUrl}
              download="naezzal4zzal.gif"
              style={{
                display: "block",
                marginTop: "14px",
                padding: "14px",
                borderRadius: "14px",
                backgroundColor: "#333",
                color: "white",
                textDecoration: "none",
                fontWeight: 800,
              }}
            >
              GIF 저장하기
            </a>

            <button onClick={handleShareGif} style={primarySubButtonStyle}>
              공유하기
            </button>
          </div>
        )}

        <div
          style={{
            marginTop: "18px",
            textAlign: "center",
            color: "#b8a5ac",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.2px",
          }}
        >
          Powered by AI extraction
        </div>

        {status !== "error" && (
          <button onClick={onBack} style={secondaryButtonStyle}>
            다시 선택하기
          </button>
        )}
      </div>
    </div>
  );
}

const secondaryButtonStyle: React.CSSProperties = {
  marginTop: "16px",
  width: "100%",
  padding: "15px",
  borderRadius: "16px",
  border: "none",
  backgroundColor: "#999",
  color: "white",
  fontSize: "16px",
  fontWeight: 800,
  cursor: "pointer",
};

const primarySubButtonStyle: React.CSSProperties = {
  marginTop: "12px",
  width: "100%",
  padding: "14px",
  borderRadius: "14px",
  border: "none",
  backgroundColor: "#ff4f87",
  color: "white",
  fontSize: "16px",
  fontWeight: 800,
  cursor: "pointer",
};

function LoadingDots() {
  return (
    <span
      style={{
        display: "inline-block",
        width: "30px",
        textAlign: "left",
      }}
    >
      <span className="dot dot1">.</span>
      <span className="dot dot2">.</span>
      <span className="dot dot3">.</span>

      <style>
        {`
          .dot {
            opacity: 0;
            animation: blink 1.4s infinite;
          }

          .dot1 {
            animation-delay: 0s;
          }

          .dot2 {
            animation-delay: 0.2s;
          }

          .dot3 {
            animation-delay: 0.4s;
          }

          @keyframes blink {
            0% { opacity: 0; }
            30% { opacity: 1; }
            100% { opacity: 0; }
          }
        `}
      </style>
    </span>
  );
}

export default CutPreview;
