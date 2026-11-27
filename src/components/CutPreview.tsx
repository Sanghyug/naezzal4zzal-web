import { track } from "../lib/analytics";
import { commonPhotoRatio, containPhoto } from "../lib/photoFrame";
import ShareControls from "./ShareControls";
import VideoStudio from "./VideoStudio";
import { useShareCount } from "../lib/shareRewards";
import { useEffect, useRef, useState } from "react";
import { createGif, type GifSpeed } from "../lib/createGif";
import { alignImagesForGif } from "../lib/alignImagesForGif";
import { extractCells } from "../lib/extractCells";
import { createLayoutCells, type PhotoLayout } from "../lib/photoGeometry.js";
import { loadImage } from "../lib/loadImage";
import CropSelector from "./CropSelector";
import { saveGalleryItem } from "../lib/galleryStore";
import { launchEnabled, saveDraft, beginInviteRender } from "../lib/launch";
import { useLaunch, type EditorDraft } from "../lib/launch";
import InviteCompletion from "./InviteCompletion";

type CutPreviewProps = {
  imageUrl: string;
  workId: string;
  onBack: () => void;
  initialDraft?: EditorDraft | null;
};

type GifMode = "fast" | "slow" | "heartbeat" | "shake" | "shabang" | "longing";
function getUnlockedFrames(shareCount: number): FrameType[] {
  const frames: FrameType[] = ["basic"];
  if (shareCount >= 4) frames.push("spring");
  if (shareCount >= 5) frames.push("autumn");
  if (shareCount >= 6) frames.push("film");
  return frames;
}

type PreviewSize = {
  width: number;
  height: number;
};

export type FrameType = "basic" | "spring" | "autumn" | "film";

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

