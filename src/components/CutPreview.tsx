import { useEffect, useRef, useState } from "react";
import { createGif, type GifSpeed } from "../lib/createGif";
import { alignImagesForGif } from "../lib/alignImagesForGif";
import { detectFaceBasedCells } from "../lib/detectFaceBasedCells";

type CutPreviewProps = {
  imageUrl: string;
  onBack: () => void;
};

type GifMode = "fast" | "slow" | "heartbeat";

type PreviewSize = {
  width: number;
  height: number;
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
  rotate: number;
};

function CutPreview({ imageUrl, onBack }: CutPreviewProps) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
  const [cells, setCells] = useState<CellRect[]>([]);
  const [adjusts, setAdjusts] = useState<Adjust[]>([]);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [memo, setMemo] = useState("");
  const [isCreatingGif, setIsCreatingGif] = useState(false);
  const [status, setStatus] = useState<ExtractStatus>("loading");
  const [message, setMessage] = useState("인생네컷을 분석하고 있어요 ❀");

  const [showGifOptions, setShowGifOptions] = useState(false);
  const [previewSizes, setPreviewSizes] = useState<PreviewSize[]>([]);
  const adjustsRef = useRef<Adjust[]>([]);

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
            const initialAdjusts = faceCells.map(() => ({
              x: 0,
              y: 0,
              scale: 1,
              rotate: 0,
            }));

            adjustsRef.current = initialAdjusts;
            setAdjusts(initialAdjusts); setStatus("success");
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
          const initialAdjusts = fallbackCells.map(() => ({
            x: 0,
            y: 0,
            scale: 1,
            rotate: 0,
          }));

          adjustsRef.current = initialAdjusts;
          setAdjusts(initialAdjusts); setStatus("fallback");
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
    setAdjusts((prev) => {
      const updated = prev.map((item, i) =>
        i === index
          ? {
            ...item,
            ...next,
          }
          : item,
      );

      adjustsRef.current = updated;
      return updated;
    });
  };

  const resetAllAdjusts = () => {
    const reset = cells.map(() => ({
      x: 0,
      y: 0,
      scale: 1,
      rotate: 0,
    }));

    adjustsRef.current = reset;
    setAdjusts(reset);
  };

  const renderAdjustedImages = async (extraScale = 1) => {
    if (!sourceUrl) return [];

    const sourceImage = await loadImage(sourceUrl);
    const rendered: string[] = [];

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const currentAdjusts = adjustsRef.current.length ? adjustsRef.current : adjusts;
      const adjust = currentAdjusts[i] ?? { x: 0, y: 0, scale: 1, rotate: 0 };

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) continue;

      const targetWidth = 480;
      const targetHeight = Math.round((cell.height / cell.width) * targetWidth);

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const finalScale = adjust.scale * extraScale;

      const sourceCropWidth = cell.width / finalScale;
      const sourceCropHeight = cell.height / finalScale;

      const previewFrameWidth = previewSizes[i]?.width || 220;
      const previewFrameHeight =
        previewSizes[i]?.height || previewFrameWidth * (cell.height / cell.width);

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
      const safeSourceX = clamp(sourceX, 0, sourceImage.width - sourceCropWidth);
      const safeSourceY = clamp(sourceY, 0, sourceImage.height - sourceCropHeight);

      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");

      if (!tempCtx) continue;

      tempCanvas.width = targetWidth;
      tempCanvas.height = targetHeight;

      tempCtx.drawImage(
        sourceImage,
        safeSourceX,
        safeSourceY,
        Math.min(sourceCropWidth, sourceImage.width),
        Math.min(sourceCropHeight, sourceImage.height),
        0,
        0,
        targetWidth,
        targetHeight,
      );

      ctx.save();
      ctx.translate(targetWidth / 2, targetHeight / 2);
      ctx.rotate((adjust.rotate * Math.PI) / 180);
      ctx.drawImage(tempCanvas, -targetWidth / 2, -targetHeight / 2);
      ctx.restore();

      rendered.push(canvas.toDataURL("image/png"));
    }

    return rendered;
  };

  const handleCreateGif = async (mode: GifMode) => {
    if (cells.length !== 4 || !sourceUrl) return;

    setShowGifOptions(false);
    setIsCreatingGif(true);
    setGifUrl(null);

    try {
      let images: string[] = [];
      let speed: GifSpeed = "normal";

      if (mode === "heartbeat") {
        const normalImages = await renderAdjustedImages(1);
        const beatImages = await renderAdjustedImages(1.08);

        images = normalImages.flatMap((image, index) => [
          image,
          beatImages[index],
        ]);

        speed = "fast";
      }

      if (mode === "fast") {
        images = await renderAdjustedImages(1);
        speed = "fast";
      }

      if (mode === "slow") {
        images = await renderAdjustedImages(1);
        speed = "slow";
      }

      const alignedImages = await alignImagesForGif(images);
      const framedImages = await renderPolaroidGifFrames(alignedImages);
      const gif = await createGif(framedImages, speed);
      setGifUrl(gif);
    } catch (error) {
      console.error(error);
      alert("움짤을 만드는 중 문제가 생겼어요.");
    } finally {
      setIsCreatingGif(false);
    }
  };

  const renderPolaroidGifFrames = async (images: string[]) => {
    const framedImages: string[] = [];

    for (const imageUrl of images) {
      const image = await loadImage(imageUrl);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) continue;

      const cardWidth = 720;
      const padding = 36;
      const framePadding = 22;
      const imageWidth = cardWidth - padding * 2 - framePadding * 2;
      const imageHeight = Math.round((image.height / image.width) * imageWidth);

      const memoText = memo.trim() || "오늘의 움직이는 네컷 추억";
      const brandText = "내짤4짤 · 움직이는 네컷 추억";

      const memoBoxHeight = 58;
      const brandHeight = 38;

      const cardHeight =
        padding +
        framePadding +
        imageHeight +
        framePadding +
        memoBoxHeight +
        brandHeight +
        padding;

      canvas.width = cardWidth;
      canvas.height = cardHeight;

      const gradient = ctx.createLinearGradient(0, 0, cardWidth, cardHeight);
      gradient.addColorStop(0, "#fff7fb");
      gradient.addColorStop(1, "#ffe1ec");

      ctx.fillStyle = gradient;
      roundRect(ctx, 0, 0, cardWidth, cardHeight, 42);
      ctx.fill();

      ctx.strokeStyle = "#ffd1e0";
      ctx.lineWidth = 4;
      roundRect(ctx, 8, 8, cardWidth - 16, cardHeight - 16, 36);
      ctx.stroke();

      const photoFrameX = padding;
      const photoFrameY = padding;
      const photoFrameWidth = cardWidth - padding * 2;
      const photoFrameHeight = imageHeight + framePadding * 2;

      ctx.fillStyle = "#ffffff";
      roundRect(
        ctx,
        photoFrameX,
        photoFrameY,
        photoFrameWidth,
        photoFrameHeight,
        30,
      );
      ctx.fill();

      ctx.drawImage(
        image,
        photoFrameX + framePadding,
        photoFrameY + framePadding,
        imageWidth,
        imageHeight,
      );

      const memoY = photoFrameY + photoFrameHeight + 16;

      ctx.fillStyle = "rgba(255,255,255,0.86)";
      roundRect(ctx, padding, memoY, cardWidth - padding * 2, memoBoxHeight, 24);
      ctx.fill();

      ctx.fillStyle = "#7a5d66";
      ctx.font = "800 22px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(memoText, cardWidth / 2, memoY + memoBoxHeight / 2);

      ctx.fillStyle = "#c38a9d";
      ctx.font = "800 17px sans-serif";
      ctx.fillText(brandText, cardWidth / 2, memoY + memoBoxHeight + 30);

      framedImages.push(canvas.toDataURL("image/png"));
    }

    return framedImages;
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

  const handleSaveCardImage = async () => {
    if (!gifUrl) return;

    try {
      const gifImage = await loadImage(gifUrl);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) return;

      const cardWidth = 720;
      const padding = 36;
      const innerPadding = 20;
      const imageWidth = cardWidth - padding * 2 - innerPadding * 2;
      const imageHeight = Math.round((gifImage.height / gifImage.width) * imageWidth);

      const memoText = memo.trim();
      const memoLines = memoText ? wrapText(ctx, memoText, imageWidth - 32) : [];
      const memoHeight = memoLines.length > 0 ? memoLines.length * 28 + 34 : 0;

      const brandHeight = 46;
      const cardHeight =
        padding +
        innerPadding +
        imageHeight +
        innerPadding +
        memoHeight +
        brandHeight +
        padding;

      canvas.width = cardWidth;
      canvas.height = cardHeight;

      const gradient = ctx.createLinearGradient(0, 0, cardWidth, cardHeight);
      gradient.addColorStop(0, "#fff7fb");
      gradient.addColorStop(1, "#ffe1ec");

      roundRect(ctx, 0, 0, cardWidth, cardHeight, 42);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.strokeStyle = "#ffd1e0";
      ctx.lineWidth = 4;
      roundRect(ctx, 8, 8, cardWidth - 16, cardHeight - 16, 36);
      ctx.stroke();

      const whiteX = padding;
      const whiteY = padding;
      const whiteWidth = cardWidth - padding * 2;
      const whiteHeight = imageHeight + innerPadding * 2;

      ctx.fillStyle = "#ffffff";
      roundRect(ctx, whiteX, whiteY, whiteWidth, whiteHeight, 30);
      ctx.fill();

      ctx.drawImage(
        gifImage,
        whiteX + innerPadding,
        whiteY + innerPadding,
        imageWidth,
        imageHeight,
      );

      let currentY = whiteY + whiteHeight + 18;

      if (memoLines.length > 0) {
        ctx.fillStyle = "rgba(255,255,255,0.86)";
        roundRect(ctx, padding, currentY, cardWidth - padding * 2, memoHeight, 24);
        ctx.fill();

        ctx.fillStyle = "#7a5d66";
        ctx.font = "700 24px sans-serif";
        ctx.textBaseline = "top";

        memoLines.forEach((line, index) => {
          ctx.fillText(line, padding + 24, currentY + 18 + index * 28);
        });

        currentY += memoHeight + 18;
      }

      ctx.fillStyle = "#c38a9d";
      ctx.font = "800 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("내짤4짤 · 움직이는 네컷 추억", cardWidth / 2, currentY + 8);

      const cardUrl = canvas.toDataURL("image/png");

      const link = document.createElement("a");
      link.href = cardUrl;
      link.download = "naezzal4zzal-card.png";
      link.click();
    } catch (error) {
      console.error(error);
      alert("카드 이미지를 저장하는 중 문제가 생겼어요.");
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
                  adjust={adjusts[index] ?? { x: 0, y: 0, scale: 1, rotate: 0 }}
                  onChange={(next) => updateAdjust(index, next)}
                  onSizeChange={(size) => {
                    setPreviewSizes((prev) => {
                      const next = [...prev];
                      next[index] = size;
                      return next;
                    });
                  }}
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
              onClick={() => setShowGifOptions(true)}
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

              <textarea
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                placeholder="예: 친구 지은이랑 2026.5.16"
                maxLength={80}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  marginTop: "16px",
                  padding: "13px",
                  borderRadius: "16px",
                  border: "1px solid #ffd1e0",
                  backgroundColor: "#fffafd",
                  color: "#6f5961",
                  resize: "none",
                  minHeight: "74px",
                  fontSize: "14px",
                  lineHeight: 1.5,
                  fontFamily: "sans-serif",
                  fontWeight: 600,
                  outline: "none",
                }}
              />

              <div
                style={{
                  marginTop: "6px",
                  textAlign: "right",
                  color: "#c9aab5",
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                {memo.length}/80
              </div>

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

            {showGifOptions && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 20,
                  backgroundColor: "rgba(0,0,0,0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "20px",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: "360px",
                    backgroundColor: "white",
                    borderRadius: "26px",
                    padding: "20px",
                    boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
                    textAlign: "center",
                  }}
                >
                  <h3 style={{ color: "#ff4f87", marginTop: 0 }}>움짤 스타일 선택</h3>

                  <button onClick={() => handleCreateGif("fast")} style={optionButtonStyle}>
                    빠른 GIF
                  </button>

                  <button onClick={() => handleCreateGif("slow")} style={optionButtonStyle}>
                    느린 GIF
                  </button>

                  <button onClick={() => handleCreateGif("heartbeat")} style={optionButtonStyle}>
                    두근두근 GIF 💗
                  </button>

                </div>
              </div>
            )}


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

            <div
              style={{
                padding: "12px",
                borderRadius: "30px",
                background: "linear-gradient(135deg, #fff7fb, #ffe1ec)",
                border: "2px solid #ffd1e0",
                boxShadow: "0 12px 32px rgba(255,79,135,0.20)",
              }}
            >
              <div
                style={{
                  padding: "8px",
                  borderRadius: "24px",
                  backgroundColor: "white",
                  boxShadow: "inset 0 0 0 1px rgba(255,209,224,0.9)",
                }}
              >
                <img
                  src={gifUrl}
                  alt="완성된 움짤"
                  style={{
                    width: "100%",
                    display: "block",
                    borderRadius: "18px",
                    backgroundColor: "#f5f5f5",
                  }}
                />
              </div>

              {memo.trim() && (
                <div
                  style={{
                    marginTop: "10px",
                    padding: "12px",
                    borderRadius: "18px",
                    backgroundColor: "rgba(255,255,255,0.82)",
                    color: "#7a5d66",
                    fontSize: "14px",
                    lineHeight: 1.5,
                    fontWeight: 700,
                    whiteSpace: "pre-wrap",
                    wordBreak: "keep-all",
                  }}
                >
                  {memo}
                </div>
              )}

              <div
                style={{
                  marginTop: "10px",
                  color: "#c38a9d",
                  fontSize: "11px",
                  fontWeight: 800,
                  letterSpacing: "0.2px",
                }}
              >
                내짤4짤 · 움직이는 네컷 추억
              </div>
            </div>

            <textarea
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="이날의 추억을 짧게 적어보세요."
              maxLength={80}
              style={{
                width: "100%",
                boxSizing: "border-box",
                marginTop: "12px",
                padding: "13px",
                borderRadius: "16px",
                border: "1px solid #ffd1e0",
                backgroundColor: "#fffafd",
                color: "#6f5961",
                resize: "none",
                minHeight: "74px",
                fontSize: "14px",
                lineHeight: 1.5,
                fontFamily: "sans-serif",
                fontWeight: 600,
                outline: "none",
              }}
            />

            <div
              style={{
                marginTop: "6px",
                textAlign: "right",
                color: "#c9aab5",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              {memo.length}/80
            </div>

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
            <button onClick={handleSaveCardImage} style={primarySubButtonStyle}>
              메모 카드 이미지 저장하기
            </button>
            <button
              onClick={() => setShowGifOptions(true)}
              style={smallButtonStyle}
            >
              다른 스타일로 다시 만들기
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
  onSizeChange: (size: PreviewSize) => void;
};

function AdjustableCut({
  sourceUrl,
  sourceSize,
  cell,
  adjust,
  onChange,
  onSizeChange,
}: AdjustableCutProps) {
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();

      onSizeChange({
        width: rect.width,
        height: rect.height,
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, [onSizeChange]);

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

  const rotateLeft = () => {
    onChange({
      rotate: adjust.rotate - 1,
    });
  };

  const rotateRight = () => {
    onChange({
      rotate: adjust.rotate + 1,
    });
  };

  return (
    <div>
      <div
        ref={frameRef}
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
            transform: `translate(${adjust.x}px, ${adjust.y}px) scale(${adjust.scale}) rotate(${adjust.rotate}deg)`,
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
        <button onClick={rotateLeft} style={miniButtonStyle}>
          ↺
        </button>
        <button onClick={rotateRight} style={miniButtonStyle}>
          ↻
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

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  ctx.font = "700 24px sans-serif";

  const words = text.split("");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const testLine = line + word;
    const width = ctx.measureText(testLine).width;

    if (width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines.slice(0, 3);
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

const optionButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: "10px",
  padding: "15px",
  borderRadius: "16px",
  border: "none",
  backgroundColor: "#ff4f87",
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