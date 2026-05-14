import { useEffect, useRef, useState } from "react";
import { createGif } from "../lib/createGif";
import { alignImagesForGif } from "../lib/alignImagesForGif";
import { detectFaceBasedCells } from "../lib/detectFaceBasedCells";

type CutPreviewProps = {
  imageUrl: string;
  onBack: () => void;
};

type ExtractStatus = "loading" | "success" | "fallback" | "error";

type CellRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Adjust = {
  x: number;
  y: number;
  scale: number;
};

function CutPreview({ imageUrl, onBack }: CutPreviewProps) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
  const [cells, setCells] = useState<CellRect[]>([]);
  const [adjusts, setAdjusts] = useState<Adjust[]>([]);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [isCreatingGif, setIsCreatingGif] = useState(false);
  const [status, setStatus] = useState<ExtractStatus>("loading");
  const [message, setMessage] = useState("인생네컷을 분석하고 있어요 ❀");

  useEffect(() => {
    let isCancelled = false;

    async function generateCells() {
      try {
        setSourceUrl(null);
        setCells([]);
        setAdjusts([]);
        setGifUrl(null);
        setStatus("loading");
        setMessage("사진 위치를 정리하는 중입니다.");

        const originalImage = new Image();
        originalImage.src = imageUrl;

        originalImage.onload = async () => {
          if (isCancelled) return;

          const width = originalImage.width;
          const height = originalImage.height;

          const faceCells = await detectFaceBasedCells(imageUrl);

          if (faceCells.length === 4) {
            setSourceUrl(imageUrl);
            setSourceSize({ width, height });
            setCells(faceCells);
            setAdjusts(faceCells.map(() => ({ x: 0, y: 0, scale: 1 })));
            setStatus("success");
            setMessage("얼굴 위치를 기준으로 네 컷을 정리했어요. 손가락으로 미세조정할 수 있어요.");
            return;
          }

          console.log("face based detection failed. use original fallback.");

          const stripWidth = Math.min(width * 0.52, height / 3.2);
          const stripX = (width - stripWidth) / 2;
          const cellHeight = height / 4;

          const fallbackCells = Array.from({ length: 4 }, (_, i) => ({
            x: stripX,
            y: cellHeight * i,
            width: stripWidth,
            height: cellHeight,
          }));

          setSourceUrl(imageUrl);
          setSourceSize({ width, height });
          setCells(fallbackCells);
          setAdjusts(fallbackCells.map(() => ({ x: 0, y: 0, scale: 1 })));
          setStatus("fallback");
          setMessage("얼굴 자동 인식이 어려워 원본 기준으로 배치했어요. 손가락으로 맞춰주세요.");
        };

        originalImage.onerror = () => {
          if (!isCancelled) {
            setStatus("error");
            setMessage("이미지를 불러오지 못했어요. 다른 사진으로 다시 시도해주세요.");
          }
        };
      } catch (error) {
        console.error(error);
        if (!isCancelled) {
          setStatus("error");
          setMessage("사진을 분석하는 중 문제가 생겼어요. 다른 사진으로 다시 시도해주세요.");
        }
      }
    }

    generateCells();

    return () => {
      isCancelled = true;
    };
  }, [imageUrl]);

  const updateAdjust = (index: number, next: Partial<Adjust>) => {
    setAdjusts((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
            ...item,
            ...next,
          }
          : item,
      ),
    );
  };

  const resetAllAdjusts = () => {
    setAdjusts(cells.map(() => ({ x: 0, y: 0, scale: 1 })));
  };

  const renderAdjustedImages = async () => {
    if (!sourceUrl) return [];

    const sourceImage = await loadImage(sourceUrl);
    const rendered: string[] = [];

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const adjust = adjusts[i] ?? { x: 0, y: 0, scale: 1 };

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) continue;

      const targetWidth = 480;
      const targetHeight = Math.round((cell.height / cell.width) * targetWidth);

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const sourceCropWidth = cell.width / adjust.scale;
      const sourceCropHeight = cell.height / adjust.scale;

      const previewFrameWidth = 220;
      const previewFrameHeight = previewFrameWidth * (cell.height / cell.width);

      const moveScaleX = cell.width / previewFrameWidth;
      const moveScaleY = cell.height / previewFrameHeight;

      const sourceX =
        cell.x +
        (cell.width - sourceCropWidth) / 2 -
        (adjust.x * moveScaleX) / adjust.scale;

      const sourceY =
        cell.y +
        (cell.height - sourceCropHeight) / 2 -
        (adjust.y * moveScaleY) / adjust.scale;
      ctx.drawImage(
        sourceImage,
        clamp(sourceX, 0, sourceImage.width - sourceCropWidth),
        clamp(sourceY, 0, sourceImage.height - sourceCropHeight),
        Math.min(sourceCropWidth, sourceImage.width),
        Math.min(sourceCropHeight, sourceImage.height),
        0,
        0,
        targetWidth,
        targetHeight,
      );

      rendered.push(canvas.toDataURL("image/png"));
    }

    return rendered;
  };

  const handleCreateGif = async () => {
    if (cells.length !== 4 || !sourceUrl) return;

    setIsCreatingGif(true);
    setGifUrl(null);

    try {
      const adjustedImages = await renderAdjustedImages();
      const alignedImages = await alignImagesForGif(adjustedImages);
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

      alert("이 브라우저에서는 바로 공유가 어려워요. GIF 저장하기를 이용해주세요.");
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

        {sourceUrl && cells.length > 0 && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
              }}
            >
              {cells.map((cell, index) => (
                <AdjustableCut
                  key={index}
                  sourceUrl={sourceUrl}
                  sourceSize={sourceSize}
                  cell={cell}
                  adjust={adjusts[index] ?? { x: 0, y: 0, scale: 1 }}
                  onChange={(next) => updateAdjust(index, next)}
                />
              ))}
            </div>

            <div
              style={{
                marginTop: "12px",
                textAlign: "center",
                color: "#aaa",
                fontSize: "12px",
                lineHeight: 1.5,
                fontWeight: 600,
              }}
            >
              각 컷을 손가락으로 밀어서 위치를 맞춰주세요.
            </div>
          </>
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
              disabled={cells.length !== 4 || isCreatingGif}
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
                opacity: cells.length !== 4 || isCreatingGif ? 0.6 : 1,
                boxShadow: "0 8px 20px rgba(255,79,135,0.28)",
              }}
            >
              {isCreatingGif ? "움짤 만드는 중..." : "움짤 만들기"}
            </button>

            <div
              style={{
                marginTop: "12px",
                display: "flex",
                justifyContent: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <button onClick={resetAllAdjusts} style={smallButtonStyle}>
                위치 초기화
              </button>
            </div>

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
                보정된 네 컷을 자연스럽게 이어 붙이고 있어요.
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
            marginTop: "16px",
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

type AdjustableCutProps = {
  sourceUrl: string;
  sourceSize: { width: number; height: number };
  cell: CellRect;
  adjust: Adjust;
  onChange: (next: Partial<Adjust>) => void;
};

function AdjustableCut({
  sourceUrl,
  sourceSize,
  cell,
  adjust,
  onChange,
}: AdjustableCutProps) {
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const previewWidthPercent = (sourceSize.width / cell.width) * 100;
  const previewHeightPercent = (sourceSize.height / cell.height) * 100;

  const previewLeftPercent = -(cell.x / cell.width) * 100;
  const previewTopPercent = -(cell.y / cell.height) * 100;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    lastPointRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!lastPointRef.current) return;

    const dx = event.clientX - lastPointRef.current.x;
    const dy = event.clientY - lastPointRef.current.y;

    lastPointRef.current = {
      x: event.clientX,
      y: event.clientY,
    };

    onChange({
      x: adjust.x + dx,
      y: adjust.y + dy,
    });
  };

  const handlePointerUp = () => {
    lastPointRef.current = null;
  };

  const zoomIn = () => {
    onChange({
      scale: Math.min(1.8, adjust.scale + 0.08),
    });
  };

  const zoomOut = () => {
    onChange({
      scale: Math.max(0.75, adjust.scale - 0.08),
    });
  };

  return (
    <div>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: `${cell.width} / ${cell.height}`,
          borderRadius: "16px",
          overflow: "hidden",
          backgroundColor: "#f5f5f5",
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          touchAction: "none",
          cursor: "grab",
        }}
      >
        <img
          src={sourceUrl}
          alt="보정할 컷"
          draggable={false}
          style={{
            position: "absolute",
            left: `${previewLeftPercent}%`,
            top: `${previewTopPercent}%`,
            width: `${previewWidthPercent}%`,
            height: `${previewHeightPercent}%`,
            transform: `translate(${adjust.x}px, ${adjust.y}px) scale(${adjust.scale})`,
            transformOrigin: `${(cell.x + cell.width / 2) / sourceSize.width * 100}% ${(cell.y + cell.height / 2) / sourceSize.height * 100
              }%`,
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: "6px",
          marginTop: "6px",
        }}
      >
        <button onClick={zoomOut} style={miniButtonStyle}>
          －
        </button>
        <button onClick={zoomIn} style={miniButtonStyle}>
          ＋
        </button>
      </div>
    </div>
  );
}

function loadImage(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const image = new Image();
    image.src = imageUrl;
    image.onload = () => resolve(image);
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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

const smallButtonStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: "999px",
  border: "1px solid #ffd1e0",
  backgroundColor: "#fff6fa",
  color: "#ff4f87",
  fontSize: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const miniButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "7px 0",
  borderRadius: "10px",
  border: "1px solid #ffd1e0",
  backgroundColor: "#fff6fa",
  color: "#ff4f87",
  fontSize: "14px",
  fontWeight: 900,
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