function CutPreview({ imageUrl, workId, onBack, initialDraft }: CutPreviewProps) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(initialDraft?.sourceUrl || null);
  const [personCount, setPersonCount] = useState(initialDraft?.personCount || 0);
  const [rectified, setRectified] = useState(initialDraft?.rectified ?? false);
  const [sourceSize, setSourceSize] = useState(initialDraft?.sourceSize || { width: 0, height: 0 });
  const [cells, setCells] = useState<CellRect[]>(initialDraft?.cells || []);
  const [adjusts, setAdjusts] = useState<Adjust[]>(initialDraft?.adjusts || []);
  const [gifUrl, setGifUrl] = useState<string | null>(initialDraft?.gif || null);
  const [currentGifStyleName, setCurrentGifStyleName] = useState(initialDraft?.styleName || "");
  const [memo, setMemo] = useState(initialDraft?.memo || "");
  const [inviteRender, setInviteRender] = useState(initialDraft?.inviteRender || "");
  const [isCreatingGif, setIsCreatingGif] = useState(false);
  const [status, setStatus] = useState<ExtractStatus>(initialDraft?.sourceUrl ? initialDraft.extractStatus || "fallback" : "loading");
  const [message, setMessage] = useState(initialDraft?.sourceUrl ? "편집하던 사진을 복원했어요." : "인생네컷을 분석하고 있어요 ❀");

  const [showGifStyleModal, setShowGifStyleModal] = useState(false);
  const [showFrameModal, setShowFrameModal] = useState(false);
  const [pendingGifMode, setPendingGifMode] = useState<GifMode | null>(null);
  const [previewSizes, setPreviewSizes] = useState<PreviewSize[]>([]);
  const adjustsRef = useRef<Adjust[]>(initialDraft?.adjusts || []);

  const shareCount = useShareCount();
  const unlockedFrames = getUnlockedFrames(shareCount);
  const [selectedFrame, setSelectedFrame] = useState<FrameType>(initialDraft?.selectedFrame || "basic");

  const { config, account } = useLaunch();
  const [aiNotice, setAiNotice] = useState(false);
  const [useAI, setUseAI] = useState<boolean | null>(initialDraft?.sourceUrl ? false : null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedGif, setSavedGif] = useState<string | null>(null);
  useEffect(() => {
    if (launchEnabled) void saveDraft(imageUrl, { workId, sourceUrl, rectified, sourceSize, cells, adjusts, memo, selectedFrame, gif: gifUrl, styleName: currentGifStyleName, extractStatus: status, inviteRender, personCount }).catch(() => {});
  }, [imageUrl, workId, sourceUrl, rectified, sourceSize, cells, adjusts, memo, selectedFrame, gifUrl, currentGifStyleName, status, inviteRender, personCount]);

  useEffect(() => {
    if (initialDraft?.sourceUrl) return;
    if (useAI === null) return;
    let cancelled = false;
    const controller = new AbortController();
    let timer: number | undefined;
    async function generateCells() {
      try {
        setStatus("loading");
        setMessage("사진을 불러오고 있어요.");
        const enhanced = await enhanceImage(imageUrl);
        const image = await loadImage(enhanced);
        if (cancelled) return;
        let { width, height } = image;
        let prepared = enhanced;
        let detected: CellRect[] = [];
        let detectedPeople = 0;
        let analysisError = "";
        if (useAI) {
          setMessage("AI가 사진 네 장의 테두리를 각각 찾고 있어요.");
          timer = window.setTimeout(() => controller.abort(), 25000);
          try {
            const result = await extractCells(enhanced, width, height, controller.signal);
            detected = result.cells;
            detectedPeople = result.personCount || 0;
            track("photo_extraction",{outcome:detected.length===4 ? "success":"failure"});
            if (result.sourceUrl) {
              const corrected = await loadImage(result.sourceUrl);
              prepared = result.sourceUrl;
              ({ width, height } = corrected);
            }
          }
          catch { track("photo_extraction",{outcome:"failure"}); analysisError = "자동 분석을 완료하지 못했어요. 아래 칸을 직접 맞춰주세요."; }
          finally { window.clearTimeout(timer); }
        }
        if (cancelled) return;
        const found = detected.length === 4;
        setPersonCount(found ? detectedPeople : 0);
        setSourceUrl(prepared);
        setRectified(prepared !== enhanced);
        setSourceSize({ width, height });
        setCells(found ? detected : createLayoutCells(height / width > 1.8 ? "1x4" : "2x2", width, height));
        const initial = Array.from({ length: 4 }, () => ({ x: 0, y: 0, scale: 1, rotate: 0 }));
        adjustsRef.current = initial;
        setAdjusts(initial);
        setStatus(found ? "success" : "fallback");
        setMessage(found ? "AI가 인화지 안의 네 사진을 찾았어요. 종이 여백과 배경이 제외됐는지 확인해주세요." : analysisError || (useAI ? "AI가 네 사진의 경계를 확실하게 찾지 못했어요. 아래 칸은 직접 맞추기용 임시 배치입니다." : "사진은 전송하지 않았어요. 아래 칸은 인식 결과가 아닌 직접 맞추기용 임시 배치입니다."));
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "사진을 읽지 못했어요. 다른 사진으로 다시 시도해주세요.");
        }
      }
    }
    void generateCells();
    return () => { cancelled = true; controller.abort(); window.clearTimeout(timer); };
  }, [imageUrl, useAI, initialDraft]);

  const restoreOriginalPhoto = async () => {
    try {
      const original = await enhanceImage(imageUrl);
      const { width, height } = await loadImage(original);
      setSourceUrl(original);
      setRectified(false);
      setPersonCount(0);
      setSourceSize({ width, height });
      setCells(createLayoutCells(height / width > 1.8 ? "1x4" : "2x2", width, height));
      resetAllAdjusts();
      setStatus("fallback");
      setMessage("원본에서 네 컷의 테두리를 직접 맞춰주세요.");
    } catch {
      setMessage("원본 사진을 다시 열지 못했어요.");
    }
  };

  const changeLayout = (layout: PhotoLayout) => {
    setCells(createLayoutCells(layout, sourceSize.width, sourceSize.height));
    resetAllAdjusts();
    setGifUrl(null);
  };

  const updateAdjust = (index: number, next: Partial<Adjust>) => {
    setGifUrl(null);
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
    setGifUrl(null);
    const reset = cells.map(() => ({
      x: 0,
      y: 0,
      scale: 1,
      rotate: 0,
    }));

    adjustsRef.current = reset;
    setAdjusts(reset);
  };

  const renderAdjustedImages = async (extraScale = 1, extraRotate = 0, commonFrame = true) => {
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
      const targetHeight = Math.max(1, Math.round(targetWidth * cell.height / cell.width));

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const frameWidth = previewSizes[i]?.width || 220;
      const frameHeight = previewSizes[i]?.height || frameWidth * cell.height / cell.width;
      ctx.save();
      ctx.translate(targetWidth / 2 + adjust.x * targetWidth / frameWidth, targetHeight / 2 + adjust.y * targetHeight / frameHeight);
      ctx.scale(adjust.scale * extraScale, adjust.scale * extraScale);
      ctx.rotate(((adjust.rotate + extraRotate) * Math.PI) / 180);
      ctx.drawImage(sourceImage,
        -targetWidth / 2 - cell.x * targetWidth / cell.width,
        -targetHeight / 2 - cell.y * targetHeight / cell.height,
        sourceImage.width * targetWidth / cell.width,
        sourceImage.height * targetHeight / cell.height);
      ctx.restore();

      enhanceRenderedCut(canvas);

      if (commonFrame) {
        const frame = document.createElement('canvas');
        frame.width = 480;
        frame.height = Math.max(1, Math.round(480 / commonPhotoRatio(cells)));
        const context = frame.getContext('2d')!;
        context.fillStyle = '#ffffff'; context.fillRect(0, 0, frame.width, frame.height);
        const box = containPhoto(canvas, frame);
        context.drawImage(canvas, box.x, box.y, box.width, box.height);
        rendered.push(frame.toDataURL('image/png'));
      } else rendered.push(canvas.toDataURL("image/png"));
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

  const handleSelectGifStyle = (mode: GifMode) => {
    setPendingGifMode(mode);
    setShowGifStyleModal(false);
    setShowFrameModal(true);
  };

  const handleSelectFrameAndCreate = async (frame: FrameType) => {
    if (!pendingGifMode) return;

    setSelectedFrame(frame);
    setShowFrameModal(false);

    await handleCreateGif(pendingGifMode, frame);
  };

  const handleCreateGif = async (
    mode: GifMode,
    frameForGif: FrameType = selectedFrame,
  ) => {
    if (cells.length !== 4 || !sourceUrl) return;

    setIsCreatingGif(true);
    setGifUrl(null);
    setCurrentGifStyleName(getGifStyleName(mode));

    try {
      if (launchEnabled) setInviteRender(await beginInviteRender());
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
      const framedImages = await renderPolaroidGifFrames(
        alignedImages,
        frameForGif,
      );
      const gif = await createGif(framedImages, speed);
      setGifUrl(gif);
      track("gif_completed",{style:"gif",outcome:"success"});
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

  const renderPolaroidGifFrames = async (
    images: string[],
    frameForGif: FrameType = selectedFrame,
  ) => {
    const framedImages: string[] = [];
    const theme = getFrameTheme(frameForGif);
    if (frameForGif === "film") {
      return await renderFilmGifFrames(images);
    }

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

  const renderFilmGifFrames = async (images: string[]) => {
    const framedImages: string[] = [];
    const frameImage = await loadImage("/frames/film_frame.png");

    for (const imageUrl of images) {
      const image = await loadImage(imageUrl);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      canvas.width = frameImage.width;
      canvas.height = frameImage.height;

      const photoX = Math.round(frameImage.width * 0.057);
      const photoY = Math.round(frameImage.height * 0.116);
      const photoWidth = Math.round(frameImage.width * 0.886);
      const photoHeight = Math.round(frameImage.height * 0.601);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(photoX, photoY, photoWidth, photoHeight);

      const box = containPhoto(image, { width: photoWidth, height: photoHeight });
      ctx.fillStyle = '#ffffff'; ctx.fillRect(photoX, photoY, photoWidth, photoHeight);
      ctx.drawImage(image, photoX + box.x, photoY + box.y, box.width, box.height);

      ctx.drawImage(frameImage, 0, 0, frameImage.width, frameImage.height);

      const memoText = memo.trim() || "오늘의 움직이는 네컷 추억";

      ctx.fillStyle = "#222222";
      ctx.font = "700 34px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillText(
        memoText,
        frameImage.width / 2,
        Math.round(frameImage.height * 0.835),
        Math.round(frameImage.width * 0.68),
      );

      framedImages.push(canvas.toDataURL("image/png"));
    }

    return framedImages;
  };

  const handleSaveToGallery = async () => {
    if (isSaving) return;
    if (!gifUrl) {
      alert("아직 저장할 GIF가 없어요.");
      return;
    }

    const currentStyleName = currentGifStyleName || "기본 GIF";

    try {
      if (savedGif === gifUrl) { alert("이 움짤은 이미 저장했어요."); return; }
      setIsSaving(true);
      const saved = await saveGalleryItem(gifUrl, memo, currentStyleName);
      URL.revokeObjectURL(saved.gifUrl);
      setSavedGif(gifUrl);
      alert("내 보관함에 저장했어요 💗");
    } catch (error) {
      console.error(error);
      alert("보관함에 저장하지 못했어요. 기기의 남은 공간을 확인해주세요.");
    } finally { setIsSaving(false); }
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
          {useAI === null ? "네 컷 사진 준비" : status === "loading" ? (
            <>
              이미지 추출 중
              <LoadingDots />
            </>
          ) : status === "error" ? (
            "추출 실패"
          ) : (
            status === "fallback" ? "직접 맞추기 · 임시 배치" : "AI가 찾은 네 컷"
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
          {useAI === null ? "자동으로 찾거나, 직접 테두리를 맞출 수 있어요." : status !== "success" || initialDraft ? message : null}
        </div>

        {useAI === null && (
          <div style={{ padding: 16, background: "#fff4f8", borderRadius: 16, lineHeight: 1.7 }}>
            <strong>네 컷을 어떻게 찾을까요?</strong>
            <p>AI 자동 인식을 선택하면 이 사진 한 장을 분석 서버와 OpenAI에 보내 사진의 위치를 찾습니다. 메모와 보관함은 보내지 않아요. 전송을 원하지 않으면 직접 맞추기를 선택해주세요.</p>
            <button onClick={() => {
              if (config?.aiRestricted && !account?.aiAllowed) setAiNotice(true);
              else setUseAI(true);
            }} style={primarySubButtonStyle}>사진 전송에 동의하고 AI로 찾기</button>
            {aiNotice && config?.aiRestricted && !account?.aiAllowed && <p role="status">AI 기능은 현재 출시 준비 중이에요.</p>}
            <button onClick={() => setUseAI(false)} style={secondaryButtonStyle}>사진 전송 없이 직접 맞추기</button>
          </div>
        )}
        {useAI !== null && status === "loading" && <button onClick={() => { setUseAI(false); }} style={smallButtonStyle}>AI 기다리지 않고 직접 맞추기</button>}
        {status !== "success" && sourceUrl && cells.length > 0 && (
          <CropSelector sourceUrl={sourceUrl} sourceSize={sourceSize} cells={cells}
            onChange={(next) => { setCells(next); resetAllAdjusts(); }}
            onLayoutChange={changeLayout} />
        )}
        {sourceUrl && cells.length > 0 && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                alignItems: "stretch",
                gap: "10px",
              }}
            >
              {cells.map((cell, index) => (
                <AdjustableCut
                  key={index}
                  sourceUrl={sourceUrl}
                  sourceSize={sourceSize}
                  cell={cell}
                  slotRatio={commonPhotoRatio(cells)}
                  adjust={adjusts[index] ?? { x: 0, y: 0, scale: 1, rotate: 0 }}
                  onChange={(next) => updateAdjust(index, next)}
                  onSizeChange={(size) => {
                    setPreviewSizes((prev) => {
                      if (prev[index]?.width === size.width && prev[index]?.height === size.height) return prev;
                      const next = [...prev];
                      next[index] = size;
                      return next;
                    });
                  }}
                />
              ))}
            </div>

          </>
        )}

        {sourceUrl && cells.length > 0 && (status === "success" ? (
          <details className="nz-manual-details"><summary><strong>사진이 조금 잘못 맞춰졌나요?</strong><span>사진의 테두리나 잘린 부분을 직접 조정할 수 있어요.</span><b>사진 영역 직접 조정하기</b></summary><p className="nz-crop-hint">↘ 오른쪽 아래 색깔 동그라미를 끌어 사진 영역의 크기를 조절하세요.</p>
            {rectified && <button onClick={() => void restoreOriginalPhoto()} style={smallButtonStyle}>원본에서 직접 맞추기</button>}
            <CropSelector sourceUrl={sourceUrl} sourceSize={sourceSize} cells={cells}
              onChange={(next) => { setCells(next); resetAllAdjusts(); }}
              onLayoutChange={changeLayout} />
          </details>
        ) : null)}

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
              onChange={(event) => { setMemo(event.target.value); setGifUrl(null); }}
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
            {showGifStyleModal && (
              <div
                onClick={() => setShowGifStyleModal(false)}
                style={modalOverlayStyle}
              >
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={modalBoxStyle}
                >
                  <h3 style={{ color: "#ff4f87", marginTop: 0 }}>
                    움짤 스타일 선택
                  </h3>
                  <p style={{fontSize:13,color:"#9b8790",lineHeight:1.6}}>이 기기의 공유 기록 {shareCount}회 · 완성한 결과물을 친구에게 공유하면 차례로 열려요.</p>

                  <button
                    onClick={() => handleSelectGifStyle("fast")}
                    style={fastGifButtonStyle}
                  >
                    헐레벌떡 GIF
                  </button>

                  <button
                    onClick={() => handleSelectGifStyle("slow")}
                    style={slowGifButtonStyle}
                  >
                    살랑살랑 GIF
                  </button>

                  <button
                    onClick={() => handleSelectGifStyle("heartbeat")}
                    style={heartbeatGifButtonStyle}
                  >
                    두근두근 GIF
                  </button>

                  <LockedGifButton
                    label="흔들흔들 GIF"
                    requiredShareCount={1}
                    shareCount={shareCount}
                    variant="shake"
                    onClick={() => handleSelectGifStyle("shake")}
                  />

                  <LockedGifButton
                    label="샤방샤방 GIF"
                    requiredShareCount={2}
                    shareCount={shareCount}
                    variant="shabang"
                    onClick={() => handleSelectGifStyle("shabang")}
                  />

                  <LockedGifButton
                    label="아련아련 GIF"
                    requiredShareCount={3}
                    shareCount={shareCount}
                    variant="longing"
                    onClick={() => handleSelectGifStyle("longing")}
                  />
                </div>
              </div>
            )}

            {showFrameModal && (
              <div
                onClick={() => setShowFrameModal(false)}
                style={modalOverlayStyle}
              >
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={modalBoxStyle}
                >
                  <h3 style={{ color: "#ff4f87", marginTop: 0 }}>
                    프레임 선택
                  </h3>
                  <p style={{fontSize:13,color:"#9b8790",lineHeight:1.6}}>이 기기의 공유 기록 {shareCount}회 · 완성한 결과물을 친구에게 공유하면 차례로 열려요.</p>

                  <FrameButton
                    label="기본 핑크 프레임"
                    frame="basic"
                    requiredShareCount={0}
                    selectedFrame={selectedFrame}
                    unlockedFrames={unlockedFrames}
                    onSelect={handleSelectFrameAndCreate}
                  />

                  <FrameButton
                    label="봄날 프레임"
                    frame="spring"
                    requiredShareCount={4}
                    selectedFrame={selectedFrame}
                    unlockedFrames={unlockedFrames}
                    onSelect={handleSelectFrameAndCreate}
                  />

                  <FrameButton
                    label="가을 프레임"
                    frame="autumn"
                    requiredShareCount={5}
                    selectedFrame={selectedFrame}
                    unlockedFrames={unlockedFrames}
                    onSelect={handleSelectFrameAndCreate}
                  />

                  <FrameButton
                    label="필름 프레임"
                    frame="film"
                    requiredShareCount={6}
                    selectedFrame={selectedFrame}
                    unlockedFrames={unlockedFrames}
                    onSelect={handleSelectFrameAndCreate}
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

        <section className="nz-gif-section" aria-label="움짤 제작"><header className="nz-production-heading"><span aria-hidden="true">▧</span><div><h3>움직이는 네 컷</h3><p>네 장의 사진을 하나의 움짤로</p></div><small>무료</small></header>
          {status !== "error" && (
            <button
              onClick={() => setShowGifStyleModal(true)}
              disabled={cells.length !== 4 || isCreatingGif}
              className="nz-make-button nz-make-gif"
            >
              {isCreatingGif ? "움짤 만드는 중..." : <><span>움짤 만들기</span><small aria-hidden="true">무료 GIF</small></>}
            </button>
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

            <button onClick={handleSaveToGallery} disabled={isSaving} style={saveButtonStyle}>
              {isSaving ? "저장 중..." : "보관함에 저장하기"}
            </button>

            <ShareControls url={gifUrl} />
            {launchEnabled && <InviteCompletion key={gifUrl} gif={gifUrl} renderId={inviteRender} />}

            <button
              onClick={() => setShowGifStyleModal(true)}
              style={primarySubButtonStyle}
            >
              다른 스타일로 다시 만들기
            </button>
          </div>
        )}

        </section>

        {status !== "error" && <VideoStudio personCount={personCount} workId={workId} ready={cells.length === 4 && !!sourceUrl && !isCreatingGif} getImages={() => renderAdjustedImages(1, 0, false)} memo={memo} />}

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
          내 사진으로 만드는 움직이는 네컷
        </div>

        {status !== "error" && (
          <button onClick={onBack} style={secondaryButtonStyle}>
            돌아가기
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
  slotRatio: number;
  adjust: Adjust;
  onChange: (next: Partial<Adjust>) => void;
  onSizeChange: (size: PreviewSize) => void;
};

function AdjustableCut({
  sourceUrl,
  sourceSize,
  cell,
  slotRatio,
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
    <div className="nz-adjustable-cut">
      <div className="nz-preview-slot" style={{aspectRatio: slotRatio, background: "#ffffff"}}>
      <div
        ref={frameRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: `${Math.min(100, (cell.width / cell.height) / slotRatio * 100)}%`,
          aspectRatio: cell.width / cell.height,
          borderRadius: 0,
          overflow: "hidden",
          backgroundColor: "#ffffff",
          boxShadow: "none",
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

  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));

  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);

  ctx.filter = "none";
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

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "auto",
  zIndex: 20,
  backgroundColor: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
};

const modalBoxStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "360px",
  backgroundColor: "white",
  borderRadius: "26px",
  padding: "20px",
  boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
  textAlign: "center",
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
      brand: "내짤4짤 · film style",
    };
  }

  if (frame === "autumn") {
    return {
      gradientStart: "#5b3a29",
      gradientEnd: "#8b5e3c",
      border: "#3d2417",
      photoBg: "#fdf7f1",
      memoBg: "rgba(255,245,235,0.95)",
      memoText: "#4a2d1f",
      brandText: "#f3d2b1",
      brand: "내짤4짤 · autumn style",
    };
  }

  if (frame === "spring") {
    return {
      gradientStart: "#fffdf2",
      gradientEnd: "#fff1b8",
      border: "#e7c85f",
      photoBg: "#fffef8",
      memoBg: "rgba(255,255,255,0.90)",
      memoText: "#7b6422",
      brandText: "#c49a1d",
      brand: "내짤4짤 · spring style",
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
  requiredShareCount,
  selectedFrame,
  unlockedFrames,
  onSelect,
}: {
  label: string;
  frame: FrameType;
  requiredShareCount: number;
  selectedFrame: FrameType;
  unlockedFrames: FrameType[];
  onSelect: (frame: FrameType) => void;
}) {
  const unlocked = unlockedFrames.includes(frame);
  const selected = selectedFrame === frame;

  const styleMap = {
    basic: {
      border: "#ff9fc1",
      bg: "#fff1f7",
      color: "#ff4f87",
    },
    film: {
      border: "#555555",
      bg: "#f1f1f1",
      color: "#333333",
    },
    autumn: {
      border: "#6f452f",
      bg: "#f2e3d4",
      color: "#5b3a29",
    },
    spring: {
      border: "#e7c85f",
      bg: "#fff8cf",
      color: "#c49a1d",
    },
  };

  const theme = styleMap[frame];

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
        marginTop: "10px",
        padding: "13px",
        borderRadius: "14px",
        border: selected
          ? `2px solid ${theme.color}`
          : `1px solid ${theme.border}`,
        backgroundColor: unlocked ? theme.bg : "#eeeeee",
        color: unlocked ? theme.color : "#999",
        fontSize: "14px",
        fontWeight: 900,
        cursor: "pointer",
        opacity: unlocked ? 1 : 0.55,
        filter: unlocked ? "none" : "grayscale(1)",
        boxShadow: selected ? `0 6px 14px ${theme.color}22` : "none",
      }}
    >
      {unlocked
        ? selected
          ? `✓ ${label}`
          : label
        : `🔒 ${label} · 공유 ${requiredShareCount}회`}
    </button>
  );
}

function LockedGifButton({
  label,
  requiredShareCount,
  shareCount,
  variant,
  onClick,
}: {
  label: string;
  requiredShareCount: number;
  shareCount: number;
  variant: "shake" | "shabang" | "longing";
  onClick: () => void;
}) {
  const unlocked = shareCount >= requiredShareCount;

  const styleMap = {
    shake: {
      border: "#ffc6dc",
      bg: "#fff0f6",
      color: "#ff4f87",
    },
    shabang: {
      border: "#ffd7a8",
      bg: "#fff7e8",
      color: "#ff9a3d",
    },
    longing: {
      border: "#d6d2ff",
      bg: "#f4f2ff",
      color: "#8f78e8",
    },
  };

  const theme = styleMap[variant];

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
        border: `1px solid ${theme.border}`,
        backgroundColor: unlocked ? theme.bg : "#eeeeee",
        color: unlocked ? theme.color : "#999",
        fontSize: "16px",
        fontWeight: 900,
        cursor: "pointer",
        opacity: unlocked ? 1 : 0.55,
        filter: unlocked ? "none" : "grayscale(1)",
        boxShadow: unlocked ? `0 6px 14px ${theme.color}22` : "none",
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
