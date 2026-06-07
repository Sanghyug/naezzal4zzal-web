import { useEffect, useRef, useState } from "react";
import { createGif, type GifSpeed } from "../lib/createGif";
import { alignImagesForGif } from "../lib/alignImagesForGif";
import { detectFaceBasedCells } from "../lib/detectFaceBasedCells";
import { hasSameGalleryItem, saveGalleryItem } from "../lib/galleryStore";

type CutPreviewProps = {
  imageUrl: string;
  onBack: () => void;
};

type GifMode = "fast" | "slow" | "heartbeat" | "shake" | "shabang" | "longing";
function getUnlockedFrames(shareCount: number): FrameType[] {
  const frames: FrameType[] = ["basic"];

  if (shareCount >= 4) frames.push("film");
  if (shareCount >= 5) frames.push("memory");
  if (shareCount >= 6) frames.push("spring");

  return frames;
}

type PreviewSize = {
  width: number;
  height: number;
};

type PhotoLayout = "1x4" | "2x2" | "unknown";

type StripRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type LayoutResult = {
  layout: PhotoLayout;
  strip?: StripRect;
};

export type FrameType = "basic" | "film" | "memory" | "spring";

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
  const [currentGifStyleName, setCurrentGifStyleName] = useState("");
  const [memo, setMemo] = useState("");
  const [isCreatingGif, setIsCreatingGif] = useState(false);
  const [status, setStatus] = useState<ExtractStatus>("loading");
  const [message, setMessage] = useState("인생네컷을 분석하고 있어요 ❀");

  const [showGifOptions, setShowGifOptions] = useState(false);
  const [previewSizes, setPreviewSizes] = useState<PreviewSize[]>([]);
  const adjustsRef = useRef<Adjust[]>([]);

  const [shareCount, setShareCount] = useState(() => {
    return Number(localStorage.getItem("naezzal4zzal-share-count") || "0");
  });
  const unlockedFrames = getUnlockedFrames(shareCount);

  const [selectedFrame, setSelectedFrame] = useState<FrameType>("basic");

  useEffect(() => {
    let isCancelled = false;

    async function generateCells() {
      try {
        setSourceUrl(null);
        setCells([]);
        setAdjusts([]);
        setGifUrl(null);
        setStatus("loading");
        setMessage("사진을 보기 좋게 자동 보정하는 중입니다.");

        const enhancedImageUrl = await enhanceImage(imageUrl);

        setMessage("AI가 네 컷 사진의 위치를 찾는 중입니다.");

        const originalImage = new Image();
        originalImage.src = enhancedImageUrl;

        originalImage.onload = async () => {
          if (isCancelled) return;

          const width = originalImage.width;
          const height = originalImage.height;

          const initialAdjust = {
            x: 0,
            y: 0,
            scale: 1,
            rotate: 0,
          };

          function applyCells(
            detectedCells: CellRect[],
            nextStatus: "success" | "fallback",
            nextMessage: string,
          ) {
            setSourceUrl(enhancedImageUrl);
            setSourceSize({ width, height });
            setCells(detectedCells);

            const initialAdjusts = detectedCells.map(() => ({
              ...initialAdjust,
            }));
            adjustsRef.current = initialAdjusts;
            setAdjusts(initialAdjusts);

            setStatus(nextStatus);
            setMessage(nextMessage);
          }

          const layoutResult = await Promise.race([
            detectLayoutWithGpt(enhancedImageUrl),
            new Promise<LayoutResult>((resolve) => {
              window.setTimeout(() => resolve({ layout: "unknown" }), 10000);
            }),
          ]);

          if (isCancelled) return;

          if (
            (layoutResult.layout === "1x4" || layoutResult.layout === "2x2") &&
            layoutResult.strip &&
            isReasonableStrip(layoutResult.strip, width, height)
          ) {
            const layoutCells = createLayoutCells(
              layoutResult.layout,
              layoutResult.strip,
            );

            applyCells(
              layoutCells,
              "success",
              layoutResult.layout === "1x4"
                ? "AI가 세로형 네컷으로 판단해 네 컷을 정리했어요. 손가락으로 미세조정할 수 있어요."
                : "AI가 2x2 네컷으로 판단해 네 컷을 정리했어요. 손가락으로 미세조정할 수 있어요.",
            );
            return;
          }

          setMessage(
            "정밀 AI 추출이 어려워 얼굴 기준으로 다시 정리하는 중입니다.",
          );

          const faceCells = await Promise.race([
            detectFaceBasedCells(enhancedImageUrl),
            new Promise<CellRect[]>((resolve) => {
              window.setTimeout(() => resolve([]), 5000);
            }),
          ]);

          if (isCancelled) return;

          if (faceCells.length === 4) {
            applyCells(
              faceCells,
              "success",
              "얼굴 위치를 기준으로 네 컷을 정리했어요. 손가락으로 미세조정할 수 있어요.",
            );
            return;
          }

          console.log(
            "AI and face based detection failed. use original fallback.",
          );

          const stripWidth = Math.min(width * 0.52, height / 3.2);
          const stripX = (width - stripWidth) / 2;
          const cellHeight = height / 4;

          const fallbackCells = Array.from({ length: 4 }, (_, i) => ({
            x: stripX,
            y: cellHeight * i,
            width: stripWidth,
            height: cellHeight,
          }));

          applyCells(
            fallbackCells,
            "fallback",
            "자동 인식이 어려워 원본 기준으로 배치했어요. 손가락으로 맞춰주세요.",
          );
        };

        originalImage.onerror = () => {
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

    async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            reject(new Error("이미지를 data URL로 변환하지 못했습니다."));
          }
        };

        reader.onerror = () => {
          reject(new Error("이미지를 읽지 못했습니다."));
        };

        reader.readAsDataURL(blob);
      });
    }

    async function detectLayoutWithGpt(
      imageUrl: string,
    ): Promise<LayoutResult> {
      const imageDataUrl = await imageUrlToDataUrl(imageUrl);

      const response = await fetch("/api/extract-cells", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: imageDataUrl,
        }),
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        console.error("GPT layout detection failed:", detail);
        return { layout: "unknown" };
      }

      const data = await response.json();
      console.log("GPT layout response:", data);

      if (data.layout === "1x4" || data.layout === "2x2") {
        return {
          layout: data.layout,
          strip: data.strip,
        };
      }

      return { layout: "unknown" };
    }

    function isReasonableStrip(
      strip: StripRect,
      width: number,
      height: number,
    ) {
      if (strip.width < width * 0.22) return false;
      if (strip.width > width * 0.85) return false;
      if (strip.height < height * 0.45) return false;
      if (strip.height > height * 1.05) return false;
      if (strip.x < 0 || strip.y < 0) return false;
      if (strip.x + strip.width > width) return false;
      if (strip.y + strip.height > height) return false;

      return true;
    }

    function createLayoutCells(
      layout: PhotoLayout,
      strip: StripRect,
    ): CellRect[] {
      if (layout === "2x2") {
        const cellWidth = strip.width / 2;
        const cellHeight = strip.height / 2;

        return [
          { x: strip.x, y: strip.y, width: cellWidth, height: cellHeight },
          {
            x: strip.x + cellWidth,
            y: strip.y,
            width: cellWidth,
            height: cellHeight,
          },
          {
            x: strip.x,
            y: strip.y + cellHeight,
            width: cellWidth,
            height: cellHeight,
          },
          {
            x: strip.x + cellWidth,
            y: strip.y + cellHeight,
            width: cellWidth,
            height: cellHeight,
          },
        ];
      }

      const paddingTop = strip.height * 0.03;
      const paddingBottom = strip.height * 0.03;

      const usableHeight = strip.height - paddingTop - paddingBottom;

      const cellHeight = usableHeight / 4;

      return Array.from({ length: 4 }, (_, i) => ({
        x: strip.x,
        y: strip.y + paddingTop + cellHeight * i,
        width: strip.width,
        height: cellHeight,
      }));
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

  const renderAdjustedImages = async (extraScale = 1, extraRotate = 0) => {
    if (!sourceUrl) return [];

    const sourceImage = await loadImage(sourceUrl);
    const rendered: string[] = [];

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const currentAdjusts = adjustsRef.current.length
        ? adjustsRef.current
        : adjusts;
      const adjust = currentAdjusts[i] ?? { x: 0, y: 0, scale: 1, rotate: 0 };

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) continue;

      const targetWidth = 480;
      const targetHeight = Math.round(targetWidth * (3.4 / 4.3));

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const finalScale = adjust.scale * extraScale;

      const sourceCropWidth = cell.width / finalScale;
      const sourceCropHeight = cell.height / finalScale;

      const previewFrameWidth = previewSizes[i]?.width || 220;
      const previewFrameHeight =
        previewSizes[i]?.height ||
        previewFrameWidth * (cell.height / cell.width);

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
      const safeSourceX = clamp(
        sourceX,
        0,
        sourceImage.width - sourceCropWidth,
      );
      const safeSourceY = clamp(
        sourceY,
        0,
        sourceImage.height - sourceCropHeight,
      );

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
      ctx.rotate(((adjust.rotate + extraRotate) * Math.PI) / 180);
      ctx.drawImage(tempCanvas, -targetWidth / 2, -targetHeight / 2);
      ctx.restore();

      enhanceRenderedCut(canvas);

      rendered.push(canvas.toDataURL("image/png"));
    }

    return rendered;
  };

  const getGifStyleName = (mode: GifMode) => {
    if (mode === "fast") return "헐레벌떡 GIF";
    if (mode === "slow") return "살랑살랑 GIF";
    if (mode === "heartbeat") return "두근두근 GIF";
    if (mode === "shake") return "흔들흔들 GIF";
    if (mode === "shabang") return "샤방샤방 GIF";
    if (mode === "longing") return "아련아련 GIF";
    return "기본 GIF";
  };

  const handleCreateGif = async (mode: GifMode) => {
    if (cells.length !== 4 || !sourceUrl) return;

    setShowGifOptions(false);
    setIsCreatingGif(true);
    setGifUrl(null);
    setCurrentGifStyleName(getGifStyleName(mode));

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

      if (mode === "shake") {
        const normalImages = await renderAdjustedImages(1);
        const leftImages = await renderAdjustedImages(1, -2);
        const rightImages = await renderAdjustedImages(1, 2);

        images = normalImages.flatMap((image, index) => [
          leftImages[index],
          image,
          rightImages[index],
          image,
        ]);

        speed = "fast";
      }

      if (mode === "shabang") {
        const normalImages = await renderAdjustedImages(1);
        images = await renderShabangImages(normalImages);
        speed = "normal";
      }

      if (mode === "longing") {
        const normalImages = await renderAdjustedImages(1);
        images = await renderLongingImages(normalImages);
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

  async function renderShabangImages(images: string[]) {
    const result: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const image = await loadImage(images[i]);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) continue;

      canvas.width = image.width;
      canvas.height = image.height;

      ctx.drawImage(image, 0, 0);

      const decorations = ["✿", "♡", "✦", "❀"];

      for (let j = 0; j < 8; j++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = 22 + Math.random() * 22;
        const alpha = 0.35 + Math.random() * 0.45;
        const deco =
          decorations[Math.floor(Math.random() * decorations.length)];

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `900 ${size}px sans-serif`;
        ctx.fillStyle = j % 2 === 0 ? "#ff8fb3" : "#ffffff";
        ctx.shadowColor = "rgba(255, 79, 135, 0.45)";
        ctx.shadowBlur = 8;
        ctx.fillText(deco, x, y);
        ctx.restore();
      }

      result.push(canvas.toDataURL("image/png"));
    }

    return result;
  }

  async function renderLongingImages(images: string[]) {
    const result: string[] = [];

    for (const imageUrl of images) {
      const image = await loadImage(imageUrl);

      for (const alpha of [1, 0.78, 0.55, 0.78]) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) continue;

        canvas.width = image.width;
        canvas.height = image.height;

        ctx.fillStyle = "#fff7fb";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.globalAlpha = alpha;
        ctx.drawImage(image, 0, 0);
        ctx.globalAlpha = 1;

        result.push(canvas.toDataURL("image/png"));
      }
    }

    return result;
  }

  const renderPolaroidGifFrames = async (images: string[]) => {
    const framedImages: string[] = [];
    const theme = getFrameTheme(selectedFrame);

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
      const brandText = theme.brand;

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
      gradient.addColorStop(0, theme.gradientStart);
      gradient.addColorStop(1, theme.gradientEnd);

      ctx.fillStyle = gradient;
      roundRect(ctx, 0, 0, cardWidth, cardHeight, 42);
      ctx.fill();

      ctx.strokeStyle = theme.border;
      ctx.lineWidth = 4;
      roundRect(ctx, 8, 8, cardWidth - 16, cardHeight - 16, 36);
      ctx.stroke();

      const photoFrameX = padding;
      const photoFrameY = padding;
      const photoFrameWidth = cardWidth - padding * 2;
      const photoFrameHeight = imageHeight + framePadding * 2;

      ctx.fillStyle = theme.photoBg;
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

      ctx.fillStyle = theme.memoBg;
      roundRect(
        ctx,
        padding,
        memoY,
        cardWidth - padding * 2,
        memoBoxHeight,
        24,
      );
      ctx.fill();

      ctx.fillStyle = theme.memoText;
      ctx.font = "800 22px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(memoText, cardWidth / 2, memoY + memoBoxHeight / 2);

      ctx.fillStyle = theme.brandText;
      ctx.font = "800 17px sans-serif";
      ctx.fillText(brandText, cardWidth / 2, memoY + memoBoxHeight + 30);

      framedImages.push(canvas.toDataURL("image/png"));
    }

    return framedImages;
  };

  const increaseShareCount = () => {
    const nextCount = shareCount + 1;
    localStorage.setItem("naezzal4zzal-share-count", String(nextCount));
    setShareCount(nextCount);
  };

  const handleShareGif = async () => {
    if (!gifUrl) return;

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (!isMobile) {
      alert(
        "PC 브라우저에서는 GIF 파일 공유가 불안정해요.\n스마트폰에서 공유하거나, 보관함의 다운로드 기능을 이용해주세요.",
      );
      return;
    }

    const appUrl = window.location.origin;
    const shareText = `${memo || "내짤4짤에서 만든 움직이는 네컷 추억 ✨"}

너도 만들어봐 👉 ${appUrl}`;

    try {
      const response = await fetch(gifUrl);
      const blob = await response.blob();

      const file = new File([blob], "naezzal4zzal.gif", {
        type: "image/gif",
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "내짤4짤",
          text: shareText,
        });

        increaseShareCount();
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: "내짤4짤",
          text: shareText,
          url: appUrl,
        });

        increaseShareCount();
        return;
      }

      await navigator.clipboard.writeText(shareText);
      alert("앱 링크와 문구를 복사했어요 💌");
    } catch (error) {
      console.error(error);
      alert("공유를 취소했거나 사용할 수 없는 브라우저예요.");
    }
  };

  const handleSaveToGallery = async () => {
    if (!gifUrl) {
      alert("아직 저장할 GIF가 없어요.");
      return;
    }

    const currentStyleName = currentGifStyleName || "기본 GIF";

    try {
      const alreadySaved = await hasSameGalleryItem(memo, currentStyleName);

      if (alreadySaved) {
        alert("이 스타일은 이미 보관함에 저장되어 있어요 💗");
        return;
      }

      await saveGalleryItem(gifUrl, memo, currentStyleName);
      alert("내 보관함에 저장했어요 💗");
    } catch (error) {
      console.error(error);
      alert("보관함에 저장하지 못했어요.");
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
            <textarea
              className="memo-textarea"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="예) 지은이랑 찍은 봄날의 네컷"
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
                fontWeight: 300,
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
                onClick={() => setShowGifOptions(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  pointerEvents: "auto",
                  zIndex: 20,
                  backgroundColor: "rgba(0,0,0,0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "20px",
                }}
              >
                <div
                  onClick={(event) => event.stopPropagation()}
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
                  <h3 style={{ color: "#ff4f87", marginTop: 0 }}>
                    움짤 스타일 선택
                  </h3>

                  <button
                    onClick={() => handleCreateGif("fast")}
                    style={fastGifButtonStyle}
                  >
                    헐레벌떡 GIF
                  </button>

                  <button
                    onClick={() => handleCreateGif("slow")}
                    style={slowGifButtonStyle}
                  >
                    살랑살랑 GIF
                  </button>

                  <button
                    onClick={() => handleCreateGif("heartbeat")}
                    style={heartbeatGifButtonStyle}
                  >
                    두근두근 GIF
                  </button>

                  <LockedGifButton
                    label="흔들흔들 GIF"
                    requiredShareCount={1}
                    shareCount={shareCount}
                    onClick={() => handleCreateGif("shake")}
                  />

                  <LockedGifButton
                    label="샤방샤방 GIF"
                    requiredShareCount={2}
                    shareCount={shareCount}
                    onClick={() => handleCreateGif("shabang")}
                  />

                  <LockedGifButton
                    label="아련아련 GIF"
                    requiredShareCount={3}
                    shareCount={shareCount}
                    onClick={() => handleCreateGif("longing")}
                  />
                </div>

                <div
                  style={{
                    marginTop: "18px",
                    paddingTop: "16px",
                    borderTop: "1px solid #f1d6df",
                  }}
                >
                  <h3>프레임 선택</h3>

                  <FrameButton
                    label="기본 핑크 프레임"
                    frame="basic"
                    selectedFrame={selectedFrame}
                    unlockedFrames={unlockedFrames}
                    onSelect={setSelectedFrame}
                  />

                  <FrameButton
                    label="필름 프레임"
                    frame="film"
                    selectedFrame={selectedFrame}
                    unlockedFrames={unlockedFrames}
                    onSelect={setSelectedFrame}
                  />

                  <FrameButton
                    label="메모리 프레임"
                    frame="memory"
                    selectedFrame={selectedFrame}
                    unlockedFrames={unlockedFrames}
                    onSelect={setSelectedFrame}
                  />

                  <FrameButton
                    label="봄날 프레임"
                    frame="spring"
                    selectedFrame={selectedFrame}
                    unlockedFrames={unlockedFrames}
                    onSelect={setSelectedFrame}
                  />
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

            <img
              src={gifUrl}
              alt="완성된 움짤"
              style={{
                width: "100%",
                display: "block",
                borderRadius: "24px",
                backgroundColor: "#f5f5f5",
                boxShadow: "0 10px 28px rgba(255,79,135,0.18)",
              }}
            />

            <button onClick={handleSaveToGallery} style={saveButtonStyle}>
              저장하기
            </button>

            <button onClick={handleShareGif} style={shareButtonStyle}>
              공유하기
            </button>

            <button
              onClick={() => setShowGifOptions(true)}
              style={primarySubButtonStyle}
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
          aspectRatio: "4.3 / 3.4",
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
            transformOrigin: `${((cell.x + cell.width / 2) / sourceSize.width) * 100}% ${
              ((cell.y + cell.height / 2) / sourceSize.height) * 100
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

async function enhanceImage(imageUrl: string): Promise<string> {
  const image = await loadImage(imageUrl);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) return imageUrl;

  const maxWidth = 1600;
  const scale = image.width > maxWidth ? maxWidth / image.width : 1;

  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);

  ctx.filter = "brightness(1.08) contrast(1.14) saturate(1.08)";
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  ctx.filter = "none";

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const sharpened = sharpenImageData(imageData, 0.18);

  ctx.putImageData(sharpened, 0, 0);

  return canvas.toDataURL("image/jpeg", 0.92);
}

function enhanceRenderedCut(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const contrast = 1.08;
  const brightness = 4;
  const saturation = 1.06;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    r = (r - 128) * contrast + 128 + brightness;
    g = (g - 128) * contrast + 128 + brightness;
    b = (b - 128) * contrast + 128 + brightness;

    const gray = 0.299 * r + 0.587 * g + 0.114 * b;

    r = gray + (r - gray) * saturation;
    g = gray + (g - gray) * saturation;
    b = gray + (b - gray) * saturation;

    data[i] = clamp(r, 0, 255);
    data[i + 1] = clamp(g, 0, 255);
    data[i + 2] = clamp(b, 0, 255);
  }

  ctx.putImageData(imageData, 0, 0);

  const sharpened = sharpenImageData(
    ctx.getImageData(0, 0, canvas.width, canvas.height),
    0.12,
  );

  ctx.putImageData(sharpened, 0, 0);
}

function sharpenImageData(imageData: ImageData, amount = 0.18): ImageData {
  const { width, height, data } = imageData;
  const output = new ImageData(width, height);
  const src = data;
  const dst = output.data;

  const center = 1 + amount * 4;
  const side = -amount;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;

      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        dst[index] = src[index];
        dst[index + 1] = src[index + 1];
        dst[index + 2] = src[index + 2];
        dst[index + 3] = src[index + 3];
        continue;
      }

      for (let channel = 0; channel < 3; channel++) {
        const current = src[index + channel] * center;
        const left = src[index - 4 + channel] * side;
        const right = src[index + 4 + channel] * side;
        const top = src[index - width * 4 + channel] * side;
        const bottom = src[index + width * 4 + channel] * side;

        dst[index + channel] = clamp(
          current + left + right + top + bottom,
          0,
          255,
        );
      }

      dst[index + 3] = src[index + 3];
    }
  }

  return output;
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

const saveButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: "14px",
  padding: "14px",
  borderRadius: "14px",
  border: "none",
  backgroundColor: "#333333",
  color: "white",
  fontSize: "16px",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(51,51,51,0.18)",
};

const shareButtonStyle: React.CSSProperties = {
  marginTop: "12px",
  width: "100%",
  padding: "14px",
  borderRadius: "14px",
  border: "none",
  backgroundColor: "#ff8f86",
  color: "white",
  fontSize: "16px",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(255,143,134,0.18)",
};

const fastGifButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #ffd1c4",
  backgroundColor: "#fff0eb",
  color: "#ff7a5c",
  fontSize: "16px",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 6px 14px rgba(255,122,92,0.10)",
};

const slowGifButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: "10px",
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #d9ceff",
  backgroundColor: "#f4f0ff",
  color: "#8f78e8",
  fontSize: "16px",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 6px 14px rgba(143,120,232,0.10)",
};

const heartbeatGifButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: "10px",
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #ffc6dc",
  backgroundColor: "#fff0f6",
  color: "#ff4f87",
  fontSize: "16px",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 6px 14px rgba(255,79,135,0.10)",
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
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(255,79,135,0.18)",
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

function getFrameTheme(frame: FrameType) {
  if (frame === "film") {
    return {
      gradientStart: "#1f1f1f",
      gradientEnd: "#3a3a3a",
      border: "#111111",
      photoBg: "#ffffff",
      memoBg: "rgba(255,255,255,0.9)",
      memoText: "#222222",
      brandText: "#eeeeee",
      brand: "내짤4짤 · film memory",
    };
  }

  if (frame === "memory") {
    return {
      gradientStart: "#fff8df",
      gradientEnd: "#f5dfb8",
      border: "#d7ad72",
      photoBg: "#fffdf7",
      memoBg: "rgba(255,255,255,0.82)",
      memoText: "#7a5735",
      brandText: "#9b7146",
      brand: "내짤4짤 · taped memory",
    };
  }

  if (frame === "spring") {
    return {
      gradientStart: "#f0fff4",
      gradientEnd: "#ffe4ef",
      border: "#ffc1d8",
      photoBg: "#ffffff",
      memoBg: "rgba(255,255,255,0.86)",
      memoText: "#6f5961",
      brandText: "#d77fa2",
      brand: "내짤4짤 · spring day",
    };
  }

  return {
    gradientStart: "#fff7fb",
    gradientEnd: "#ffe1ec",
    border: "#ffd1e0",
    photoBg: "#ffffff",
    memoBg: "rgba(255,255,255,0.86)",
    memoText: "#7a5d66",
    brandText: "#c38a9d",
    brand: "내짤4짤 · 움직이는 네컷 추억",
  };
}

function FrameButton({
  label,
  frame,
  selectedFrame,
  unlockedFrames,
  onSelect,
}: {
  label: string;
  frame: FrameType;
  selectedFrame: FrameType;
  unlockedFrames: FrameType[];
  onSelect: (frame: FrameType) => void;
}) {
  const unlocked = unlockedFrames.includes(frame);
  const selected = selectedFrame === frame;

  return (
    <button
      onClick={() => {
        if (!unlocked) {
          alert("친구에게 공유하면 열려요 ✨");
          return;
        }

        onSelect(frame);
      }}
      style={{
        width: "100%",
        marginTop: "8px",
        padding: "12px",
        borderRadius: "14px",
        border: selected ? "2px solid #ff4f87" : "1px solid #ddd",
        backgroundColor: unlocked ? "#fff7fb" : "#eeeeee",
        color: unlocked ? "#ff4f87" : "#999",
        fontSize: "14px",
        fontWeight: 900,
        cursor: "pointer",
        opacity: unlocked ? 1 : 0.55,
        filter: unlocked ? "none" : "grayscale(1)",
      }}
    >
      {unlocked ? (selected ? `✓ ${label}` : label) : `🔒 ${label} · 공유 +1`}
    </button>
  );
}

function LockedGifButton({
  label,
  requiredShareCount,
  shareCount,
  onClick,
}: {
  label: string;
  requiredShareCount: number;
  shareCount: number;
  onClick: () => void;
}) {
  const unlocked = shareCount >= requiredShareCount;

  return (
    <button
      onClick={() => {
        if (!unlocked) {
          alert(`${requiredShareCount}번 공유하면 ${label}가 열려요 💌`);
          return;
        }
        onClick();
      }}
      style={{
        width: "100%",
        marginTop: "10px",
        padding: "14px",
        borderRadius: "14px",
        border: "1px solid #ddd",
        backgroundColor: unlocked ? "#fff7fb" : "#eeeeee",
        color: unlocked ? "#ff4f87" : "#999",
        fontSize: "16px",
        fontWeight: 900,
        cursor: "pointer",
        opacity: unlocked ? 1 : 0.55,
        filter: unlocked ? "none" : "grayscale(1)",
      }}
    >
      {unlocked ? label : `🔒 ${label} · 공유 ${requiredShareCount}회`}
    </button>
  );
}

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
